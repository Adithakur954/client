import React, { useEffect, useRef } from "react";
import { toast } from "react-toastify";

// Helpers to read lat/lng and metric from your log object safely.
function toLatLng(log) {
  const lat =
    Number(log.lat ?? log.latitude ?? log.start_lat ?? log.Latitude ?? log.LAT);
  const lng =
    Number(log.lng ?? log.lon ?? log.longitude ?? log.start_lon ?? log.LNG);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return new window.google.maps.LatLng(lat, lng);
}

// Normalize metric keys between UI and data fields
function normalizeMetricKey(m) {
  if (!m) return "rsrp";
  const s = String(m).toLowerCase();
  if (s === "dl-throughput") return "dl_thpt";
  if (s === "ul-throughput") return "ul_thpt";
  if (s === "lte-bler") return "lte_bler";
  return s; // rsrp, rsrq, sinr, mos, dl_thpt, ul_thpt, lte_bler
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

// Color from thresholds or fallback
function pickColorForValue(value, selectedMetric, thresholds) {
  const key = normalizeMetricKey(selectedMetric);
  const arr = thresholds?.[key];
  if (Array.isArray(arr) && arr.length) {
    for (const t of arr) {
      const min = (t.min ?? t.from ?? Number.NEGATIVE_INFINITY);
      const max = (t.max ?? t.to ?? Number.POSITIVE_INFINITY);
      const val = t.value;
      if (Number.isFinite(val)) {
        if (value <= val) return t.color || "#4ade80";
      } else if (value >= min && value <= max) {
        return t.color || "#4ade80";
      }
    }
  }
  return "#93c5fd"; // fallback
}

function buildPolygonBounds(polygon) {
  const path = polygon.getPath()?.getArray?.() || [];
  const bounds = new window.google.maps.LatLngBounds();
  path.forEach((ll) => bounds.extend(ll));
  return bounds;
}

function analyzeInside(type, overlay, logs, selectedMetric) {
  const gm = window.google.maps;
  const poly = gm.geometry?.poly;
  const spherical = gm.geometry?.spherical;

  // Pre-filter by bounding box to save work
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

function metersToDegLat(m) {
  // ~111320 m per degree latitude
  return m / 111320;
}

function metersToDegLng(m, lat) {
  // ~111320 * cos(lat) m per degree longitude
  const metersPerDeg = 111320 * Math.cos((lat * Math.PI) / 180);
  if (metersPerDeg <= 0) return m / 111320; // fallback
  return m / metersPerDeg;
}

export default function DrawingToolsLayer({
  map,
  enabled,
  logs,
  selectedMetric,
  thresholds,
  pixelateRect = false,
  cellSizeMeters = 100,
  maxCells = 1200,
  onSummary, // ({ type, count, stats, grid?: { cells, cellSizeMeters } })
  clearSignal = 0, // increment to clear overlays from parent
  colorizeCells = true,
}) {
  const managerRef = useRef(null);
  const overlaysRef = useRef([]);

  // Create DrawingManager when enabled
  useEffect(() => {
    if (!map || !enabled || managerRef.current) return;

    const gm = window.google?.maps;
    if (!gm?.drawing?.DrawingManager) {
      console.warn('Google Maps drawing library not loaded. Add "drawing" to libraries and hard reload.');
      toast.error('Drawing library not loaded. Add "drawing" to GOOGLE_MAPS_LOADER_OPTIONS.libraries and hard reload.');
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

    const handleComplete = (e) => {
      // e.type is a string like "polygon" | "rectangle" | "circle"
      const type = e.type;
      const overlay = e.overlay;
      overlaysRef.current.push(overlay);

      const { inside, stats } = analyzeInside(type, overlay, logs || [], selectedMetric);
      onSummary?.({ type, count: inside.length, stats });

      // Pixelate rectangle if enabled
      if (type === "rectangle" && pixelateRect) {
        const bounds = overlay.getBounds();
        if (!bounds) return;

        const centerLat = bounds.getCenter().lat();
        const stepLat = metersToDegLat(cellSizeMeters);
        const stepLng = metersToDegLng(cellSizeMeters, centerLat);

        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const south = sw.lat();
        const west = sw.lng();
        const north = ne.lat();
        const east = ne.lng();

        // We will analyze only logs already inside the rectangle
        const baseInside = inside.map((l) => ({ log: l, pt: toLatLng(l) })).filter((x) => !!x.pt);

        const cols = Math.max(1, Math.ceil((east - west) / stepLng));
        const rows = Math.max(1, Math.ceil((north - south) / stepLat));
        const totalCells = cols * rows;
        if (totalCells > maxCells) {
          toast.warn(
            `Grid too dense (${totalCells} cells). Increase cell size or draw a smaller rectangle. Capping at ~${maxCells}.`
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

            const inCell = baseInside.filter((x) => cellBounds.contains(x.pt));
            const vals = inCell
              .map((x) => getMetricValue(x.log, selectedMetric))
              .filter((v) => Number.isFinite(v));

            if (!vals.length) continue;

            const statsCell = computeStats(vals);
            const fillColor = colorizeCells
              ? pickColorForValue(
                  statsCell.mean ?? statsCell.median ?? statsCell.max,
                  selectedMetric,
                  thresholds
                )
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

        onSummary?.({
          type,
          count: inside.length,
          stats,
          grid: { cells: Math.min(totalCells, maxCells), cellSizeMeters },
        });
      }

      // Set back to "hand" mode after drawing
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
  ]);

  // Clear overlays when asked
  useEffect(() => {
    if (!clearSignal) return;
    overlaysRef.current.forEach((o) => o?.setMap?.(null));
    overlaysRef.current = [];
    onSummary?.(null);
  }, [clearSignal, onSummary]);

  return null; // logic-only layer
}