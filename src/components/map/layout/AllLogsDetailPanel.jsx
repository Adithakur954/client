import React, { useEffect, useState, useMemo } from "react";
import { X, Download, Clock, BarChart3 } from "lucide-react";
import Spinner from "@/components/common/Spinner";
import { adminApi } from "@/api/apiEndpoints";
// FIX 1: Import color utilities to match map behavior
import { getLogColor, normalizeProviderName } from "@/utils/colorUtils";

const resolveMetricConfig = (selectedMetric) => {
  const key = String(selectedMetric || "").toLowerCase();
  const map = {
    rsrp: { field: "rsrp", thresholdKey: "rsrp", label: "RSRP", unit: "dBm" },
    rsrq: { field: "rsrq", thresholdKey: "rsrq", label: "RSRQ", unit: "dB" },
    sinr: { field: "sinr", thresholdKey: "sinr", label: "SINR", unit: "dB" },
    "dl-throughput": { field: "dl_tpt", thresholdKey: "dl_thpt", label: "DL Throughput", unit: "Mbps" },
    "ul-throughput": { field: "ul_tpt", thresholdKey: "ul_thpt", label: "UL Throughput", unit: "Mbps" },
    dl_tpt: { field: "dl_tpt", thresholdKey: "dl_thpt", label: "DL Throughput", unit: "Mbps" },
    ul_tpt: { field: "ul_tpt", thresholdKey: "ul_thpt", label: "UL Throughput", unit: "Mbps" },
    mos: { field: "mos", thresholdKey: "mos", label: "MOS", unit: "" },
    "lte-bler": { field: "bler", thresholdKey: "lte_bler", label: "LTE BLER", unit: "%" },
    bler: { field: "bler", thresholdKey: "lte_bler", label: "LTE BLER", unit: "%" },
  };
  return map[key] || map.rsrp;
};

const toFixedSmart = (v, digits = 2) => {
  if (v === null || v === undefined) return "N/A";
  const num = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(num) ? num.toFixed(digits) : "N/A";
};

const quantile = (sorted, q) => {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
};

const formatDuration = (hours) => {
  if (!hours || hours < 0.001) return "0s";
  const totalSeconds = hours * 3600;
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 && h === 0) parts.push(`${s}s`);
  return parts.join(" ") || "0s";
};

// FIX 2: Removed local normalizeProviderName to avoid mismatches. 
// Using imported one from colorUtils.js instead.

const normalizeNetworkType = (network) => {
  if (!network) return null;
  const n = String(network).trim().toUpperCase();
  if (n === "" || n === "NULL" || n === "UNDEFINED" || n === "UNKNOWN") return null;
  if (n.includes("5G") && n.includes("SA") && !n.includes("NSA")) return "5G SA";
  if (n.includes("5G") && n.includes("NSA")) return "5G NSA";
  if (n.includes("5G") || n.includes("NR")) return "5G";
  if (n.includes("4G") || n.includes("LTE")) return "4G";
  if (n.includes("3G") || n.includes("WCDMA") || n.includes("UMTS")) return "3G";
  if (n.includes("2G") || n.includes("EDGE") || n.includes("GPRS") || n.includes("GSM")) return "2G";
  return null;
};

const normalizeAndAggregateDurations = (data) => {
  const aggregated = new Map();
  data.forEach((item) => {
    // FIX 3: Use the imported normalizer here too
    const provider = normalizeProviderName(item.Provider);
    const network = normalizeNetworkType(item.Network);
    if (!provider || !network || provider === "Unknown") return;
    const key = `${provider}|${network}`;
    if (aggregated.has(key)) {
      const existing = aggregated.get(key);
      existing.TotalDurationHours += item.TotalDurationHours || 0;
    } else {
      aggregated.set(key, {
        Provider: provider,
        Network: network,
        TotalDurationHours: item.TotalDurationHours || 0,
      });
    }
  });
  return Array.from(aggregated.values()).sort((a, b) => b.TotalDurationHours - a.TotalDurationHours);
};

