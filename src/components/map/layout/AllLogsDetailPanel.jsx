import React, { useMemo } from "react";
import { X, Download } from "lucide-react";
import Spinner from "@/components/common/Spinner";

// Metric config with units and proper threshold mapping
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

const toFixedSmart = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : "N/A");
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

const normalizeOperator = (raw) => {
  if (!raw) return "Unknown";
  const s = String(raw).trim();
  if (/^\/+$/.test(s)) return "Unknown";
  if (s.replace(/\s+/g, "") === "404011") return "Unknown";
  const cleaned = s.toUpperCase().replace(/[\s\-_]/g, "");
  if (cleaned.includes("JIO") || /^(IND)?JIO(4G|5G|TRUE5G)?$/.test(cleaned)) return "JIO";
  if (cleaned.includes("AIRTEL") || /^INDAIRTEL$/.test(cleaned)) return "Airtel";
  if (cleaned === "VI" || cleaned.includes("VIINDIA") || cleaned.includes("VODAFONE") || cleaned.includes("IDEA")) return "VI India";
  return s;
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
      min, max,
      color: FALLBACK_BUCKET_COLORS[Math.min(i, FALLBACK_BUCKET_COLORS.length - 1)],
      label: `${toFixedSmart(min)} - ${toFixedSmart(max)}`,
      count: 0,
    });
  }
  outer: for (const v of values) {
    for (const b of bins) {
      if (v >= b.min && v <= b.max) {
        b.count += 1;
        continue outer;
      }
    }
    if (bins.length) bins[bins.length - 1].count += 1;
  }
  return bins;
};

// FIX: percentage now uses counted total (not logs.length)
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

// FIX: align with backend (session_id, provider, network)
const exportCsv = ({ logs, field, filename = "logs_metric.csv" }) => {
  if (!Array.isArray(logs) || !logs.length) return;
  const header = ["session_id", "lat", "lon", field, "provider", "network", "band", "timestamp"];
  const lines = [header.join(",")];
  for (const l of logs) {
    const id = l.session_id ?? l.id ?? "";
    const lat = l.lat ?? "";
    const lon = l.lon ?? l.lng ?? "";
    const val = l[field] ?? "";
    const provider = normalizeOperator(l.provider ?? l.m_alpha_long ?? "");
    const network = l.network ?? l.technology ?? l.tech ?? l.network_type ?? "";
    const band = l.band ?? "";
    const ts = l.timestamp ?? l.time ?? l.created_at ?? "";
    lines.push([id, lat, lon, val, provider, network, band, ts].map((v) => String(v ?? "").replace(/,/g, " ")).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const AllLogsDetailPanel = ({ logs = [], thresholds = {}, selectedMetric = "rsrp", isLoading, onClose }) => {
  const cfg = resolveMetricConfig(selectedMetric);
  const unit = cfg.unit ? ` ${cfg.unit}` : "";
  const ranges = thresholds?.[cfg.thresholdKey] || [];

  const numericValues = useMemo(() => {
    if (!Array.isArray(logs) || !logs.length) return [];
    const vals = [];
    for (const l of logs) {
      const v = parseFloat(l?.[cfg.field]);
      if (Number.isFinite(v)) vals.push(v);
    }
    return vals;
  }, [logs, cfg.field]);

  const stats = useMemo(() => {
    const n = numericValues.length;
    if (!n) return { total: 0, avg: "N/A", min: "N/A", median: "N/A", p95: "N/A", p05: "N/A", max: "N/A", std: "N/A" };
    const sum = numericValues.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...numericValues].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = quantile(sorted, 0.5);
    const p95 = quantile(sorted, 0.95);
    const p05 = quantile(sorted, 0.05);
    const variance = numericValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n;
    const std = Math.sqrt(variance);
    return { total: n, avg: toFixedSmart(mean), min: toFixedSmart(min), median: toFixedSmart(median), p95: toFixedSmart(p95), p05: toFixedSmart(p05), max: toFixedSmart(max), std: toFixedSmart(std) };
  }, [numericValues]);

  const buckets = useMemo(() => buildDistribution(numericValues, ranges), [numericValues, ranges]);

  // FIX: use provider and network per backend shape
  const providerTop = useMemo(
    () => buildTopCounts(logs, (l) => normalizeOperator(l.provider ?? l.m_alpha_long ?? "Unknown")),
    [logs]
  );
  const networkTop = useMemo(
    () => buildTopCounts(logs, (l) => l.network ?? l.technology ?? l.tech ?? l.network_type ?? "Unknown"),
    [logs]
  );
  const bandTop = useMemo(
    () => buildTopCounts(logs, (l) => l.band ?? "Unknown"),
    [logs]
  );

  return (
    <div className="fixed top-0 right-0 h-screen w-[26rem] max-w-[100vw] text-white bg-slate-900 shadow-2xl z-50">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900 z-10">
          <div>
            <h3 className="text-lg font-bold">All Logs Metric Summary</h3>
            <div className="text-xs text-slate-400">Metric: {cfg.label}{unit}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCsv({ logs, field: cfg.field, filename: `logs_${cfg.field}.csv` })}
              className="p-2 rounded hover:bg-slate-800"
              title="Download CSV"
            >
              <Download className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-slate-800" title="Minimize">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-slate-800/60 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-slate-400">Total</div><div className="font-semibold">{stats.total}</div></div>
                  <div><div className="text-slate-400">Average</div><div className="font-semibold">{stats.avg}{unit}</div></div>
                  <div><div className="text-slate-400">Min</div><div className="font-semibold">{stats.min}{unit}</div></div>
                  <div><div className="text-slate-400">Max</div><div className="font-semibold">{stats.max}{unit}</div></div>
                  <div><div className="text-slate-400">Median</div><div className="font-semibold">{stats.median}{unit}</div></div>
                  {/* <div><div className="text-slate-400">p95</div><div className="font-semibold">{stats.p95}{unit}</div></div>
                  <div><div className="text-slate-400">p05</div><div className="font-semibold">{stats.p05}{unit}</div></div> */}
                  <div><div className="text-slate-400">Std Dev</div><div className="font-semibold">{stats.std}{unit}</div></div>
                </div>
              </div>

              {/* Distribution */}
              <div>
                <h4 className="font-semibold mb-2">Distribution</h4>
                <div className="space-y-2">
                  {buckets.length === 0 && (<div className="text-sm text-slate-400">No data available.</div>)}
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

              {/* Breakdowns */}
              <div className="grid grid-cols-1 gap-3">
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
                          <div className="h-1.5 rounded bg-blue-500" style={{ width: `${o.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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
                          <div className="h-1.5 rounded bg-emerald-500" style={{ width: `${t.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

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
                          <div className="h-1.5 rounded bg-amber-500" style={{ width: `${b.percent}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllLogsDetailPanel;