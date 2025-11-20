// DrawingToolsLayer.jsx
import React, { useEffect, useRef } from "react";
import { toast } from "react-toastify";

/**
 * ============================================================================
 * TIME UTILITIES
 * ============================================================================
 */

/**
 * Extract timestamp from log object
 */
function getLogTimestamp(log) {
  const ts = log.timestamp || log.time || log.datetime || log.created_at || log.date;
  if (!ts) return null;
  const date = new Date(ts);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Get hour of day from timestamp (0-23)
 */
function getHourOfDay(date) {
  return date.getHours();
}

/**
 * Get day of week from timestamp (0-6, 0=Sunday)
 */
function getDayOfWeek(date) {
  return date.getDay();
}

/**
 * Filter logs by specific hour
 */
function filterLogsByHour(logs, hour) {
  if (!Array.isArray(logs)) return [];
  
  return logs.filter(log => {
    const ts = getLogTimestamp(log);
    if (!ts) return false;
    return getHourOfDay(ts) === hour;
  });
}

/**
 * Filter logs by time range
 */
function filterLogsByTimeRange(logs, startHour, endHour) {
  if (!Array.isArray(logs)) return [];
  if (startHour === 0 && endHour === 23) return logs; // All day
  
  return logs.filter(log => {
    const ts = getLogTimestamp(log);
    if (!ts) return false;
    
    const hour = getHourOfDay(ts);
    
    if (startHour <= endHour) {
      return hour >= startHour && hour <= endHour;
    } else {
      // Handle overnight range (e.g., 22:00 - 02:00)
      return hour >= startHour || hour <= endHour;
    }
  });
}

/**
 * Filter logs by day of week
 */
function filterLogsByDayOfWeek(logs, days = []) {
  if (!Array.isArray(logs) || days.length === 0) return logs;
  
  return logs.filter(log => {
    const ts = getLogTimestamp(log);
    if (!ts) return false;
    return days.includes(getDayOfWeek(ts));
  });
}

/**
 * Get time distribution of logs (hourly buckets)
 */
function getTimeDistribution(logs) {
  const hourCounts = Array(24).fill(0);
  
  logs.forEach(log => {
    const ts = getLogTimestamp(log);
    if (ts) {
      const hour = getHourOfDay(ts);
      hourCounts[hour]++;
    }
  });
  
  return hourCounts;
}

/**
 * Apply time filter based on time settings
 */
function applyTimeFilter(logs, timeSettings) {
  if (!timeSettings?.timeFilterEnabled) return logs;

  let filtered = logs;

  // Filter by day of week first
  if (timeSettings.selectedDays && timeSettings.selectedDays.length > 0 && timeSettings.selectedDays.length < 7) {
    filtered = filterLogsByDayOfWeek(filtered, timeSettings.selectedDays);
  }

  // Then filter by time mode
  if (timeSettings.timeMode === 'single') {
    filtered = filterLogsByHour(filtered, timeSettings.currentHour);
  } else if (timeSettings.timeMode === 'range') {
    const [start, end] = timeSettings.timeRange || [0, 23];
    filtered = filterLogsByTimeRange(filtered, start, end);
  }
  // 'all' mode doesn't filter by hour

  return filtered;
}

/**
 * Analyze temporal patterns
 */
function analyzeTemporalPatterns(logs) {
  const hourly = Array(24).fill(0).map(() => []);
  const daily = Array(7).fill(0).map(() => []);
  
  logs.forEach(log => {
    const ts = getLogTimestamp(log);
    if (!ts) return;
    
    const hour = getHourOfDay(ts);
    const day = getDayOfWeek(ts);
    
    hourly[hour].push(log);
    daily[day].push(log);
  });
  
  const hourCounts = hourly.map(h => h.length);
  const dayCounts = daily.map(d => d.length);
  
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  const peakDay = dayCounts.indexOf(Math.max(...dayCounts));
  
  return {
    hourly,
    daily,
    hourCounts,
    dayCounts,
    peakHour,
    peakDay,
  };
}

/**
 * ============================================================================
 * GEO UTILITIES
 * ============================================================================
 */

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
 * ============================================================================
 * GRID PIXELATION WITH TIME SUPPORT
 * ============================================================================
 */

/**
 * Create a grid over the drawn shape and color cells by metric stats.
 * Now supports time-based filtering for each cell.
 */
function pixelateShape(
  type,
  overlay,
  logs,
  selectedMetric,
  thresholds,
  cellSizeMeters,
  map,
  overlaysRef,
  colorizeCells,
  timeSettings = null
) {
  const gm = window.google.maps;
  const bounds = getShapeBounds(type, overlay);

  if (!bounds) {
    console.warn("Could not determine bounds for shape");
    return { cellsDrawn: 0, totalCells: 0, cellsWithLogs: 0, cellData: [] };
  }

  const centerLat = bounds.getCenter().lat();
  const stepLat = metersToDegLat(cellSizeMeters);
  const stepLng = metersToDegLng(cellSizeMeters, centerLat);

  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const south = sw.lat(), west = sw.lng(), north = ne.lat(), east = ne.lng();

  // Apply time filter to logs first
  const timeFilteredLogs = timeSettings?.timeFilterEnabled 
    ? applyTimeFilter(logs, timeSettings)
    : logs;

  const preFilteredLogs = timeFilteredLogs
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
        clickable: true,
        zIndex: 50,
      });

      // Add click listener to show cell info
      gm.event.addListener(rect, 'click', () => {
        console.log('Cell clicked:', {
          row: i,
          col: j,
          center: { lat: cellCenter.lat(), lng: cellCenter.lng() },
          logsCount: inCell.length,
          stats: cellStats,
          logs: inCell.map(x => x.log)
        });
      });

      overlaysRef.current.push(rect);
      cellsDrawn++;

      // Store cell data for analysis
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

