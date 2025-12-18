import React, { useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";

/**
 * ============================================================================
 * GEO UTILITIES
 * ============================================================================
 */

function toLatLng(item) {
  // Handles both logs (lat) and sessions (start_lat)
  const lat = Number(
    item.lat ?? item.latitude ?? item.start_lat ?? item.Latitude ?? item.LAT
  );
  const lng = Number(
    item.lng ?? item.lon ?? item.longitude ?? item.start_lon ?? item.LNG
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return new window.google.maps.LatLng(lat, lng);
}

function normalizeMetricKey(m) {
  if (!m) return "rsrp";
  const s = String(m).toLowerCase();
  if (s === "dl-throughput") return "dl_thpt";
  if (s === "ul-throughput") return "ul_thpt";
  if (s === "lte-bler") return "lte_bler";
  return s;
}

const metricKeyMap = {
  rsrp: ["rsrp", "lte_rsrp", "rsrp_dbm"],
  rsrq: ["rsrq"],
  sinr: ["sinr"],
  dl_thpt: ["dl_thpt", "dl_throughput", "download_mbps"],
  ul_thpt: ["ul_thpt", "ul_throughput", "upload_mbps"],
  mos: ["mos", "voice_mos"],
  lte_bler: ["lte_bler", "bler"],
};

function getMetricValue(log, selectedMetric) {
  const key = normalizeMetricKey(selectedMetric);
  const candidates = metricKeyMap[key] || [key];
  for (const k of candidates) {
    const v = Number(log[k]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

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
  return "#93c5fd";
}

function buildPolygonBounds(polygon) {
  const path = polygon.getPath()?.getArray?.() || [];
  const bounds = new window.google.maps.LatLngBounds();
  path.forEach((ll) => bounds.extend(ll));
  return bounds;
}

// Generic function to filter items (logs or sessions) inside an overlay
function filterItemsInside(type, overlay, items) {
  const gm = window.google.maps;
  const poly = gm.geometry?.poly;
  const spherical = gm.geometry?.spherical;

  let bb = null;
  if (type === "rectangle" || type === "circle") bb = overlay.getBounds?.();
  else if (type === "polygon") bb = buildPolygonBounds(overlay);

  // 1. Rough Bounds Check
  const pre = items.filter((item) => {
    const pt = toLatLng(item);
    return pt && (!bb || bb.contains(pt));
  });

  // 2. Exact Shape Check
  const inside = pre.filter((item) => {
    const pt = toLatLng(item);
    if (!pt) return false;
    if (type === "rectangle") return overlay.getBounds().contains(pt);
    if (type === "polygon") return poly?.containsLocation?.(pt, overlay) ?? false;
    if (type === "circle") {
      const d = spherical?.computeDistanceBetween?.(pt, overlay.getCenter());
      return Number.isFinite(d) && d <= overlay.getRadius();
    }
    return false;
  });

  return inside;
}

function analyzeInside(type, overlay, logs, selectedMetric) {
  const inside = filterItemsInside(type, overlay, logs);
  const vals = inside
    .map((l) => getMetricValue(l, selectedMetric))
    .filter((v) => Number.isFinite(v));
  return { inside, stats: computeStats(vals) };
}

function metersToDegLat(m) {
  return m / 111320;
}

function metersToDegLng(m, lat) {
  const metersPerDeg = 111320 * Math.cos((lat * Math.PI) / 180);
  return m / (metersPerDeg > 0 ? metersPerDeg : 111320);
}

function getShapeBounds(type, overlay) {
  if (type === "rectangle" || type === "circle") return overlay.getBounds();
  if (type === "polygon") return buildPolygonBounds(overlay);
  return null;
}

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
 * ============================================================================
 * GRID PIXELATION
 * ============================================================================
 */

function pixelateShape(
  type,
  overlay,
  logs,
  selectedMetric,
  thresholds,
  cellSizeMeters,
  map,
  gridOverlaysRef,
  colorizeCells
) {
  const gm = window.google.maps;
  const bounds = getShapeBounds(type, overlay);

  if (!bounds) {
    return { cellsDrawn: 0, totalCells: 0, cellsWithLogs: 0, cellData: [] };
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

  let cellsDrawn = 0;
  let cellsWithLogs = 0;
  const cellData = [];

  for (let i = 0; i < rows; i++) {
    const lat = south + i * stepLat;
    for (let j = 0; j < cols; j++) {
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
      let cellStats = null;

      if (inCell.length > 0) {
        cellsWithLogs++;
        const vals = inCell
          .map((x) => getMetricValue(x.log, selectedMetric))
          .filter((v) => Number.isFinite(v));

        if (vals.length > 0) {
          cellStats = computeStats(vals);
          const valueForColor = cellStats.mean;
          fillColor = colorizeCells
            ? pickColorForValue(valueForColor, selectedMetric, thresholds)
            : "#9ca3af";
          fillOpacity = 0.6;
        } else {
          fillColor = "#808080";
          fillOpacity = 0.3;
        }
      } else {
        fillColor = "#808080";
      }

      const rect = new gm.Rectangle({
        map,
        bounds: cellBounds,
        strokeWeight: 0.4,
        strokeColor: "#111827",
        fillOpacity: fillOpacity,
        fillColor: fillColor,
        clickable: true,
        zIndex: 50,
      });

      gridOverlaysRef.push(rect);
      cellsDrawn++;

      cellData.push({
        row: i,
        col: j,
        bounds: {
          south: lat,
          west: lng,
          north: lat + stepLat,
          east: lng + stepLng
        },
        center: { lat: cellCenter.lat(), lng: cellCenter.lng() },
        logsCount: inCell.length,
        stats: cellStats,
        color: fillColor,
        opacity: fillOpacity
      });
    }
  }

  return {
    cellsDrawn,
    totalCells: cellsDrawn,
    cellsWithLogs,
    cellData,
    gridRows: rows,
    gridCols: cols,
    cellSizeMeters,
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

/**
 * ============================================================================
 * MAIN COMPONENT
 * ============================================================================
 */

export default function DrawingToolsLayer({
  map,
  enabled,
  logs,
  sessions, // <--- NEW PROP
  selectedMetric,
  thresholds,
  pixelateRect = false,
  cellSizeMeters = 100,
  onSummary,
  onDrawingsChange,
  clearSignal = 0,
  colorizeCells = true,
}) {
  const managerRef = useRef(null);
  const shapesRef = useRef([]);
  const collectedDrawingRef = useRef([]);
  const lastClearSignalRef = useRef(clearSignal);
  const callbacksRef = useRef({ onSummary, onDrawingsChange });

  useEffect(() => {
    callbacksRef.current = { onSummary, onDrawingsChange };
  }, [onSummary, onDrawingsChange]);

  /**
   * Re-analyze a shape and update its grid
   */
  const reAnalyzeShape = useCallback((shapeObj) => {
    const { type, overlay, id } = shapeObj;
    const gm = window.google.maps;
    
    if (shapeObj.gridOverlays && shapeObj.gridOverlays.length > 0) {
      shapeObj.gridOverlays.forEach((rect) => rect?.setMap?.(null));
      shapeObj.gridOverlays = [];
    }

    const allLogs = logs || [];
    const geometry = serializeOverlay(type, overlay);
    
    // Analyze Logs
    const { inside, stats } = analyzeInside(type, overlay, allLogs, selectedMetric);
    
    // NEW: Analyze Sessions (intersecting markers)
    const intersectingSessions = filterItemsInside(type, overlay, sessions || []);

    // Extract unique sessions from LOGS (if logs exist)
    const uniqueSessionsMap = new Map();
    inside.forEach((log) => {
      const sessionKey = log.session_id;
      if (sessionKey && !uniqueSessionsMap.has(sessionKey)) {
        uniqueSessionsMap.set(sessionKey, log.session_id);
      }
    });
    const uniqueSessionsFromLogs = Array.from(uniqueSessionsMap.values());

    // Calculate Area
    let areaInMeters = 0;
    const spherical = gm.geometry?.spherical;
    if (spherical) {
      if (type === "polygon") {
        areaInMeters = spherical.computeArea(overlay.getPath());
      } else if (type === "rectangle") {
        const b = overlay.getBounds();
        const p = [
          b.getNorthEast(),
          new gm.LatLng(b.getNorthEast().lat(), b.getSouthWest().lng()),
          b.getSouthWest(),
          new gm.LatLng(b.getSouthWest().lat(), b.getNorthEast().lng())
        ];
        areaInMeters = spherical.computeArea(p);
      } else if (type === "circle") {
        areaInMeters = Math.PI * Math.pow(overlay.getRadius(), 2);
      }
    }

    // Grid pixelation
    let gridInfo = null;
    if (pixelateRect) {
      const gridResult = pixelateShape(
        type,
        overlay,
        allLogs,
        selectedMetric,
        thresholds,
        cellSizeMeters,
        map,
        shapeObj.gridOverlays,
        colorizeCells
      );
      
      const singleCellArea = cellSizeMeters * cellSizeMeters;
      const totalGridAreaWithLogs = singleCellArea * gridResult.cellsWithLogs;
      
      gridInfo = {
        cells: gridResult.cellsDrawn,
        cellsWithLogs: gridResult.cellsWithLogs,
        cellSizeMeters,
        totalGridArea: totalGridAreaWithLogs,
        gridRows: gridResult.gridRows,
        gridCols: gridResult.gridCols,
        cellData: gridResult.cellData,
      };
    }

    const entry = {
      id,
      type,
      geometry,
      selectedMetric,
      stats,
      count: inside.length,
      session: uniqueSessionsFromLogs,
      intersectingSessions, // <--- EXPOSE FOUND SESSIONS
      sessionCount: uniqueSessionsFromLogs.length,
      logs: inside,
      grid: gridInfo,
      createdAt: shapeObj.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      area: areaInMeters,
      areaInSqKm: (areaInMeters / 1000000).toFixed(4),
    };

    const existingIndex = collectedDrawingRef.current.findIndex(d => d.id === id);
    if (existingIndex >= 0) {
      collectedDrawingRef.current[existingIndex] = entry;
    } else {
      collectedDrawingRef.current.push(entry);
    }

    callbacksRef.current.onDrawingsChange?.([...collectedDrawingRef.current]);
    callbacksRef.current.onSummary?.(entry);

    return entry;
  }, [logs, sessions, selectedMetric, thresholds, pixelateRect, cellSizeMeters, map, colorizeCells]);

  // Main DrawingManager setup
  useEffect(() => {
    if (!map) return;
    const gm = window.google?.maps;
    if (!gm?.drawing?.DrawingManager) {
      toast.error('Drawing library not loaded.');
      return;
    }

    if (managerRef.current) {
      managerRef.current.setMap(null);
      managerRef.current = null;
    }

    if (!enabled) return;

    const dm = new gm.drawing.DrawingManager({
      drawingMode: null,
      drawingControl: true,
      drawingControlOptions: {
        position: gm.ControlPosition.TOP_CENTER,
        drawingModes: ["rectangle", "polygon", "circle"],
      },
      polygonOptions: { clickable: true, editable: true, draggable: true, strokeWeight: 2, strokeColor: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 0.08 },
      rectangleOptions: { clickable: true, editable: true, draggable: true, strokeWeight: 2, strokeColor: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 0.06 },
      circleOptions: { clickable: true, editable: true, draggable: true, strokeWeight: 2, strokeColor: "#1d4ed8", fillColor: "#1d4ed8", fillOpacity: 0.06 },
    });
    dm.setMap(map);

    const handleComplete = (e) => {
      const type = e.type;
      const overlay = e.overlay;
      const shapeId = Date.now();

      const shapeObj = {
        id: shapeId,
        type,
        overlay,
        gridOverlays: [],
        createdAt: new Date().toISOString(),
      };

      shapesRef.current.push(shapeObj);

      const entry = reAnalyzeShape(shapeObj);

      const listeners = [];
      if (type === "polygon") {
        const path = overlay.getPath();
        listeners.push(gm.event.addListener(path, 'set_at', () => reAnalyzeShape(shapeObj)));
        listeners.push(gm.event.addListener(path, 'insert_at', () => reAnalyzeShape(shapeObj)));
        listeners.push(gm.event.addListener(path, 'remove_at', () => reAnalyzeShape(shapeObj)));
      } else if (type === "rectangle") {
        listeners.push(gm.event.addListener(overlay, 'bounds_changed', () => reAnalyzeShape(shapeObj)));
      } else if (type === "circle") {
        listeners.push(gm.event.addListener(overlay, 'radius_changed', () => reAnalyzeShape(shapeObj)));
        listeners.push(gm.event.addListener(overlay, 'center_changed', () => reAnalyzeShape(shapeObj)));
      }

      shapeObj.listeners = listeners;
      dm.setDrawingMode(null);

      // Notification
      let msg = `${type.charAt(0).toUpperCase() + type.slice(1)} drawn.`;
      if(entry.intersectingSessions?.length > 0) {
        msg += ` Found ${entry.intersectingSessions.length} sessions inside.`;
      }
      toast.success(msg, { position: "bottom-right", autoClose: 3000 });
    };

    const listener = gm.event.addListener(dm, "overlaycomplete", handleComplete);
    managerRef.current = dm;

    return () => {
      gm.event.removeListener(listener);
      if (managerRef.current) {
        managerRef.current.setMap(null);
        managerRef.current = null;
      }
    };
  }, [map, enabled, reAnalyzeShape]);

  // Clear drawings effect
  useEffect(() => {
    if (clearSignal === 0 || clearSignal === lastClearSignalRef.current) return;
    lastClearSignalRef.current = clearSignal;
    
    shapesRef.current.forEach((shapeObj) => {
      if (shapeObj.listeners) {
        shapeObj.listeners.forEach(listener => window.google.maps.event.removeListener(listener));
      }
      shapeObj.overlay?.setMap?.(null);
      if (shapeObj.gridOverlays) {
        shapeObj.gridOverlays.forEach((rect) => rect?.setMap?.(null));
      }
    });

    shapesRef.current = [];
    collectedDrawingRef.current = [];
    callbacksRef.current.onDrawingsChange?.([]);
    callbacksRef.current.onSummary?.(null);
    toast.info('All drawings cleared', { position: "bottom-right", autoClose: 2000 });
  }, [clearSignal]);

  // Re-analyze on prop change
  useEffect(() => {
    if (shapesRef.current.length === 0) return;
    shapesRef.current.forEach((shapeObj) => {
      reAnalyzeShape(shapeObj);
    });
  }, [logs, sessions, selectedMetric, thresholds, pixelateRect, cellSizeMeters, colorizeCells, reAnalyzeShape]);

  return null;
}