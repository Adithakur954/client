// src/components/map/layers/MultiColorCirclesLayer.jsx
import React from "react";
import { Circle, InfoWindow } from "@react-google-maps/api";

// helper to parse numbers like "-88 dBm"
const parseNumber = (x) => {
  if (x == null) return NaN;
  const s = String(x).replace(/[^\d.+-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

const thresholdsKeyFor = (metric) => {
  switch (metric) {
    case "dl-throughput": return "dl_thpt";
    case "ul-throughput": return "ul_thpt";
    case "lte-bler":      return "lte_bler";
    default:              return metric; // rsrp, rsrq, sinr, mos
  }
};

// fallback ramps per metric (used if thresholds missing)
const fallbackColor = (metric, v) => {
  const n = parseNumber(v);
  if (!Number.isFinite(n)) return "#9ca3af";

  switch (metric) {
    case "rsrp":
      if (n < -115) return "#ef4444";
      if (n <= -105) return "#f59e0b";
      if (n <= -95)  return "#fde047";
      if (n <= -90)  return "#1d4ed8";
      if (n <= -85)  return "#60a5fa";
      if (n <= -75)  return "#86efac";
      return "#065f46";
    case "rsrq":
      if (n < -16) return "#ef4444";
      if (n < -12) return "#f59e0b";
      if (n < -9)  return "#fde047";
      if (n < -6)  return "#60a5fa";
      if (n < -3)  return "#93c5fd";
      return "#065f46";
    case "sinr":
      if (n < 0)  return "#ef4444";
      if (n < 5)  return "#f59e0b";
      if (n < 10) return "#fde047";
      if (n < 15) return "#60a5fa";
      if (n < 20) return "#93c5fd";
      return "#065f46";
    case "dl-throughput":
    case "ul-throughput":
      if (n < 1)  return "#ef4444";
      if (n < 5)  return "#f59e0b";
      if (n < 15) return "#fde047";
      if (n < 30) return "#60a5fa";
      if (n < 60) return "#93c5fd";
      return "#065f46";
    case "mos":
      if (n < 2)   return "#ef4444";
      if (n < 3)   return "#f59e0b";
      if (n < 3.5) return "#fde047";
      if (n < 4)   return "#60a5fa";
      return "#065f46";
    case "lte-bler":
      if (n > 10) return "#ef4444";
      if (n > 5)  return "#f59e0b";
      if (n > 2)  return "#fde047";
      if (n > 1)  return "#60a5fa";
      return "#065f46";
    default:
      return "#9ca3af";
  }
};

// Read metric value from the location object (support common field names)
const pickMetricValue = (location, metric) => {
  const tryKeys = (keys) => {
    for (const k of keys) {
      const v = location?.[k];
      if (v != null && v !== "") return v;
    }
    return null;
  };

  switch (metric) {
    case "rsrp": return tryKeys(["rsrp", "RSRP", "rsrp_dbm", "m_rsrp", "signal_rsrp"]);
    case "rsrq": return tryKeys(["rsrq", "RSRQ"]);
    case "sinr": return tryKeys(["sinr", "SINR"]);
    case "dl-throughput":
      return tryKeys(["dl_thpt", "dl_tpt", "DL", "dl", "download", "download_throughput"]);
    case "ul-throughput":
      return tryKeys(["ul_thpt", "ul_tpt", "UL", "ul", "upload", "upload_throughput"]);
    case "mos": return tryKeys(["mos", "MOS"]);
    case "lte-bler": return tryKeys(["lte_bler", "LTE_BLER", "bler"]);
    default: return null;
  }
};

// Supports {min,max,color} | {from,to,color} | {gte,color} | {lte,color}
const colorFromThresholds = (value, metric, thresholds) => {
  const v = parseNumber(value);
  const list = thresholds?.[thresholdsKeyFor(metric)] || [];
  if (!Number.isFinite(v) || !Array.isArray(list) || list.length === 0) {
    return fallbackColor(metric, value);
  }
  for (const seg of list) {
    const min = parseNumber(seg.min ?? seg.from ?? seg.gte ?? Number.NEGATIVE_INFINITY);
    const max = parseNumber(seg.max ?? seg.to ?? seg.lte ?? Number.POSITIVE_INFINITY);
    const minOk = Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY;
    const maxOk = Number.isFinite(max) ? max : Number.POSITIVE_INFINITY;
    if (v >= minOk && v <= maxOk) return seg.color || fallbackColor(metric, value);
  }
  return fallbackColor(metric, value);
};

export default function MultiColorCirclesLayer({
  locations = [],
  thresholds = {},
  selectedMetric = "rsrp",
  activeIndex = null,
  onMarkerClick = () => {},
  getRadius = () => 30, // (zoom) => number
  showInfoWindow = true,
}) {
  return (
    <>
      {locations.map((loc, index) => {
        const radius = Number(loc.radius) || getRadius(loc.zoom || 14);
        const metricValue = pickMetricValue(loc, selectedMetric);
        const fill = colorFromThresholds(metricValue, selectedMetric, thresholds);

        return (
          <React.Fragment key={`circ-${index}`}>
            <Circle
              center={{ lat: loc.lat, lng: loc.lng }}
              onClick={() => onMarkerClick(index)}
              options={{
                strokeWeight: 0,
                fillColor: fill,
                fillOpacity: 0.8,
                radius,
              }}
            />
            {showInfoWindow && activeIndex === index && (
              <InfoWindow
                position={{ lat: loc.lat, lng: loc.lng }}
                onCloseClick={() => onMarkerClick(null)}
              >
                <div style={{ padding: 4, maxWidth: 240 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>Point Info</div>
                  <div style={{ fontSize: 12, lineHeight: 1.4 }}>
                    <div><strong>Time:</strong> {loc.timestamp ? new Date(loc.timestamp).toLocaleString() : "N/A"}</div>
                    <div><strong>RSRP:</strong> {loc.rsrp ?? "N/A"}</div>
                    <div><strong>RSRQ:</strong> {loc.rsrq ?? "N/A"}</div>
                    <div><strong>SINR:</strong> {loc.sinr ?? "N/A"}</div>
                    <div><strong>DL Tpt:</strong> {loc.dl_thpt ?? loc.dl ?? loc.download ?? "N/A"}</div>
                    <div><strong>UL Tpt:</strong> {loc.ul_thpt ?? loc.ul ?? loc.upload ?? "N/A"}</div>
                    <div><strong>MOS:</strong> {loc.mos ?? "N/A"}</div>
                    <div><strong>LTE BLER:</strong> {loc.lte_bler ?? loc.bler ?? "N/A"}</div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}