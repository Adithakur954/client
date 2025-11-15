// src/utils/metrics.js

// Import the coloring logic from the other layer (or move palette to a shared file)
// For this fix, I'll copy the palette to avoid import issues.

// ADD THIS: Copied from MultiColorCirclesLayer.jsx
const PCI_COLOR_PALETTE = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52BE80",
  "#EC7063", "#5DADE2", "#F39C12", "#A569BD", "#48C9B0",
  "#E74C3C", "#3498DB", "#E67E22", "#9B59B6", "#1ABC9C",
];

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
    // --- ADD THIS LINE ---
    pci: { field: "pci", thresholdKey: "pci", label: "PCI", unit: "" },
  };
  return map[key?.toLowerCase()] || map.rsrp;
};

export const getColorForMetric = (metric, value, thresholds) => {
  // --- ADD THIS ENTIRE IF-BLOCK FOR PCI ---
  if (metric.toLowerCase() === 'pci') {
    const numValue = parseFloat(value);
    if (!Number.isFinite(numValue)) return "#808080"; // gray
    const pciInt = Math.floor(numValue);
    if (pciInt < 0 || pciInt > 503) return "#808080"; // gray for out of range
    // Use modulo to cycle through the 20 colors
    return PCI_COLOR_PALETTE[pciInt % PCI_COLOR_PALETTE.length];
  }
  // --- END OF ADDED BLOCK ---

  const { thresholdKey } = resolveMetricConfig(metric);
  const metricThresholds = thresholds?.[thresholdKey] || [];
  const numValue = parseFloat(value);
  if (!Number.isFinite(numValue) || metricThresholds.length === 0) return "#808080";
  const match = metricThresholds.find((t) => numValue >= t.min && numValue <= t.max);
  return match ? match.color : "#808080";
};