/**
 * Serialize overlay to JSON
 */
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
  selectedMetric,
  thresholds,
  pixelateRect = false,
  cellSizeMeters = 100,
  onSummary,
  onDrawingsChange,
  clearSignal = 0,
  colorizeCells = true,
  // Time-based props
  timeSettings = null,
  onTimeAnalysis = null,
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
      polygonOptions: {
        clickable: false,
        strokeWeight: 2,
        strokeColor: "#1d4ed8",
        fillColor: "#1d4ed8",
        fillOpacity: 0.08
      },
      rectangleOptions: {
        clickable: false,
        strokeWeight: 2,
        strokeColor: "#1d4ed8",
        fillColor: "#1d4ed8",
        fillOpacity: 0.06
      },
      circleOptions: {
        clickable: false,
        strokeWeight: 2,
        strokeColor: "#1d4ed8",
        fillColor: "#1d4ed8",
        fillOpacity: 0.06
      },
    });
    dm.setMap(map);

    const handleComplete = (e) => {
      const type = e.type;
      const overlay = e.overlay;
      overlaysRef.current.push(overlay);

      const allLogs = logs || [];
      
      // Apply time filter to logs before analysis
      const timeFilteredLogs = timeSettings?.timeFilterEnabled 
        ? applyTimeFilter(allLogs, timeSettings)
        : allLogs;

      const geometry = serializeOverlay(type, overlay);
      const { inside, stats } = analyzeInside(type, overlay, timeFilteredLogs, selectedMetric);
      
      // Extract unique sessions
      const uniqueSessionsMap = new Map();
      inside.forEach((log) => {
        const sessionKey = log.session_id;
        if (sessionKey && !uniqueSessionsMap.has(sessionKey)) {
          uniqueSessionsMap.set(sessionKey, log.session_id);
        }
      });
      const uniqueSessions = Array.from(uniqueSessionsMap.values());
      const uniqueSessionCount = uniqueSessions.length;

      // Temporal analysis
      const timeDistribution = getTimeDistribution(inside);
      const temporalPatterns = analyzeTemporalPatterns(inside);

      console.log("📍 Points inside shape:", {
        total: inside.length,
        sessions: uniqueSessionCount,
        timeFiltered: timeSettings?.timeFilterEnabled,
        distribution: timeDistribution
      });
      
      // Calculate area
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
          allLogs, // Pass all logs, filtering happens inside
          selectedMetric,
          thresholds,
          cellSizeMeters,
          map,
          overlaysRef,
          colorizeCells,
          timeSettings
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

      // Create analysis entry
      const entry = {
        id: Date.now(),
        type,
        geometry,
        selectedMetric,
        stats,
        count: inside.length,
        session: uniqueSessions,
        sessionCount: uniqueSessionCount,
        logs: inside,
        grid: gridInfo,
        createdAt: new Date().toISOString(),
        area: areaInMeters,
        areaInSqKm: (areaInMeters / 1000000).toFixed(4),
        // Time-based data
        timeFilter: timeSettings?.timeFilterEnabled ? {
          mode: timeSettings.timeMode,
          currentHour: timeSettings.currentHour,
          timeRange: timeSettings.timeRange,
          selectedDays: timeSettings.selectedDays,
        } : null,
        timeDistribution,
        temporalPatterns: {
          peakHour: temporalPatterns.peakHour,
          peakDay: temporalPatterns.peakDay,
          hourCounts: temporalPatterns.hourCounts,
          dayCounts: temporalPatterns.dayCounts,
        },
        totalLogsBeforeTimeFilter: allLogs.length,
        logsAfterTimeFilter: timeFilteredLogs.length,
        logsInsideShape: inside.length,
      };

      collectedDrawingRef.current.push(entry);
      onDrawingsChange?.([...collectedDrawingRef.current]);
      onSummary?.(entry);
      onTimeAnalysis?.(entry.temporalPatterns);
      
      dm.setDrawingMode(null);

      // Show success toast
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} drawn: ${inside.length} logs found`, {
        position: "bottom-right",
        autoClose: 3000,
      });
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
    onSummary,
    onDrawingsChange,
    colorizeCells,
    timeSettings,
    onTimeAnalysis
  ]);

  // Clear drawings effect
  useEffect(() => {
    if (!clearSignal) return;
    
    overlaysRef.current.forEach((o) => o?.setMap?.(null));
    overlaysRef.current = [];
    collectedDrawingRef.current = [];
    onDrawingsChange?.([]);
    onSummary?.(null);
    
    toast.info('All drawings cleared', {
      position: "bottom-right",
      autoClose: 2000,
    });
  }, [clearSignal, onDrawingsChange, onSummary]);

  // Re-render grid when time settings change
  useEffect(() => {
    if (!timeSettings?.timeFilterEnabled || !pixelateRect) return;
    if (collectedDrawingRef.current.length === 0) return;

    // Get the last drawn shape
    const lastDrawing = collectedDrawingRef.current[collectedDrawingRef.current.length - 1];
    
    // Clear only grid rectangles (keep the main shape)
    const mainShapesCount = collectedDrawingRef.current.length;
    const gridRectangles = overlaysRef.current.slice(mainShapesCount);
    gridRectangles.forEach((rect) => rect?.setMap?.(null));
    overlaysRef.current = overlaysRef.current.slice(0, mainShapesCount);

    // Redraw grid with new time filter
    // This would require storing the overlay reference, which we don't have here
    // So this is a placeholder for future enhancement
    console.log('Time settings changed, grid should be redrawn');
    
  }, [timeSettings, pixelateRect]);

  return null;
}