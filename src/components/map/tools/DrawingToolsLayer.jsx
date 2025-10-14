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
 * Supports two formats:
 * - threshold.value (single sided <=)
 * - threshold.from/to (range)
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
 * and compute stats for the selected metric.
 *
 * Note: Polygon operations use google.maps.geometry.poly.containsLocation,
 * so make sure "geometry" library is loaded in Maps JS.
 */
function analyzeInside(type, overlay, logs, selectedMetric) {
  const gm = window.google.maps;
  const poly = gm.geometry?.poly;
  const spherical = gm.geometry?.spherical;

  // Pre-filter by bounding box to speed up checks
  let bb = null;
  if (type === "rectangle") bb = overlay.getBounds?.();
  else if (type === "circle") bb = overlay.getBounds?.();
  else if (type === "polygon") bb = buildPolygonBounds(overlay);

  const pre = logs.filter((l) => {
    const pt = toLatLng(l);
    if (!pt) return false;
    if (bb && !bb.contains(pt)) return false;
    return true;
  });

  const inside = pre.filter((l) => {
    const pt = toLatLng(l);
    if (!pt) return false;

    if (type === "rectangle") return overlay.getBounds().contains(pt);

    if (type === "polygon") {
      // requires geometry library
      return poly?.containsLocation?.(pt, overlay) ?? false;
    }

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
 * Convert meters to degrees latitude (approx).
 */
function metersToDegLat(m) {
  return m / 111320;
}

/**
 * Convert meters to degrees longitude at given latitude (approx).
 */
function metersToDegLng(m, lat) {
  const metersPerDeg = 111320 * Math.cos((lat * Math.PI) / 180);
  if (metersPerDeg <= 0) return m / 111320;
  return m / metersPerDeg;
}

/**
 * Get bounds of any shape.
 */
function getShapeBounds(type, overlay) {
  if (type === "rectangle" || type === "circle") {
    return overlay.getBounds();
  }
  if (type === "polygon") {
    return buildPolygonBounds(overlay);
  }
  return null;
}

/**
 * Check whether a point lies within a shape.
 */
function isPointInShape(type, overlay, point) {
  const gm = window.google.maps;

  if (type === "rectangle") {
    return overlay.getBounds().contains(point);
  }
  if (type === "polygon") {
    return gm.geometry?.poly?.containsLocation?.(point, overlay) ?? false;
  }
  if (type === "circle") {
    const d = gm.geometry?.spherical?.computeDistanceBetween?.(
      point,
      overlay.getCenter()
    );
    return Number.isFinite(d) && d <= overlay.getRadius();
  }
  return false;
}

/**
 * Create a grid (pixelate) over the drawn shape and color cells by metric stats.
 * Returns total cells drawn so you can report summary.
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
    return { cellsDrawn: 0, totalCells: 0 };
  }

  const centerLat = bounds.getCenter().lat();
  const stepLat = metersToDegLat(cellSizeMeters);
  const stepLng = metersToDegLng(cellSizeMeters, centerLat);

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const south = sw.lat();
  const west = sw.lng();
  const north = ne.lat();
  const east = ne.lng();

  // Only consider logs inside the original shape first (fast pre-filter)
  const { inside } = analyzeInside(type, overlay, logs, selectedMetric);
  const baseInside = inside
    .map((l) => ({ log: l, pt: toLatLng(l) }))
    .filter((x) => !!x.pt);

  const cols = Math.max(1, Math.ceil((east - west) / stepLng));
  const rows = Math.max(1, Math.ceil((north - south) / stepLat));
  const totalCells = cols * rows;

  if (totalCells > maxCells) {
    toast.warn(
      `Grid too dense (${totalCells} cells). Increase cell size or draw a smaller shape. Capping at ${maxCells}.`
    );
  }

  let cellsDrawn = 0;

  for (let lat = south; lat < north - 1e-12; lat += stepLat) {
    const top = Math.min(lat + stepLat, north);

    for (let lng = west; lng < east - 1e-12; lng += stepLng) {
      if (cellsDrawn >= maxCells) break;

      const right = Math.min(lng + stepLng, east);

      const cellBounds = new gm.LatLngBounds(
        new gm.LatLng(lat, lng),
        new gm.LatLng(top, right)
      );

      const cellCenter = cellBounds.getCenter();

      // Only draw the cell if its center is inside the shape
      if (!isPointInShape(type, overlay, cellCenter)) continue;

      // Logs inside this cell (from baseInside)
      const inCell = baseInside.filter((x) => cellBounds.contains(x.pt));
      const vals = inCell
        .map((x) => getMetricValue(x.log, selectedMetric))
        .filter((v) => Number.isFinite(v));

      if (!vals.length) continue;

      const statsCell = computeStats(vals);
      const valueForColor =
        statsCell.mean ?? statsCell.median ?? statsCell.max ?? null;

      const fillColor = colorizeCells
        ? pickColorForValue(valueForColor, selectedMetric, thresholds)
        : "#9ca3af";

      const rect = new gm.Rectangle({
        map,
        bounds: cellBounds,
        strokeWeight: 0.4,
        strokeColor: "#111827",
        fillOpacity: 0.35,
        fillColor,
        clickable: false,
        zIndex: 50,
      });

      overlaysRef.current.push(rect);
      cellsDrawn++;
    }

    if (cellsDrawn >= maxCells) break;
  }

  return { cellsDrawn, totalCells: Math.min(totalCells, maxCells) };
}

/**
 * Serialize a completed overlay (polygon/rectangle/circle) to a plain JS object
 * so you can store geometry alongside logs and stats.
 */
function serializeOverlay(type, overlay) {
  if (!overlay) return null;

  if (type === "polygon") {
    // For polygon, capture the path as an array of {lat, lng}
    const path = overlay.getPath()?.getArray?.() || [];
    const coords = path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
    const bounds = buildPolygonBounds(overlay);
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return {
      type,
      polygon: coords,
      bounds: {
        south: sw.lat(),
        west: sw.lng(),
        north: ne.lat(),
        east: ne.lng(),
      },
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
      circle: {
        center: { lat: c.lat(), lng: c.lng() },
        radius: r,
      },
    };
  }

  return { type };
}

/**
 * Optional: return polygon coords only (if ever needed standalone).
 * Prefer serializeOverlay() for full geometry details.
 */
function getShapeCoordinates(type, overlay) {
  if (type === "polygon") {
    const path = overlay.getPath()?.getArray?.() || [];
    return path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
  }
  return [];
}

/**
 * DrawingToolsLayer
 * - Lets user draw rectangle, polygon, circle
 * - Computes which logs fall inside
 * - Optionally pixelates with a grid
 * - Collects a full entry: { type, geometry, logs, stats, grid, selectedMetric }
 * - Emits: onSummary (latest entry), onDrawingsChange (full collection)
 *
 * Important: Load Google Maps JS with libraries: ["drawing", "geometry"]
 */
export default function DrawingToolsLayer({
  map,
  enabled,
  logs,
  selectedMetric,
  thresholds,
  pixelateRect = false,
  cellSizeMeters = 100,
  maxCells = 1200,
  onSummary, // latest entry callback
  onDrawingsChange, // full collection callback (optional)
  clearSignal = 0,
  colorizeCells = true,
}) {
  const managerRef = useRef(null);
  const overlaysRef = useRef([]);
  const collectedDrawingRef = useRef([]); // store all drawing entries in one place

  useEffect(() => {
    if (!map || !enabled || managerRef.current) return;

    const gm = window.google?.maps;
    if (!gm?.drawing?.DrawingManager) {
      console.warn('Google Maps drawing library not loaded. Add "drawing" to libraries.');
      toast.error('Drawing library not loaded. Add "drawing" to GOOGLE_MAPS_LOADER_OPTIONS.libraries.');
      return;
    }

    // Create a DrawingManager with polygon/rectangle/circle modes
    const dm = new gm.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: gm.ControlPosition.TOP_CENTER,
        drawingModes: ["rectangle", "polygon", "circle"],
      },
      polygonOptions: {
        clickable: false,
        strokeWeight: 2,
        strokeColor: "#1d4ed8",
        fillColor: "#1d4ed8",
        fillOpacity: 0.08,
      },
      rectangleOptions: {
        clickable: false,
        strokeWeight: 2,
        strokeColor: "#1d4ed8",
        fillColor: "#1d4ed8",
        fillOpacity: 0.06,
      },
      circleOptions: {
        clickable: false,
        strokeWeight: 2,
        strokeColor: "#1d4ed8",
        fillColor: "#1d4ed8",
        fillOpacity: 0.06,
      },
    });

    dm.setMap(map);

    /**
     * When user completes drawing an overlay, we:
     * - push overlay to overlaysRef (so we can clear later)
     * - compute inside logs + stats
     * - serialize geometry
     * - optionally pixelate
     * - build a single "entry" object and collect it
     * - emit callbacks: onSummary(entry), onDrawingsChange(all)
     */
    const handleComplete = (e) => {
      const type = e.type; // "rectangle" | "polygon" | "circle"
      const overlay = e.overlay;
      overlaysRef.current.push(overlay);

      // Shape geometry as plain object (coords/bounds/etc.)
      const geometry = serializeOverlay(type, overlay);

      // Logs and stats inside the shape
      const { inside, stats } = analyzeInside(type, overlay, logs || [], selectedMetric);

      // Optional grid/pixelation over the shape
      let gridInfo = null;
      if (pixelateRect) {
        const { cellsDrawn, totalCells } = pixelateShape(
          type,
          overlay,
          logs || [],
          selectedMetric,
          thresholds,
          cellSizeMeters,
          maxCells,
          map,
          overlaysRef,
          colorizeCells
        );
        gridInfo = { cells: cellsDrawn, totalCells, cellSizeMeters };
      }

      // Build the single entry that has everything in one place
      const entry = {
        id: Date.now(), // quick ID; replace with UUID if needed
        type,
        geometry, // includes polygon coordinates / rectangle bounds / circle center+radius
        selectedMetric,
        stats,
        count: inside.length,
        logs: inside, // all logs inside the shape
        grid: gridInfo,
        createdAt: new Date().toISOString(),
      };

      // Collect and notify
      collectedDrawingRef.current.push(entry);
      onDrawingsChange?.([...collectedDrawingRef.current]);
      onSummary?.(entry);

      // Back to hand mode
      managerRef.current?.setDrawingMode(null);
    };

    const listener = gm.event.addListener(dm, "overlaycomplete", handleComplete);
    managerRef.current = dm;

    return () => {
      gm.event.removeListener(listener);
      dm.setMap(null);
      managerRef.current = null;
    };
  }, [
    map,
    enabled,
    logs,
    selectedMetric,
    thresholds,
    pixelateRect,
    cellSizeMeters,
    maxCells,
    onSummary,
    onDrawingsChange,
    colorizeCells,
  ]);

  /**
   * Clear overlays and collected data when clearSignal changes (e.g., increment a counter).
   */
  useEffect(() => {
    if (!clearSignal) return;

    // Remove all drawn overlays from the map
    overlaysRef.current.forEach((o) => o?.setMap?.(null));
    overlaysRef.current = [];

    // Clear collected entries
    collectedDrawingRef.current = [];
    onDrawingsChange?.([]);
    onSummary?.(null);
  }, [clearSignal, onSummary, onDrawingsChange]);

  return null;
}