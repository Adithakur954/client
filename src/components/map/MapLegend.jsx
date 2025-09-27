// src/components/map/MapLegend.jsx
import React from "react";
import { resolveMetricConfig } from "@/utils/metrics";

const MapLegend = ({ thresholds, selectedMetric }) => {
  const { thresholdKey, label, unit } = resolveMetricConfig(selectedMetric);
  const list = thresholds?.[thresholdKey] || [];
  if (!list.length) return null;

  return (
    <div className="absolute bottom-4 right-4 z-10 rounded-lg border bg-white dark:bg-slate-950 dark:text-white p-3 shadow">
      <div className="text-sm font-semibold mb-2">
        {label} {unit ? `(${unit})` : ""}
      </div>
      <div className="space-y-1">
        {list.map((t, idx) => (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <span className="inline-block w-4 h-3 rounded" style={{ backgroundColor: t.color }} />
            <span>{t.range || `${t.min} to ${t.max}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MapLegend;