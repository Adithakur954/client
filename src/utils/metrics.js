
const PCI_COLOR_PALETTE = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#F7DC6F", "#BB8FCE", "#85C1E2", "#F8B739", "#52BE80",
  "#EC7063", "#5DADE2", "#F39C12", "#A569BD", "#48C9B0",
  "#E74C3C", "#3498DB", "#E67E22", "#9B59B6", "#1ABC9C",
];


export const resolveMetricConfig = (key) => {
  const map = {
    rsrp: { field: "rsrp", thresholdKey: "rsrp", label: "RSRP", unit: "dBm" },
    rsrq: { field: "rsrq", thresholdKey: "rsrq", label: "RSRQ", unit: "dB" },
    sinr: { field: "sinr", thresholdKey: "sinr", label: "SINR", unit: "dB" },
    "dl-throughput": { field: "dl_tpt", thresholdKey: "dl_thpt", label: "DL Throughput", unit: "Mbps" },
    "ul-throughput": { field: "ul_tpt", thresholdKey: "ul_thpt", label: "UL Throughput", unit: "Mbps" },
      "dl_tpt": { field: "dl_tpt", thresholdKey: "dl_thpt", label: "DL Throughput", unit: "Mbps" },
    "ul_tpt": { field: "ul_tpt", thresholdKey: "ul_thpt", label: "UL Throughput", unit: "Mbps" },
    mos: { field: "mos", thresholdKey: "mos", label: "MOS", unit: "" },
    "lte-bler": { field: "bler", thresholdKey: "lte_bler", label: "LTE BLER", unit: "%" },
    "lte_bler": { field: "bler", thresholdKey: "lte_bler", label: "LTE BLER", unit: "%" },
    // --- ADD THIS LINE ---
    pci: { field: "pci", thresholdKey: "pci", label: "PCI", unit: "" },
  };
  return map[key?.toLowerCase()] || map.rsrp;
};

export const getColorForMetric = (metric, value, thresholds) => {
  console.log('🎨 === getColorForMetric DEBUG ===');
  console.log('  metric:', metric);
  console.log('  value:', value);
  console.log('  thresholds:', thresholds);
  console.log('  thresholds keys:', Object.keys(thresholds || {}));

  // PCI handling
  if (metric.toLowerCase() === 'pci') {
    const numValue = parseFloat(value);
    if (!Number.isFinite(numValue)) return "#808080";
    const pciInt = Math.floor(numValue);
    if (pciInt < 0 || pciInt > 503) return "#808080";
    return PCI_COLOR_PALETTE[pciInt % PCI_COLOR_PALETTE.length];
  }

  const config = resolveMetricConfig(metric);
  console.log('  resolved config:', config);
  
  const { thresholdKey } = config;
  console.log('  thresholdKey:', thresholdKey);
  
  const metricThresholds = thresholds?.[thresholdKey] || [];
  console.log('  metricThresholds:', metricThresholds);
  
  const numValue = parseFloat(value);
  console.log('  numValue:', numValue);
  
  if (!Number.isFinite(numValue) || metricThresholds.length === 0) {
    console.log('  ❌ Returning gray - invalid value or no thresholds');
    return "#808080";
  }
  
  const match = metricThresholds.find((t) => numValue >= t.min && numValue <= t.max);
  console.log('  match found:', match);
  
  const finalColor = match ? match.color : "#808080";
  console.log('  final color:', finalColor);
  
  return finalColor;
};