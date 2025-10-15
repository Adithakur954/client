import React, { useEffect, useRef } from "react";
import { toast } from "react-toastify";

/**
 * Safely extract lat/lng from a log object and return google.maps.LatLng.
 */
function toLatLng(log) {
  const lat = Number(
    log.lat ?? log.latitude ?? log.start_lat ?? log.Latitude ?? log.LAT
  );
  const lng = Number(
    log.lng ?? log.lon ?? log.longitude ?? log.start_lon ?? log.LNG
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return new window.google.maps.LatLng(lat, lng);
}

/**
 * Normalize metric key from UI to internal keys used in the data.
 */
function normalizeMetricKey(m) {
  if (!m) return "rsrp";
  const s = String(m).toLowerCase();
  if (s === "dl-throughput") return "dl_thpt";
  if (s === "ul-throughput") return "ul_thpt";
  if (s === "lte-bler") return "lte_bler";
  return s;
}

/**
 * Mapping of logical metric key -> possible field names in logs.
 */
const metricKeyMap = {
  rsrp: ["rsrp", "lte_rsrp", "rsrp_dbm"],
  rsrq: ["rsrq"],
  sinr: ["sinr"],
  dl_thpt: ["dl_thpt", "dl_throughput", "download_mbps"],
  ul_thpt: ["ul_thpt", "ul_throughput", "upload_mbps"],
  mos: ["mos", "voice_mos"],
  lte_bler: ["lte_bler", "bler"],
};

/**
 * Read numeric metric value from a log using normalized mapping.
 */
function getMetricValue(log, selectedMetric) {
  const key = normalizeMetricKey(selectedMetric);
  const candidates = metricKeyMap[key] || [key];
  for (const k of candidates) {
    const v = Number(log[k]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/**
 * Compute basic statistics on an array of numbers.
 */
function computeStats(values) {
  if (!values.length) {
    return { mean: null, median: null, max: null, min: null, count: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const mean = sum / values.length;
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const max = sorted[sorted.length - 1];
  const min = sorted[0];
  return { mean, median, max, min, count: values.length };
}

/**
 * Pick a color based on thresholds for a given metric.
 */
function pickColorForValue(value, selectedMetric, thresholds) {
  const key = normalizeMetricKey(selectedMetric);
  const arr = thresholds?.[key];
  if (Array.isArray(arr) && arr.length) {
    for (const t of arr) {
      const min = t.min ?? t.from ?? Number.NEGATIVE_INFINITY;
      const max = t.max ?? t.to ?? Number.POSITIVE_INFINITY;
      const val = t.value;
      if (Number.isFinite(val)) {
        if (value <= val) return t.color || "#4ade80";
      } else if (value >= min && value <= max) {
        return t.color || "#4ade80";
      }
    }
  }
  return "#93c5fd"; // fallback color
}

/**
 * Build LatLngBounds for a polygon from its path.
 */
function buildPolygonBounds(polygon) {
  const path = polygon.getPath()?.getArray?.() || [];
  const bounds = new window.google.maps.LatLngBounds();
  path.forEach((ll) => bounds.extend(ll));
  return bounds;
}

/**
 * Analyze which logs are inside a shape (rectangle, polygon, circle)
 */
function analyzeInside(type, overlay, logs, selectedMetric) {
  const gm = window.google.maps;
  const poly = gm.geometry?.poly;
  const spherical = gm.geometry?.spherical;

  let bb = null;
  if (type === "rectangle" || type === "circle") bb = overlay.getBounds?.();
  else if (type === "polygon") bb = buildPolygonBounds(overlay);

  const pre = logs.filter((l) => {
    const pt = toLatLng(l);
    return pt && (!bb || bb.contains(pt));
  });

  const inside = pre.filter((l) => {
    const pt = toLatLng(l);
    if (!pt) return false;
    if (type === "rectangle") return overlay.getBounds().contains(pt);
    if (type === "polygon") return poly?.containsLocation?.(pt, overlay) ?? false;
    if (type === "circle") {
      const d = spherical?.computeDistanceBetween?.(pt, overlay.getCenter());
      return Number.isFinite(d) && d <= overlay.getRadius();
    }
    return false;
  });

  const vals = inside
    .map((l) => getMetricValue(l, selectedMetric))
    .filter((v) => Number.isFinite(v));

  return { inside, stats: computeStats(vals) };
}

/**
 * Convert meters to degrees latitude/longitude.
 */
function metersToDegLat(m) {
  return m / 111320;
}

function metersToDegLng(m, lat) {
  const metersPerDeg = 111320 * Math.cos((lat * Math.PI) / 180);
  return m / (metersPerDeg > 0 ? metersPerDeg : 111320);
}

/**
 * Get bounds of any shape.
 */
function getShapeBounds(type, overlay) {
  if (type === "rectangle" || type === "circle") return overlay.getBounds();
  if (type === "polygon") return buildPolygonBounds(overlay);
  return null;
}

/**
 * Check whether a point lies within a shape.
 */
function isPointInShape(type, overlay, point) {
  const gm = window.google.maps;
  if (type === "rectangle") return overlay.getBounds().contains(point);
  if (type === "polygon") return gm.geometry?.poly?.containsLocation?.(point, overlay) ?? false;
  if (type === "circle") {
    const d = gm.geometry?.spherical?.computeDistanceBetween?.(point, overlay.getCenter());
    return Number.isFinite(d) && d <= overlay.getRadius();
  }
  return false;
}

/**
 * Create a grid over the drawn shape and color cells by metric stats.
 */
function pixelateShape(
  type,
  overlay,
  logs,
  selectedMetric,
  thresholds,
  cellSizeMeters,
  maxCells,
  map,
  overlaysRef,
  colorizeCells
) {
  const gm = window.google.maps;
  const bounds = getShapeBounds(type, overlay);

  if (!bounds) {
    console.warn("Could not determine bounds for shape");
    return { cellsDrawn: 0, totalCells: 0, cellsWithLogs: 0 };
  }

  const centerLat = bounds.getCenter().lat();
  const stepLat = metersToDegLat(cellSizeMeters);
  const stepLng = metersToDegLng(cellSizeMeters, centerLat);

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const south = sw.lat(), west = sw.lng(), north = ne.lat(), east = ne.lng();

  const preFilteredLogs = logs
    .map((l) => ({ log: l, pt: toLatLng(l) }))
    .filter((x) => x.pt && bounds.contains(x.pt));

  const cols = Math.max(1, Math.ceil(Math.abs(east - west) / stepLng));
  const rows = Math.max(1, Math.ceil(Math.abs(north - south) / stepLat));
  const totalCells = cols * rows;

  if (totalCells > maxCells) {
    toast.warn(`Grid too dense (${totalCells} cells). Capping at ${maxCells}.`);
  }

  let cellsDrawn = 0;
  let cellsWithLogs = 0;

  for (let i = 0; i < rows; i++) {
    const lat = south + i * stepLat;
    for (let j = 0; j < cols; j++) {
      if (cellsDrawn >= maxCells) break;
      const lng = west + j * stepLng;

      const cellBounds = new gm.LatLngBounds(
        new gm.LatLng(lat, lng),
        new gm.LatLng(lat + stepLat, lng + stepLng)
      );
      const cellCenter = cellBounds.getCenter();

      if (!isPointInShape(type, overlay, cellCenter)) continue;

      const inCell = preFilteredLogs.filter((x) => cellBounds.contains(x.pt));
      let fillColor;
      let fillOpacity = 0.1;

      if (inCell.length > 0) {
        cellsWithLogs++;
        const vals = inCell
          .map((x) => getMetricValue(x.log, selectedMetric))
          .filter((v) => Number.isFinite(v));

        if (vals.length > 0) {
          const statsCell = computeStats(vals);
          const valueForColor = statsCell.mean;
          fillColor = colorizeCells
            ? pickColorForValue(valueForColor, selectedMetric, thresholds)
            : "#9ca3af";
          fillOpacity = 0.6;
        } else {
          fillColor = "#808080"; // Gray for logs with no valid metric
          fillOpacity = 0.3;
        }
      } else {
        fillColor = "#808080"; // Gray for empty cells
      }
      
      const rect = new gm.Rectangle({
        map,
        bounds: cellBounds,
        strokeWeight: 0.4,
        strokeColor: "#111827",
        fillOpacity: fillOpacity,
        fillColor: fillColor,
        clickable: false,
        zIndex: 50,
      });

      overlaysRef.current.push(rect);
      cellsDrawn++;
    }
    if (cellsDrawn >= maxCells) break;
  }

  return {
    cellsDrawn,
    totalCells: Math.min(totalCells, maxCells),
    cellsWithLogs,
  };
}

function serializeOverlay(type, overlay) {
  if (!overlay) return null;

  if (type === "polygon") {
    const path = overlay.getPath()?.getArray?.() || [];
    const coords = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
    const bounds = buildPolygonBounds(overlay);
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return {
      type,
      polygon: coords,
      bounds: { south: sw.lat(), west: sw.lng(), north: ne.lat(), east: ne.lng() },
    };
  }

  if (type === "rectangle") {
    const b = overlay.getBounds?.();
    const sw = b.getSouthWest();
    const ne = b.getNorthEast();
    return {
      type,
      rectangle: {
        sw: { lat: sw.lat(), lng: sw.lng() },
        ne: { lat: ne.lat(), lng: ne.lng() },
      },
    };
  }

  if (type === "circle") {
    const c = overlay.getCenter?.();
    const r = overlay.getRadius?.();
    return {
      type,
      circle: { center: { lat: c.lat(), lng: c.lng() }, radius: r },
    };
  }
  return { type };
}


export default function DrawingToolsLayer({
  map,
  enabled,
  logs,
  selectedMetric,
  thresholds,
  pixelateRect = false,
  cellSizeMeters = 100,
  maxCells = 1500,
  onSummary,
  onDrawingsChange,
  clearSignal = 0,
  colorizeCells = true,
}) {
  const managerRef = useRef(null);
  const overlaysRef = useRef([]);
  const collectedDrawingRef = useRef([]);

  useEffect(() => {
    if (!map || !enabled || managerRef.current) return;
    const gm = window.google?.maps;
    if (!gm?.drawing?.DrawingManager) {
      toast.error('Drawing library not loaded.');
      return;
    }

    const dm = new gm.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: gm.ControlPosition.TOP_CENTER,
        drawingModes: ["rectangle", "polygon", "circle"],
      },
      polygonOptions: {clickable: false, strokeWeight: 2, strokeColor: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 0.08},
      rectangleOptions: {clickable: false, strokeWeight: 2, strokeColor: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 0.06},
      circleOptions: {clickable: false, strokeWeight: 2, strokeColor: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 0.06},
    });
    dm.setMap(map);

    const handleComplete = (e) => {
      const type = e.type;
      const overlay = e.overlay;
      overlaysRef.current.push(overlay);

      const geometry = serializeOverlay(type, overlay);
      const { inside, stats } = analyzeInside(type, overlay, logs || [], selectedMetric);
      
      let areaInMeters = 0;
      const spherical = gm.geometry?.spherical;
      if (spherical) {
        if (type === "polygon") areaInMeters = spherical.computeArea(overlay.getPath());
        else if (type === "rectangle") {
          const b = overlay.getBounds();
          const p = [b.getNorthEast(), new gm.LatLng(b.getNorthEast().lat(), b.getSouthWest().lng()), b.getSouthWest(), new gm.LatLng(b.getSouthWest().lat(), b.getNorthEast().lng())];
          areaInMeters = spherical.computeArea(p);
        } else if (type === "circle") areaInMeters = Math.PI * Math.pow(overlay.getRadius(), 2);
      }

      let gridInfo = null;
      if (pixelateRect) {
        const { cellsDrawn, cellsWithLogs } = pixelateShape(
          type, overlay, logs || [], selectedMetric, thresholds, cellSizeMeters, maxCells, map, overlaysRef, colorizeCells
        );
        const singleCellArea = cellSizeMeters * cellSizeMeters;
        const totalGridAreaWithLogs = singleCellArea * cellsWithLogs;
        gridInfo = { cells: cellsDrawn, cellsWithLogs, cellSizeMeters, totalGridArea: totalGridAreaWithLogs };
      }

      const entry = {
        id: Date.now(),
        type,
        geometry,
        selectedMetric,
        stats,
        count: inside.length,
        logs: inside,
        grid: gridInfo,
        createdAt: new Date().toISOString(),
        area: areaInMeters,
      };

      collectedDrawingRef.current.push(entry);
      onDrawingsChange?.([...collectedDrawingRef.current]);
      onSummary?.(entry);
      dm.setDrawingMode(null);
    };

    const listener = gm.event.addListener(dm, "overlaycomplete", handleComplete);
    managerRef.current = dm;

    return () => {
      gm.event.removeListener(listener);
      dm.setMap(null);
      managerRef.current = null;
    };
  }, [map, enabled, logs, selectedMetric, thresholds, pixelateRect, cellSizeMeters, maxCells, onSummary, onDrawingsChange, colorizeCells]);

  useEffect(() => {
    if (!clearSignal) return;
    overlaysRef.current.forEach((o) => o?.setMap?.(null));
    overlaysRef.current = [];
    collectedDrawingRef.current = [];
    onDrawingsChange?.([]);
    onSummary?.(null);
  }, [clearSignal, onDrawingsChange, onSummary]);

  return null;
}