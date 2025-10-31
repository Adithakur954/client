// src/components/map/MapLegend.jsx
import React from "react";
import { resolveMetricConfig } from "@/utils/metrics";

const MapLegend = ({ thresholds, selectedMetric, coverageHoleOnly = false }) => {
  const { thresholdKey, label, unit } = resolveMetricConfig(selectedMetric);

  // ✅ Special handling for Coverage Hole metric
  if (selectedMetric === "coveragehole" || thresholdKey === "coveragehole") {
    const threshold = thresholds?.coveragehole || -110;
    
    return (
      <div className="absolute bottom-4 right-4 z-10 rounded-lg border bg-white dark:bg-slate-950 dark:text-white p-3 shadow">
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
                <span>Coverage Hole (&lt; {threshold} dBm)</span>
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

  // ✅ Standard legend for other metrics
  const list = thresholds?.[thresholdKey] || [];
  if (!list.length) return null;

  return (
    <div className="absolute top-21  right-4 z-10 rounded-lg border bg-white dark:bg-slate-950 dark:text-white p-3 shadow">
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