// src/utils/metrics.js

// Metric mapping (keep in sync with backend/thresholds)
export const resolveMetricConfig = (key) => {
  const map = {
    rsrp: { field: "rsrp", thresholdKey: "rsrp", label: "RSRP", unit: "dBm" },
    rsrq: { field: "rsrq", thresholdKey: "rsrq", label: "RSRQ", unit: "dB" },
    sinr: { field: "sinr", thresholdKey: "sinr", label: "SINR", unit: "dB" },
    "dl-throughput": { field: "dl_tpt", thresholdKey: "dl_thpt", label: "DL Throughput", unit: "Mbps" },
    "ul-throughput": { field: "ul_tpt", thresholdKey: "ul_thpt", label: "UL Throughput", unit: "Mbps" },
    mos: { field: "mos", thresholdKey: "mos", label: "MOS", unit: "" },
    "lte-bler": { field: "bler", thresholdKey: "lte_bler", label: "LTE BLER", unit: "%" },
  };
  return map[key?.toLowerCase()] || map.rsrp;
};

export const getColorForMetric = (metric, value, thresholds) => {
  const { thresholdKey } = resolveMetricConfig(metric);
  const metricThresholds = thresholds?.[thresholdKey] || [];
  const numValue = parseFloat(value);
  if (!Number.isFinite(numValue) || metricThresholds.length === 0) return "#808080";
  const match = metricThresholds.find((t) => numValue >= t.min && numValue <= t.max);
  return match ? match.color : "#808080";
};