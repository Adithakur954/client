// src/components/map/MapLegend.jsx
import React from "react";
import { resolveMetricConfig } from "@/utils/metrics";

// ✅ Import COLOR_SCHEMES from sidebar
const COLOR_SCHEMES = {
  provider: {
    JIO: "#3B82F6",
    Airtel: "#EF4444",
    "VI India": "#22C55E",
    BSNL: "#F59E0B",
    Unknown: "#6B7280",    // Gray
  },
  technology: {
     // Purple
    "5G": "#EC4899",
    "4G": "#8B5CF6",
    "3G": "#10B981",
    "2G": "#6B7280",
    "Unknown": "#F59E0B",  
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
    "Unknown": "#6B7280",         
           
  },
};

const MapLegend = ({ 
  thresholds, 
  selectedMetric, 
  coverageHoleOnly = false,
  colorBy = null 
}) => {
  const { thresholdKey, label, unit } = resolveMetricConfig(selectedMetric);

  
  if (colorBy && COLOR_SCHEMES[colorBy]) {
    const scheme = COLOR_SCHEMES[colorBy];
    
    return (
      <div className="absolute top-10 left-4 z-10 rounded-lg border bg-white dark:bg-slate-950 dark:text-white p-3 shadow-xl">
        <div className="text-sm font-semibold mb-2 flex items-center gap-2">
          
          <span className="capitalize">{colorBy}</span>
        </div>
        <div className="space-y-1.5">
          {Object.entries(scheme).map(([key, color]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span 
                className="inline-block w-4 h-3 rounded border border-gray-300" 
                style={{ backgroundColor: color }} 
              />
              <span className="text-gray-700 dark:text-gray-200">{key}</span>
            </div>
          ))}
        </div>
        
      </div>
    );
  }

 
  if (selectedMetric === "coveragehole" || thresholdKey === "coveragehole") {
    const threshold = thresholds?.coveragehole || -110;
    
    return (
      <div className="absolute top-21 right-4 z-10 rounded-lg border bg-white dark:bg-slate-950 dark:text-white p-3 shadow">
        <div className="text-sm font-semibold mb-2">
          Coverage Hole (RSRP)
        </div>
        <div className="space-y-1">
          {coverageHoleOnly ? (
            // When filtering to show only coverage holes
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-block w-4 h-3 rounded" style={{ backgroundColor: "#FF0000" }} />
              <span>Coverage Hole (&lt; {threshold} dBm)</span>
            </div>
          ) : (
            // When showing all logs with coverage hole coloring
            <>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-4 h-3 rounded" style={{ backgroundColor: "#FF0000" }} />
                <span>Coverage Holes (&lt; {threshold} dBm)</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="inline-block w-4 h-3 rounded" style={{ backgroundColor: "#00FF00" }} />
                <span>Has Coverage (≥ {threshold} dBm)</span>
              </div>
            </>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
          Threshold: {threshold} dBm
        </div>
      </div>
    );
  }

  
  const list = thresholds?.[thresholdKey] || [];
  if (!list.length) return null;

  return (
    <div className="absolute top-21 right-4 z-10 rounded-lg border bg-white dark:bg-slate-950 dark:text-white p-3 shadow">
      <div className="text-sm font-semibold mb-2">
        {label} {unit ? `(${unit})` : ""}
      </div>
      <div className="space-y-1">
        {list.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="inline-block w-4 h-3 rounded" style={{ backgroundColor: t.color }} />
            <span>{t.range || t.label || `${t.min} to ${t.max}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;