// Use the exact same logic as LogCirclesLayer for consistent grouping
const normalizeOperator = (raw) => {
  const normalized = normalizeProviderName(raw);
  return normalized === "Unknown" ? null : normalized;
};

// Keep this local as it handles 5G SA/NSA distinction better than the generic colorUtils one
const normalizeNetwork = (network) => {
  if (!network) return null;
  const n = String(network).trim().toUpperCase();
  if (n === "" || n === "NULL" || n === "UNDEFINED" || n === "UNKNOWN") return null;
  if (n.includes("5G") || n.includes("NR")) {
    if (n.includes("SA") && !n.includes("NSA")) return "5G SA";
    if (n.includes("NSA")) return "5G NSA";
    return "5G";
  }
  if (n.includes("4G") || n.includes("LTE")) return "4G";
  if (n.includes("3G") || n.includes("WCDMA") || n.includes("UMTS")) return "3G";
  if (n.includes("2G") || n.includes("EDGE") || n.includes("GPRS") || n.includes("GSM")) return "2G";
  return null;
};

const FALLBACK_BUCKET_COLORS = ["#dc2626", "#f97316", "#f59e0b", "#84cc16", "#22c55e"];

const buildDistribution = (values, thresholds) => {
  if (Array.isArray(thresholds) && thresholds.length > 0) {
    const buckets = thresholds.map((r) => ({
      min: Number(r.min),
      max: Number(r.max),
      color: r.color || "#808080",
      label: r.range || `${r.min} - ${r.max}`,
      count: 0,
    }));
    for (const v of values) {
      for (const b of buckets) {
        if (v >= b.min && v <= b.max) {
          b.count += 1;
          break;
        }
      }
    }
    return buckets;
  }
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const edges = [0, 0.2, 0.4, 0.6, 0.8, 1].map((q) => quantile(sorted, q));
  const uniqueEdges = [];
  for (const e of edges) if (!uniqueEdges.length || e > uniqueEdges[uniqueEdges.length - 1]) uniqueEdges.push(e);
  const bins = [];
  for (let i = 0; i < uniqueEdges.length - 1; i++) {
    const min = uniqueEdges[i];
    const max = uniqueEdges[i + 1];
    if (!(Number.isFinite(min) && Number.isFinite(max)) || min === max) continue;
    bins.push({
      min,
      max,
      color: FALLBACK_BUCKET_COLORS[Math.min(i, FALLBACK_BUCKET_COLORS.length - 1)],
      label: `${toFixedSmart(min)} - ${toFixedSmart(max)}`,
      count: 0,
    });
  }
  for (const v of values) {
    for (const b of bins) {
      if (v >= b.min && v <= b.max) {
        b.count += 1;
        break;
      }
    }
  }
  return bins;
};

const buildTopCounts = (logs, getter, topN = 6) => {
  const map = new Map();
  for (const l of logs) {
    const k = getter(l);
    if (!k) continue;
    map.set(k, (map.get(k) || 0) + 1);
  }
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const countedTotal = entries.reduce((acc, [, c]) => acc + c, 0) || 1;
  return entries.slice(0, topN).map(([name, count]) => ({
    name,
    count,
    percent: Math.round((count / countedTotal) * 100),
  }));
};

const buildOperatorNetworkCombo = (logs, topN = 10) => {
  const map = new Map();
  for (const l of logs) {
    const provider = normalizeOperator(l.provider ?? l.m_alpha_long ?? null);
    const network = normalizeNetwork(l.network ?? l.technology ?? l.tech ?? l.network_type ?? null);
    if (!provider || !network) continue;
    const key = `${provider} | ${network}`;
    map.set(key, (map.get(key) || 0) + 1);
  }
  const entries = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((acc, [, c]) => acc + c, 0) || 1;
  return entries.slice(0, topN).map(([combo, count]) => {
    const [provider, network] = combo.split(" | ");
    return { provider, network, count, percent: Math.round((count / total) * 100) };
  });
};

