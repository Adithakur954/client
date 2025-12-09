// src/components/map/MapLegend.jsx
import React, { useMemo, useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import {
  PCI_COLOR_PALETTE,
  COLOR_SCHEMES,
  getMetricConfig,
  getMetricValueFromLog,
} from "@/utils/metrics";

// ✅ Normalization helpers
const normalizeProviderName = (raw) => {
  if (!raw) return "Unknown";
  const s = String(raw).trim().toUpperCase().replace(/[\s\-_]/g, "");
  if (s.includes("JIO")) return "JIO";
  if (s.includes("AIRTEL")) return "Airtel";
  if (s.includes("VI") || s.includes("VODAFONE") || s.includes("IDEA")) return "Vi India";
  if (s.includes("BSNL")) return "BSNL";
  return "Unknown";
};

const normalizeTechName = (raw) => {
  if (!raw) return "Unknown";
  const s = String(raw).trim().toUpperCase();
  if (s.includes("5G") || s.includes("NR")) return "5G";
  if (s.includes("4G") || s.includes("LTE")) return "4G";
  if (s.includes("3G")) return "3G";
  if (s.includes("2G")) return "2G";
  return "Unknown";
};

// ✅ Color Scheme Legend - Only shows used colors
const ColorSchemeLegend = ({ colorBy, logs }) => {
  const scheme = COLOR_SCHEMES[colorBy];
  if (!scheme) return null;

  const { counts, total, usedEntries } = useMemo(() => {
    const tempCounts = {};
    Object.keys(scheme).forEach((k) => (tempCounts[k] = 0));

    if (Array.isArray(logs)) {
      logs.forEach((log) => {
        let key = "Unknown";
        if (colorBy === "provider") {
          key = normalizeProviderName(log.provider || log.Provider || log.carrier);
        } else if (colorBy === "technology") {
          key = normalizeTechName(log.network || log.Network || log.technology);
        } else if (colorBy === "band") {
          const b = String(log.band || log.Band || "").trim();
          key = scheme[b] ? b : "Unknown";
        }

        if (!scheme[key]) {
          const match = Object.keys(scheme).find(
            (k) => k.toLowerCase() === String(key).toLowerCase()
          );
          key = match || "Unknown";
        }

        if (tempCounts[key] !== undefined) {
          tempCounts[key]++;
        }
      });
    }

    const used = Object.entries(scheme)
      .filter(([key]) => tempCounts[key] > 0)
      .sort((a, b) => tempCounts[b[0]] - tempCounts[a[0]]);

    return { counts: tempCounts, total: logs?.length || 0, usedEntries: used };
  }, [logs, colorBy, scheme]);

  if (usedEntries.length === 0) {
    return (
      <div className="text-xs text-white text-center py-3">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto max-h-[200px] space-y-0.5 pr-1 custom-scrollbar">
        {usedEntries.map(([key, color]) => {
          const count = counts[key];
          const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;

          return (
            <div
              key={key}
              className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-white/5 transition-colors"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-white flex-1 truncate">{key}</span>
              <span className="text-sm tabular-nums text-white min-w-[36px] text-right">
                {count.toLocaleString()}
              </span>
              <span className="text-sm tabular-nums text-white min-w-[32px] text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-gray-700/50 flex justify-between px-1">
        <span className="text-[10px] text-white">Total</span>
        <span className="text-[10px] tabular-nums text-white">{total.toLocaleString()}</span>
      </div>
    </div>
  );
};

// ✅ PCI Legend - Scrollable list
const PciLegend = ({ logs }) => {
  const pciStats = useMemo(() => {
    const pciMap = new Map();
    let validCount = 0;
    let invalidCount = 0;

    if (Array.isArray(logs)) {
      logs.forEach((log) => {
        const pci = getMetricValueFromLog(log, "pci");
        if (Number.isFinite(pci)) {
          const pciInt = Math.floor(pci);
          pciMap.set(pciInt, (pciMap.get(pciInt) || 0) + 1);
          validCount++;
        } else {
          invalidCount++;
        }
      });
    }

    const sorted = [...pciMap.entries()].sort((a, b) => b[1] - a[1]);

    return {
      allPcis: sorted,
      uniqueCount: pciMap.size,
      validCount,
      invalidCount,
      total: logs?.length || 0,
    };
  }, [logs]);

  const getPciColor = (pci) =>
    PCI_COLOR_PALETTE[Math.abs(Math.floor(pci)) % PCI_COLOR_PALETTE.length];

  if (pciStats.allPcis.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-3">
        No PCI data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable PCI list */}
      <div className="flex-1 overflow-y-auto max-h-[200px] space-y-0.5 pr-1 custom-scrollbar">
        {pciStats.allPcis.map(([pci, count]) => {
          const pct = pciStats.validCount > 0
            ? ((count / pciStats.validCount) * 100).toFixed(1)
            : 0;

          return (
            <div
              key={pci}
              className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-white/5 transition-colors"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: getPciColor(pci) }}
              />
              <span className="text-[11px] tabular-nums text-gray-200 flex-1">
                {pci}
              </span>
              <span className="text-sm tabular-nums text-white min-w-[36px] text-right">
                {count.toLocaleString()}
              </span>
              <span className="text-sm tabular-nums text-white min-w-[32px] text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-gray-700/50 space-y-1 px-1">
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-500">Unique</span>
          <span className="text-[10px] tabular-nums text-gray-400">{pciStats.uniqueCount}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-500">Total</span>
          <span className="text-[10px] tabular-nums text-gray-400">{pciStats.validCount.toLocaleString()}</span>
        </div>
        {pciStats.invalidCount > 0 && (
          <div className="flex justify-between">
            <span className="text-[10px] text-gray-500">No PCI</span>
            <span className="text-[10px] tabular-nums text-amber-400/80">{pciStats.invalidCount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ✅ Metric Threshold Legend - Scrollable
const MetricThresholdLegend = ({ thresholds, selectedMetric, logs }) => {
  const config = getMetricConfig(selectedMetric);
  const { thresholdKey } = config;
  const list = thresholds?.[thresholdKey] || [];

  const { counts, validCount, invalidCount, usedThresholds } = useMemo(() => {
    if (!logs?.length || !list.length) {
      return { counts: [], validCount: 0, invalidCount: 0, usedThresholds: [] };
    }

    const tempCounts = new Array(list.length).fill(0);
    let valid = 0;
    let invalid = 0;

    logs.forEach((log) => {
      const val = getMetricValueFromLog(log, selectedMetric);

      if (!Number.isFinite(val)) {
        invalid++;
        return;
      }

      valid++;
      let matched = false;

      for (let idx = 0; idx < list.length; idx++) {
        const t = list[idx];
        const min = parseFloat(t.min);
        const max = parseFloat(t.max);

        if (Number.isFinite(min) && Number.isFinite(max) && val >= min && val <= max) {
          tempCounts[idx]++;
          matched = true;
          break;
        }
      }

      if (!matched) {
        const mins = list.map((t) => parseFloat(t.min)).filter(Number.isFinite);
        const maxs = list.map((t) => parseFloat(t.max)).filter(Number.isFinite);

        if (mins.length && maxs.length) {
          const lowestMin = Math.min(...mins);
          const highestMax = Math.max(...maxs);

          if (val < lowestMin) {
            const idx = list.findIndex((t) => parseFloat(t.min) === lowestMin);
            if (idx !== -1) tempCounts[idx]++;
          } else if (val > highestMax) {
            const idx = list.findIndex((t) => parseFloat(t.max) === highestMax);
            if (idx !== -1) tempCounts[idx]++;
          }
        }
      }
    });

    const used = list
      .map((t, idx) => ({ ...t, idx, count: tempCounts[idx] }))
      .filter((t) => t.count > 0);

    return { counts: tempCounts, validCount: valid, invalidCount: invalid, usedThresholds: used };
  }, [logs, list, selectedMetric]);

  if (!list.length) {
    return (
      <div className="text-xs text-gray-500 text-center py-3">
        No thresholds configured
      </div>
    );
  }

  if (usedThresholds.length === 0) {
    return (
      <div className="text-xs text-gray-500 text-center py-3">
        No data available
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable threshold list */}
      <div className="flex-1 overflow-y-auto max-h-[200px] space-y-0.5 pr-1 custom-scrollbar">
        {usedThresholds.map((t) => {
          const pct = validCount > 0 ? ((t.count / validCount) * 100).toFixed(1) : 0;

          return (
            <div
              key={t.idx}
              className="flex items-center gap-3 py-1.5 px-1 rounded hover:bg-white/5 transition-colors"
            >
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: t.color }}
              />
              <span className="text-[11px] text-gray-200 flex-1 truncate">
                {t.range || t.label || `${t.min} → ${t.max}`}
              </span>
              <span className="text-sm tabular-nums text-white min-w-[36px] text-right">
                {t.count.toLocaleString()}
              </span>
              <span className="text-sm tabular-nums text-white min-w-[32px] text-right">
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="pt-2 mt-2 border-t border-gray-700/50 space-y-1 px-1">
        <div className="flex justify-between">
          <span className="text-[10px] text-gray-500">Total</span>
          <span className="text-[10px] tabular-nums text-gray-400">{validCount.toLocaleString()}</span>
        </div>
        {invalidCount > 0 && (
          <div className="flex justify-between">
            <span className="text-[10px] text-gray-500">No value</span>
            <span className="text-[10px] tabular-nums text-amber-400/80">{invalidCount.toLocaleString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ✅ Main MapLegend Component
export default function MapLegend({
  thresholds,
  selectedMetric,
  colorBy = null,
  logs = [],
}) {
  const [collapsed, setCollapsed] = useState(false);

  let content = null;
  let title = "";

  if (colorBy) {
    content = <ColorSchemeLegend colorBy={colorBy} logs={logs} />;
    title = colorBy.charAt(0).toUpperCase() + colorBy.slice(1);
  } else if (selectedMetric?.toLowerCase() === "pci") {
    content = <PciLegend logs={logs} />;
    title = "PCI";
  } else {
    content = (
      <MetricThresholdLegend
        thresholds={thresholds}
        selectedMetric={selectedMetric}
        logs={logs}
      />
    );
    const config = getMetricConfig(selectedMetric);
    title = `${config.label}${config.unit ? ` (${config.unit})` : ""}`;
  }

  if (!content) return null;

  return (
    <>
      {/* Custom scrollbar styles */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.15);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.25);
        }
      `}</style>

      <div className="absolute top-28 right-4 z-10">
        <div
          className={`
            bg-gray-900/95 backdrop-blur-lg border border-gray-700/40
            rounded-lg shadow-xl shadow-black/20
            transition-all duration-200
            ${collapsed ? "w-auto" : "min-w-[240px] max-w-[280px]"}
          `}
        >
          {/* Header */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full px-3 py-2.5 flex items-center justify-between gap-3 hover:bg-white/5 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-100">{title}</span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${
                collapsed ? "" : "rotate-180"
              }`}
            />
          </button>

          {/* Content */}
          {!collapsed && (
            <div className="px-2 pb-2">
              <div className="pt-1 border-t border-gray-700/40">
                {content}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}