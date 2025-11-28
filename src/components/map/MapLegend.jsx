// src/components/MapLegend.jsx
import React from "react";
import { resolveMetricConfig } from "@/utils/metrics";
import { PCI_COLOR_PALETTE } from "./layers/MultiColorCirclesLayer"; 


const COLOR_SCHEMES = {
  provider: {
    JIO: "#3B82F6",
    Airtel: "#EF4444",
    "IND airtel": "#EF4444",
    "VI India": "#22C55E",
    BSNL: "#F59E0B",
    Unknown: "#6B7280",
  },
  technology: {
    "5G": "#EC4899",
    
    "4G": "#8B5CF6",
    
    "3G": "#10B981",
    "2G": "#6B7280",
    
    Unknown: "#F59E0B",
    
  },
  band: {
    "3": "#EF4444",
    "5": "#F59E0B",
    "8": "#10B981",
    "40": "#3B82F6",
    "41": "#8B5CF6",
    "n28": "#EC4899",
    "n78": "#F472B6",
    "1": "#EF4444",
    "2": "#F59E0B",
    "7": "#10B781",
    Unknown: "#6B7280",
  },
};
// --- End of copied block ---

// Legend for "Color By" (Provider, Tech, Band)
const ColorSchemeLegend = ({ colorBy }) => {
  const scheme = COLOR_SCHEMES[colorBy];
  if (!scheme) return null;

  return (
    <div>
      <div className="text-sm font-semibold mb-2 capitalize">{colorBy}</div>
      <div className="space-y-1.5">
        {Object.entries(scheme).map(([key, color]) => (
          <div key={key} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block w-4 h-3 rounded border border-gray-300"
              style={{ backgroundColor: color }}
            />
            <span className="text-gray-200">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PciLegend = () => (
  <div>
    <div className="font-semibold text-sm mb-2">PCI Color Map</div>
    <div className="text-xs text-white mb-2">
      Each PCI value cycles through 20 colors
    </div>
    <div className="grid grid-cols-5 gap-1">
      {PCI_COLOR_PALETTE.map((color, idx) => (
        <div key={idx} className="flex flex-row text-white items-center">
          <div
            className="w-6 h-6 rounded-full border border-gray-300"
            style={{ backgroundColor: color }}
          />
          <span className="text-[9px] text-white mt-0.5">{idx}</span>
        </div>
      ))}
    </div>
  </div>
);

// Legend for standard metrics (RSRP, RSRQ, etc.)
const MetricThresholdLegend = ({ thresholds, selectedMetric }) => {
  const { thresholdKey, label, unit } = resolveMetricConfig(selectedMetric);
  const list = thresholds?.[thresholdKey] || [];

  if (!list.length) {
    // Don't show anything if no thresholds are defined for this metric
    return null;
  }

  return (
    <div>
      <div className="text-sm font-semibold mb-2">
        {label} {unit ? `(${unit})` : ""}
      </div>
      <div className="space-y-1">
        {list.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span
              className="inline-block w-4 h-3 rounded"
              style={{ backgroundColor: t.color }}
            />
            <span className="text-gray-200">
              {t.range || t.label || `${t.min} to ${t.max}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- Main Component ---
// This component now decides which legend to show.
export default function MapLegend({
  thresholds,
  selectedMetric,
  colorBy = null,
}) {
  let content = null;

  if (colorBy) {
    content = <ColorSchemeLegend colorBy={colorBy} />;
  } else if (selectedMetric === "pci") {
    content = <PciLegend />;
  } else {
    content = (
      <MetricThresholdLegend
        thresholds={thresholds}
        selectedMetric={selectedMetric}
      />
    );
  }

  if (!content) {
    return null; // Don't render an empty box
  }

  return (
    <div className="absolute top-30 left-4 z-10 rounded-lg border bg-slate-950 text-white p-3 shadow-xl max-w-xs">
      {content}
    </div>
  );
}