const exportCsv = ({ logs, field, filename = "logs_metric.csv" }) => {
  // ... existing export code ...
  if (!Array.isArray(logs) || !logs.length) return;
  const header = ["session_id", "lat", "lon", field, "provider", "network", "band", "timestamp"];
  const lines = [header.join(",")];
  for (const l of logs) {
    lines.push([
      l.session_id ?? l.id ?? "",
      l.lat ?? "",
      l.lon ?? l.lng ?? "",
      l[field] ?? "",
      normalizeOperator(l.provider ?? l.m_alpha_long ?? ""),
      l.network ?? l.technology ?? "",
      l.band ?? "",
      l.timestamp ?? l.time ?? l.created_at ?? "",
    ].map((v) => String(v ?? "").replace(/,/g, " ")).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const AllLogsDetailPanel = ({
  logs = [],
  thresholds = {},
  selectedMetric = "rsrp",
  isLoading,
  startDate,
  appSummary, 
  endDate,
  onClose,
}) => {
  const [networkDurations, setNetworkDurations] = useState([]);
  const [isDurationsLoading, setIsDurationsLoading] = useState(false);

  const safeLogsList = Array.isArray(logs) ? logs : [];
  const cfg = resolveMetricConfig(selectedMetric);
  const unit = cfg.unit ? ` ${cfg.unit}` : "";
  const ranges = thresholds?.[cfg.thresholdKey] || [];

  const numericValues = useMemo(() => {
    const vals = [];
    for (const l of safeLogsList) {
      const v = parseFloat(l?.[cfg.field]);
      if (Number.isFinite(v)) vals.push(v);
    }
    return vals;
  }, [safeLogsList, cfg.field]);

  const isMetricStats = useMemo(() => {
    if (!appSummary || typeof appSummary !== 'object') return false;
    return (
      appSummary.count !== undefined &&
      appSummary.mean !== undefined &&
      appSummary.metric !== undefined
    );
  }, [appSummary]);

  const processedAppUsage = useMemo(() => {
    if (!appSummary || typeof appSummary !== 'object') return [];
    if (isMetricStats) return [];

    const entries = Object.entries(appSummary);
    const apps = [];

    for (const [key, value] of entries) {
      if (value && typeof value === 'object' && (value.appName || value.avgRsrp !== undefined)) {
        apps.push({
          appName: key,
          ...value,
        });
      }
    }

    return apps.sort((a, b) => (b.sampleCount || 0) - (a.sampleCount || 0));
  }, [appSummary, isMetricStats]);

  const formatDateRange = () => {
    if (!startDate || !endDate) return null;
    const formatDate = (date) => {
      if (!date) return "";
      return new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    };
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchNetworkDurations = async () => {
      setIsDurationsLoading(true);
      try {
        const res = await adminApi.getNetworkDurations(startDate, endDate);
        let rawData = [];
        if (res?.Data && Array.isArray(res.Data)) {
          rawData = res.Data;
        } else if (Array.isArray(res)) {
          rawData = res;
        }
        setNetworkDurations(normalizeAndAggregateDurations(rawData));
      } catch (error) {
        setNetworkDurations([]);
      } finally {
        setIsDurationsLoading(false);
      }
    };

    fetchNetworkDurations();
  }, [startDate, endDate]);

  const stats = useMemo(() => {
    if (isMetricStats && appSummary) {
      return {
        total: appSummary.count || 0,
        avg: toFixedSmart(appSummary.mean),
        min: toFixedSmart(appSummary.min),
        median: toFixedSmart(appSummary.median),
        max: toFixedSmart(appSummary.max),
        std: "N/A",
        metric: appSummary.metric || selectedMetric,
      };
    }

    const n = numericValues.length;
    if (!n) return { total: 0, avg: "N/A", min: "N/A", median: "N/A", max: "N/A", std: "N/A" };
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...numericValues].sort((a, b) => a - b);
    const variance = numericValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    return {
      total: n,
      avg: toFixedSmart(mean),
      min: toFixedSmart(sorted[0]),
      median: toFixedSmart(quantile(sorted, 0.5)),
      max: toFixedSmart(sorted[sorted.length - 1]),
      std: toFixedSmart(Math.sqrt(variance)),
    };
  }, [numericValues, appSummary, isMetricStats, selectedMetric]);

  const buckets = useMemo(() => buildDistribution(numericValues, ranges), [numericValues, ranges]);
  const providerTop = useMemo(() => buildTopCounts(safeLogsList, (l) => normalizeOperator(l.provider ?? l.m_alpha_long ?? null)), [safeLogsList]);
  const networkTop = useMemo(() => buildTopCounts(safeLogsList, (l) => normalizeNetwork(l.network ?? l.technology ?? null)), [safeLogsList]);
  const bandTop = useMemo(() => buildTopCounts(safeLogsList, (l) => l.band && l.band !== "Unknown" ? l.band : null), [safeLogsList]);
  const providerNetworkTop = useMemo(() => buildOperatorNetworkCombo(safeLogsList), [safeLogsList]);

  const safeNum = (val, suffix = "") => {
    if (val === null || val === undefined) return "N/A";
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return Number.isFinite(num) ? `${num.toFixed(2)}${suffix}` : "N/A";
  };

  const formatDurationFromSeconds = (seconds) => {
    if (!seconds || seconds < 1) return "0s";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 && h === 0) parts.push(`${s}s`);
    return parts.join(" ") || "0s";
  };

  return (
    <div className="fixed top-16 right-0 h-[calc(100vh-4rem)] w-[24rem] max-w-[100vw] text-white bg-slate-900 shadow-2xl z-50 flex flex-col">
      {/* ... Header stays same ... */}
      <div className="flex-shrink-0 p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
        <div>
          <h3 className="text-lg font-bold">All Logs Metric Summary</h3>
          <div className="text-xs text-slate-400">Metric: {cfg.label}{unit}</div>
          {formatDateRange() && (
            <div className="text-xs text-slate-500 mt-1">Date Range: {formatDateRange()}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCsv({ logs: safeLogsList, field: cfg.field, filename: `logs_${cfg.field}.csv` })}
            className="p-2 rounded hover:bg-slate-800"
            title="Download CSV"
          >
            <Download className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-2 rounded hover:bg-slate-800" title="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="bg-slate-800/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-blue-400" />
                <span className="font-semibold text-sm">
                  {stats.metric ? `${stats.metric.toUpperCase()} Statistics` : 'Statistics'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-400">Total Logs</div>
                  <div className="font-semibold text-lg text-blue-400">{stats.total}</div>
                </div>
                <div>
                  <div className="text-slate-400">Average</div>
                  <div className="font-semibold">{stats.avg}{unit}</div>
                </div>
                <div>
                  <div className="text-slate-400">Min</div>
                  <div className="font-semibold text-red-400">{stats.min}{unit}</div>
                </div>
                <div>
                  <div className="text-slate-400">Max</div>
                  <div className="font-semibold text-green-400">{stats.max}{unit}</div>
                </div>
                <div>
                  <div className="text-slate-400">Median</div>
                  <div className="font-semibold">{stats.median}{unit}</div>
                </div>
                <div>
                  <div className="text-slate-400">Std Dev</div>
                  <div className="font-semibold">{stats.std}{unit}</div>
                </div>
              </div>
            </div>

            {/* Distribution */}
            {buckets.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Distribution</h4>
                <div className="space-y-2">
                  {buckets.map((b, idx) => {
                    const pct = stats.total ? Math.round((b.count / stats.total) * 100) : 0;
                    return (
                      <div key={`${b.label}-${idx}`} className="mb-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: b.color }} />
                            <span className="text-xs text-slate-300">{b.label}</span>
                          </div>
                          <span className="text-xs text-slate-200">{b.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 bg-slate-700 rounded mt-1">
                          <div className="h-2 rounded" style={{ width: `${pct}%`, backgroundColor: b.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* FIX 4: Providers - Use getLogColor for dynamic colors */}
            {providerTop.length > 0 && (
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="font-semibold mb-2">Providers</div>
                <div className="space-y-2">
                  {providerTop.map((o) => (
                    <div key={o.name} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200">{o.name}</span>
                        <span className="text-slate-300">{o.count} ({o.percent}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded mt-1">
                        <div 
                          className="h-1.5 rounded" 
                          style={{ 
                            width: `${o.percent}%`,
                            backgroundColor: getLogColor("provider", o.name) // Dynamic Color
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FIX 5: Network - Use getLogColor for dynamic colors */}
            {networkTop.length > 0 && (
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="font-semibold mb-2">Network</div>
                <div className="space-y-2">
                  {networkTop.map((t) => (
                    <div key={t.name} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200">{t.name}</span>
                        <span className="text-slate-300">{t.count} ({t.percent}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded mt-1">
                        <div 
                          className="h-1.5 rounded" 
                          style={{ 
                            width: `${t.percent}%`,
                            backgroundColor: getLogColor("technology", t.name) // Dynamic Color
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Network Durations */}
            {isDurationsLoading ? (
              <div className="flex justify-center p-4"><Spinner /></div>
            ) : networkDurations.length > 0 && (
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="font-semibold mb-2">Network Durations</div>
                <table className="w-full text-sm border-collapse">
                  <tbody>
                    {networkDurations.map((n) => (
                      <tr key={`${n.Provider}-${n.Network}`} className="hover:bg-slate-700/20">
                        <td className="py-1">{n.Provider}</td>
                        <td className="py-1">{n.Network}</td>
                        <td className="py-1 text-right">{formatDuration(n.TotalDurationHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* App Usage Summary */}
            {processedAppUsage.length > 0 && (
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  App Usage Summary ({processedAppUsage.length} apps)
                </div>
                <div className="space-y-3">
                  {processedAppUsage.map((app, index) => (
                    <div key={app.appName || index} className="border-b border-slate-700 pb-3 last:border-b-0 last:pb-0">
                      {/* ... existing app usage content ... */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-slate-100">{app.appName}</span>
                        <span className="text-xs text-emerald-400 font-mono">
                          {app.durationHHMMSS || formatDurationFromSeconds(app.totalDurationSeconds)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-400">RSRP:</span>
                          <span className="text-slate-200 font-medium">{safeNum(app.avgRsrp, " dBm")}</span>
                        </div>
                        {/* ... rest of the app usage stats ... */}
                        <div className="flex justify-between"><span className="text-slate-400">RSRQ:</span><span className="text-slate-200 font-medium">{safeNum(app.avgRsrq, " dB")}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">SINR:</span><span className="text-slate-200 font-medium">{safeNum(app.avgSinr, " dB")}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">MOS:</span><span className="text-slate-200 font-medium">{safeNum(app.avgMos)}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">DL:</span><span className="text-slate-200 font-medium">{safeNum(app.avgDlTptMbps, " Mbps")}</span></div>
                        <div className="flex justify-between"><span className="text-slate-400">UL:</span><span className="text-slate-200 font-medium">{safeNum(app.avgUlTptMbps, " Mbps")}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operator vs Network */}
            {providerNetworkTop.filter(item => item.provider && item.network).length > 0 && (
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="font-semibold mb-2">Operator vs Network</div>
                <div className="space-y-2">
                  {providerNetworkTop
                    .filter(item => item.provider && item.network)
                    .map((item) => (
                      <div key={`${item.provider}-${item.network}`} className="text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-200">{item.provider} / {item.network}</span>
                          <span className="text-slate-300">{item.count} ({item.percent}%)</span>
                        </div>
                        <div className="h-1.5 bg-slate-700 rounded mt-1">
                          <div 
                            className="h-1.5 rounded" 
                            style={{ 
                              width: `${item.percent}%`,
                              // For combined, we can default to provider color or keep purple
                              backgroundColor: getLogColor("provider", item.provider) 
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* FIX 6: Bands - Use getLogColor for dynamic colors */}
            {bandTop.length > 0 && (
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="font-semibold mb-2">Bands</div>
                <div className="space-y-2">
                  {bandTop.map((b) => (
                    <div key={b.name} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-200">{b.name}</span>
                        <span className="text-slate-300">{b.count} ({b.percent}%)</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded mt-1">
                        <div 
                          className="h-1.5 rounded" 
                          style={{ 
                            width: `${b.percent}%`,
                            backgroundColor: getLogColor("band", b.name) // Dynamic Color
                          }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AllLogsDetailPanel;