import React, { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import { adminApi } from "../api/apiEndpoints";

import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList, ReferenceArea,
} from "recharts";

import {
  Users, Car, Waypoints, FileText, Wifi, BarChart2, MoreVertical, Settings as SettingsIcon
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const CHART_COLORS = ['#60A5FA', '#34D399', '#F59E0B', '#A78BFA', '#F472B6', '#FBBF24', '#22D3EE', '#F87171', '#4ADE80', '#93C5FD'];

const getRSRPPointColor = (rsrp) => {
  if (rsrp < -115) return '#ef4444';
  if (rsrp <= -105) return '#f59e0b';
  if (rsrp <= -95) return '#fde047';
  if (rsrp <= -90) return '#1d4ed8';
  if (rsrp <= -85) return '#60a5fa';
  if (rsrp <= -75) return '#86efac';
  return '#065f46';
};

const canonicalOperatorName = (raw) => {
  if (!raw && raw !== 0) return 'Unknown';
  let s = String(raw).trim();
  s = s.replace(/^IND[-\s]*/i, '');
  const lower = s.toLowerCase();
  if (lower === '//////' || lower === '404011') return 'Unknown';
  if (lower.includes('jio')) return 'JIO';
  if (lower.includes('airtel')) return 'Airtel';
  if (lower.includes('vodafone') || lower.startsWith('vi')) return 'Vi (Vodafone Idea)';
  return s;
};

const toNumber = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const ensureNegative = (v) => {
  const n = toNumber(v, 0);
  if (!Number.isFinite(n)) return 0;
  return n > 0 ? -n : n;
};

const mergeOperatorCounts = (raw, { nameKey = 'name', valueKey = 'value' } = {}) => {
  if (!Array.isArray(raw)) return [];
  const acc = new Map();
  for (const item of raw) {
    const name = canonicalOperatorName(item?.[nameKey]);
    const val = toNumber(item?.[valueKey]);
    acc.set(name, (acc.get(name) || 0) + val);
  }
  return [...acc.entries()].map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const mergeOperatorAverages = (raw, { nameKey = 'name', avgKey = 'value', weightKey = 'sampleCount' } = {}) => {
  if (!Array.isArray(raw)) return [];
  const acc = new Map();
  for (const item of raw) {
    const name = canonicalOperatorName(item?.[nameKey]);
    const avg = toNumber(item?.[avgKey]); // Don't ensure negative here
    const w = Number(item?.[weightKey]);
    if (!Number.isFinite(avg)) continue;
    const curr = acc.get(name) || { sum: 0, w: 0 };
    if (Number.isFinite(w) && w > 0) {
      curr.sum += avg * w;
      curr.w += w;
    } else {
      curr.sum += avg;
      curr.w += 1;
    }
    acc.set(name, curr);
  }
  return [...acc.entries()]
    .map(([name, { sum, w }]) => ({ name, value: w ? sum / w : 0 }))
    .sort((a, b) => b.value - a.value);
};

const normalizeArray = (arr, nameKeys = ["name"], valueKeys = ["value"]) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    const name = nameKeys.reduce((acc, key) => acc ?? item?.[key], null);
    const value = valueKeys.reduce((acc, key) => acc ?? item?.[key], null);
    return { ...item, name: String(name ?? ""), value: toNumber(value ?? 0) };
  });
};

const normalizePayload = (resp) => {
  const payload = resp?.Data ?? resp?.data ?? resp ?? {};
  if (typeof payload === "string") return null;

  const operatorWiseSamplesRaw = payload.operatorWiseSamples ?? payload.samplesByAlphaLong ?? [];
  const operatorWiseSamplesMerged = mergeOperatorCounts(
    normalizeArray(operatorWiseSamplesRaw, ["name", "m_alpha_long"], ["value", "count"]),
    { nameKey: 'name', valueKey: 'value' }
  );

  const networkTypeDistribution = normalizeArray(
    payload.networkTypeDistribution ?? payload.networkTypeDistribution_horizontal_bar,
    ["name", "network"],
    ["value", "count"]
  );

  const monthlySampleCounts = normalizeArray(
    payload.monthlySampleCounts, ["month"], ["count"]
  );

  // RSRP
  const avgRsrpRaw = payload.avgRsrpPerOperator ?? [];
  const avgRsrpPre = normalizeArray(avgRsrpRaw, ["name", "Operator"], ["value", "AvgRSRP"]);
  const avgRsrpPerOperator = mergeOperatorAverages(avgRsrpPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  }).map(x => ({ ...x, value: ensureNegative(x.value) }));

  // RSRQ
  const avgRsrqRaw = payload.avgRsrqPerOperator ?? [];
  const avgRsrqPre = normalizeArray(avgRsrqRaw, ["name"], ["value"]);
  const avgRsrqPerOperator = mergeOperatorAverages(avgRsrqPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  }).map(x => ({ ...x, value: ensureNegative(x.value) }));

  // SINR
  const avgSinrRaw = payload.avgSinrPerOperator ?? [];
  const avgSinrPre = normalizeArray(avgSinrRaw, ["name"], ["value"]);
  const avgSinrPerOperator = mergeOperatorAverages(avgSinrPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  });

  // MOS
  const avgMosRaw = payload.avgMosPerOperator ?? [];
  const avgMosPre = normalizeArray(avgMosRaw, ["name"], ["value"]);
  const avgMosPerOperator = mergeOperatorAverages(avgMosPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  });

  // Jitter
  const avgJitterRaw = payload.avgJitterPerOperator ?? [];
  const avgJitterPre = normalizeArray(avgJitterRaw, ["name"], ["value"]);
  const avgJitterPerOperator = mergeOperatorAverages(avgJitterPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  });

  // Latency
  const avgLatencyRaw = payload.avgLatencyPerOperator ?? [];
  const avgLatencyPre = normalizeArray(avgLatencyRaw, ["name"], ["value"]);
  const avgLatencyPerOperator = mergeOperatorAverages(avgLatencyPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  });

  // Packet Loss
  const avgPacketLossRaw = payload.avgPacketLossPerOperator ?? [];
  const avgPacketLossPre = normalizeArray(avgPacketLossRaw, ["name"], ["value"]);
  const avgPacketLossPerOperator = mergeOperatorAverages(avgPacketLossPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  });

  // DL Throughput
  const avgDlTptRaw = payload.avgDlTptPerOperator ?? [];
  const avgDlTptPre = normalizeArray(avgDlTptRaw, ["name"], ["value"]);
  const avgDlTptPerOperator = mergeOperatorAverages(avgDlTptPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  });

  // UL Throughput
  const avgUlTptRaw = payload.avgUlTptPerOperator ?? [];
  const avgUlTptPre = normalizeArray(avgUlTptRaw, ["name"], ["value"]);
  const avgUlTptPerOperator = mergeOperatorAverages(avgUlTptPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  });

  const bandDistribution = normalizeArray(
    payload.bandDistribution ?? payload.bandDistribution_pie,
    ["name", "band"], ["value", "count"]
  );

  const handsetDistribution = normalizeArray(
    payload.handsetDistribution ?? payload.handsetWiseAvg_bar,
    ["name", "Make"], ["value", "Avg"]
  ).map(x => ({ ...x, value: ensureNegative(x.value) }));

  const handsetWiseAvg_bar = (payload.handsetWiseAvg_bar ?? []).map((x) => ({
    Make: String(x?.Make ?? ''),
    Avg: ensureNegative(x?.Avg),
    Samples: toNumber(x?.Samples),
  }));

  return {
    totals: {
      users: toNumber(payload.totalUsers),
      sessions: toNumber(payload.totalSessions),
      onlineSessions: toNumber(payload.totalOnlineSessions),
      samples: toNumber(payload.totalSamples ?? payload.totalLogPoints),
      operators: operatorWiseSamplesMerged.length,
      technologies: networkTypeDistribution.length,
      bands: bandDistribution.length
    },
    monthlySampleCounts,
    operatorWiseSamples: operatorWiseSamplesMerged,
    networkTypeDistribution,
    avgRsrpPerOperator,
    avgRsrqPerOperator,
    avgSinrPerOperator,
    avgMosPerOperator,
    avgJitterPerOperator,
    avgLatencyPerOperator,
    avgPacketLossPerOperator,
    avgDlTptPerOperator,
    avgUlTptPerOperator,
    bandDistribution,
    handsetDistribution,
    handsetWiseAvg_bar
  };
};

// Helper to get metric data based on selection
const getMetricData = (metric, data) => {
  const configs = {
    rsrp: {
      data: data?.avgRsrpPerOperator ?? [],
      label: 'Avg RSRP',
      unit: 'dBm',
      domain: [-120, -60],
      colorFn: getRSRPPointColor,
    },
    rsrq: {
      data: data?.avgRsrqPerOperator ?? [],
      label: 'Avg RSRQ',
      unit: 'dB',
      domain: [-20, -3],
      colorFn: (v) => (v < -15 ? '#ef4444' : v < -10 ? '#f59e0b' : v < -8 ? '#60a5fa' : '#10b981'),
    },
    sinr: {
      data: data?.avgSinrPerOperator ?? [],
      label: 'Avg SINR',
      unit: 'dB',
      domain: [-5, 30],
      colorFn: (v) => (v < 0 ? '#ef4444' : v < 10 ? '#f59e0b' : v < 20 ? '#60a5fa' : '#10b981'),
    },
    mos: {
      data: data?.avgMosPerOperator ?? [],
      label: 'Avg MOS',
      unit: '',
      domain: [1, 5],
      colorFn: (v) => (v < 2 ? '#ef4444' : v < 3 ? '#f59e0b' : v < 4 ? '#60a5fa' : '#10b981'),
    },
    jitter: {
      data: data?.avgJitterPerOperator ?? [],
      label: 'Avg Jitter',
      unit: 'ms',
      domain: [0, 'auto'],
      colorFn: (v) => (v > 30 ? '#ef4444' : v > 20 ? '#f59e0b' : v > 10 ? '#60a5fa' : '#10b981'),
    },
    latency: {
      data: data?.avgLatencyPerOperator ?? [],
      label: 'Avg Latency',
      unit: 'ms',
      domain: [0, 'auto'],
      colorFn: (v) => (v > 100 ? '#ef4444' : v > 50 ? '#f59e0b' : v > 20 ? '#60a5fa' : '#10b981'),
    },
    packetLoss: {
      data: data?.avgPacketLossPerOperator ?? [],
      label: 'Avg Packet Loss',
      unit: '%',
      domain: [0, 'auto'],
      colorFn: (v) => (v > 5 ? '#ef4444' : v > 2 ? '#f59e0b' : v > 0.5 ? '#60a5fa' : '#10b981'),
    },
    dlTpt: {
      data: data?.avgDlTptPerOperator ?? [],
      label: 'Avg DL Throughput',
      unit: 'Mbps',
      domain: [0, 'auto'],
      colorFn: (v) => (v < 10 ? '#ef4444' : v < 50 ? '#f59e0b' : v < 100 ? '#60a5fa' : '#10b981'),
    },
    ulTpt: {
      data: data?.avgUlTptPerOperator ?? [],
      label: 'Avg UL Throughput',
      unit: 'Mbps',
      domain: [0, 'auto'],
      colorFn: (v) => (v < 5 ? '#ef4444' : v < 20 ? '#f59e0b' : v < 50 ? '#60a5fa' : '#10b981'),
    },
  };
  
  return configs[metric] || configs.rsrp;
};

// Network Type Filter Settings Component
const NetworkTypeFilterSettings = ({ value, onChange }) => (
  <div className="space-y-3 text-sm">
    <div className="font-medium text-gray-700">Network Type Filter</div>
    <div className="space-y-2">
      {['All', '5G', '4G', '3G', '2G'].map((type) => (
        <label key={type} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
          <input
            type="radio"
            name="networkType"
            value={type}
            checked={value === type}
            onChange={(e) => onChange(e.target.value)}
            className="w-4 h-4 text-blue-600"
          />
          <span className="text-gray-700">{type}</span>
        </label>
      ))}
    </div>
  </div>
);

// Metric Selector Settings Component
const MetricSelectorSettings = ({ value, onChange }) => {
  const metrics = [
    { value: 'rsrp', label: 'RSRP (dBm)', desc: 'Reference Signal Received Power' },
    { value: 'rsrq', label: 'RSRQ (dB)', desc: 'Reference Signal Received Quality' },
    { value: 'sinr', label: 'SINR (dB)', desc: 'Signal to Interference plus Noise Ratio' },
    { value: 'mos', label: 'MOS', desc: 'Mean Opinion Score (1-5)' },
    { value: 'jitter', label: 'Jitter (ms)', desc: 'Variation in packet delay' },
    { value: 'latency', label: 'Latency (ms)', desc: 'Round-trip time' },
    { value: 'packetLoss', label: 'Packet Loss (%)', desc: 'Percentage of lost packets' },
    { value: 'dlTpt', label: 'DL Throughput (Mbps)', desc: 'Download Speed' },
    { value: 'ulTpt', label: 'UL Throughput (Mbps)', desc: 'Upload Speed' },
  ];

  return (
    <div className="space-y-3 text-sm">
      <div className="font-medium text-gray-700">Select Metric</div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {metrics.map((metric) => (
          <label key={metric.value} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
            <input
              type="radio"
              name="metric"
              value={metric.value}
              checked={value === metric.value}
              onChange={(e) => onChange(e.target.value)}
              className="w-4 h-4 text-blue-600 mt-1"
            />
            <div className="flex-1">
              <div className="text-gray-700 font-medium">{metric.label}</div>
              <div className="text-xs text-gray-500">{metric.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
};

const buildRanking = (raw, { nameKey = 'name', countKey = 'count' } = {}) => {
  if (!Array.isArray(raw)) return [];
  const merged = new Map();
  for (const r of raw) {
    const name = canonicalOperatorName(r?.[nameKey]);
    const c = toNumber(r?.[countKey]);
    merged.set(name, (merged.get(name) || 0) + c);
  }
  const arr = [...merged.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  return arr.map((x, i) => ({ ...x, rank: i + 1, label: `#${i + 1} ${x.name}` }));
};

const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  color: '#111827'
};

const downloadCSVFromData = (data = [], filename = 'data.csv') => {
  if (!Array.isArray(data) || data.length === 0) {
    toast.info("No data to export");
    return;
  }
  const cols = Array.from(
    data.reduce((set, row) => {
      Object.keys(row || {}).forEach(k => {
        const v = row[k];
        if (typeof v !== 'object' && typeof v !== 'function') set.add(k);
      });
      return set;
    }, new Set())
  );

  const escapeCsv = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [cols.join(',')];
  for (const row of data) {
    lines.push(cols.map(c => escapeCsv(row[c])).join(','));
  }
  const csvBlob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(csvBlob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
};

const sanitizeFileName = (s = 'chart') => s.replace(/[^\w\d-_]+/g, '_').slice(0, 64);

const ChartCard = ({ title, dataset, children, exportFileName, settings }) => {
  const cardRef = useRef(null);
  const [showTable, setShowTable] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleDownloadPNG = async () => {
    try {
      const node = cardRef.current?.querySelector('.chart-content') ?? cardRef.current;
      if (!node) return toast.error("Chart not found for export");
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(node, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${sanitizeFileName(exportFileName || title || 'chart')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      toast.error("Failed to export PNG");
    }
  };

  const handleDownloadCSV = () => {
    downloadCSVFromData(dataset, `${sanitizeFileName(exportFileName || title || 'chart')}.csv`);
  };

  const columns = React.useMemo(() => {
    if (!Array.isArray(dataset) || dataset.length === 0) return [];
    const keys = Array.from(
      dataset.reduce((set, row) => {
        Object.entries(row || {}).forEach(([k, v]) => {
          if (['object', 'function'].includes(typeof v)) return;
          set.add(k);
        });
        return set;
      }, new Set())
    );
    return keys;
  }, [dataset]);

  return (
    <Card className="bg-white text-gray-900 border-gray-200 shadow-sm">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-semibold text-gray-800">{title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-gray-100">
                <MoreVertical className="h-4 w-4 text-gray-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border border-gray-200 text-gray-800 w-52">
              {settings && (
                <DropdownMenuItem className="hover:bg-gray-100" onClick={() => setSettingsOpen(true)}>
                  <SettingsIcon className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="hover:bg-gray-100" onClick={() => setShowTable(v => !v)}>
                {showTable ? 'Back to Chart' : 'See as Table'}
              </DropdownMenuItem>
              <div className="px-3 py-1 text-xs text-gray-500">Export</div>
              <DropdownMenuItem className="hover:bg-gray-100" onClick={handleDownloadPNG}>Download PNG</DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-gray-100" onClick={handleDownloadCSV}>Download CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="h-[320px] relative">
        {!dataset || dataset.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
        ) : showTable ? (
          <div className="h-full overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {columns.map((c) => (
                    <th key={c} className="text-left px-3 py-2 font-semibold text-gray-700 border-b border-gray-200">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.map((row, i) => (
                  <tr key={i} className="odd:bg-white even:bg-gray-50">
                    {columns.map(c => (
                      <td key={c} className="px-3 py-2 border-b border-gray-100">
                        {typeof row[c] === 'number' ? row[c].toLocaleString() : String(row[c] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div ref={cardRef} className="chart-content h-full">
            {children}
          </div>
        )}

        {settings && (
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{settings.title || 'Settings'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {typeof settings.render === 'function' ? settings.render() : settings.render}
              </div>
              <DialogFooter className="gap-2">
                <button
                  className="px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50"
                  onClick={() => setSettingsOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-500"
                  onClick={() => {
                    if (typeof settings.onApply === 'function') settings.onApply();
                    setSettingsOpen(false);
                  }}
                >
                  Apply
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
};

const PageLoadProgress = () => {
  const [pct, setPct] = React.useState(0);

  React.useEffect(() => {
    let t;
    const tick = () => {
      setPct(p => {
        if (p < 70) return Math.min(70, p + 12);
        return Math.min(90, p + Math.max(0.5, (90 - p) * 0.1));
      });
      t = setTimeout(tick, 200);
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-64">
        <div className="w-full bg-gray-200 rounded-full overflow-hidden h-2.5">
          <div
            className="relative bg-blue-600 h-full transition-[width] duration-200 ease-in-out"
            style={{ width: `${pct}%` }}
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(255,255,255,0.9) 0, rgba(255,255,255,0.9) 10px, rgba(255,255,255,0.5) 10px, rgba(255,255,255,0.5) 20px)',
                backgroundSize: '40px 40px',
                animation: 'moveStripes 1s linear infinite',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500 text-center">Loading dashboard…</div>
        <style>
          {`
            @keyframes moveStripes {
              0% { background-position: 0 0; }
              100% { background-position: 40px 0; }
            }
          `}
        </style>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card className="bg-white text-gray-900 border-gray-200 shadow-sm">
    <CardContent className="p-4 min-w-0">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-md flex items-center justify-center ${color} text-white flex-shrink-0`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl md:text-3xl font-bold leading-tight">
            {Number(value ?? 0).toLocaleString()}
          </p>
          <p className="text-xs md:text-sm text-gray-500 truncate">{title}</p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ======================== MAIN COMPONENT ========================
const DashboardPage = () => {
  // Network type filter state
  const [networkTypeFilter, setNetworkTypeFilter] = useState('All');
  const [draftNetworkType, setDraftNetworkType] = useState('All');

  // Metric selector state
  const [selectedMetric, setSelectedMetric] = useState('rsrp');
  const [draftMetric, setDraftMetric] = useState('rsrp');

  // RSRP/RSRQ range settings
  const [settings, setSettings] = useState({
    rsrpMin: -95, rsrpMax: 0,
    rsrqMin: -10, rsrqMax: 0,
  });
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);

  // Base dashboard payload via SWR
  const fetchDashboard = async () => {
    try {
      const params = new URLSearchParams();
      if (networkTypeFilter && networkTypeFilter !== 'All') {
        params.append('networkType', networkTypeFilter);
      }
      
      const queryString = params.toString();
      const suffix = queryString ? `?${queryString}` : '';

      const [statsResp, graphsResp] = await Promise.all([
        adminApi.getReactDashboardData(suffix),
        adminApi.getDashboardGraphData(),
      ]);
      
      const merged = { ...(statsResp?.Data ?? statsResp ?? {}), ...(graphsResp?.Data ?? graphsResp ?? {}) };
      const normalized = normalizePayload({ Data: merged });
      console.log('normalized dashboard', normalized);
      return normalized;
    } catch (err) {
      toast.error(`Failed to load dashboard: ${err?.message ?? 'Unknown error'}`);
      throw err;
    }
  };

  const {
    data,
    error: dashError,
    isLoading: isDashLoading,
    mutate: refreshDashboard,
  } = useSWR(['dashboard:core', networkTypeFilter], fetchDashboard, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  // Ranking data via SWR
  const fetchCoverageRank = async ([, min, max]) => {
    try {
      const resp = await adminApi.getOperatorCoverageRanking({ min, max });
      const payload = resp?.Data ?? resp?.data ?? resp ?? [];
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    } catch (err) {
      toast.error(`Failed to load coverage ranking: ${err?.message ?? 'Unknown error'}`);
      throw err;
    }
  };

  const fetchQualityRank = async ([, min, max]) => {
    try {
      const resp = await adminApi.getOperatorQualityRanking({ min, max });
      const payload = resp?.Data ?? resp?.data ?? resp ?? [];
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    } catch (err) {
      toast.error(`Failed to load quality ranking: ${err?.message ?? 'Unknown error'}`);
      throw err;
    }
  };

  const {
    data: coverageRank = [],
    error: covError,
    isLoading: isCoverageLoading,
  } = useSWR(['rank:coverage', settings.rsrpMin, settings.rsrpMax], fetchCoverageRank, {
    keepPreviousData: true,
    dedupingInterval: 15_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const {
    data: qualityRank = [],
    error: qualError,
    isLoading: isQualityLoading,
  } = useSWR(['rank:quality', settings.rsrqMin, settings.rsrqMax], fetchQualityRank, {
    keepPreviousData: true,
    dedupingInterval: 15_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  const stats = useMemo(() => {
    if (!data?.totals) return [];
    return [
      { title: "Users", value: data.totals.users, icon: Users, color: "bg-purple-600" },
      { title: "Total Drive Sessions", value: data.totals.sessions, icon: Car, color: "bg-teal-600" },
      { title: "Online Sessions", value: data.totals.onlineSessions, icon: Waypoints, color: "bg-orange-600" },
      { title: "Total Samples", value: data.totals.samples, icon: FileText, color: "bg-amber-600" },
      { title: "Operators", value: data.totals.operators, icon: Wifi, color: "bg-sky-600" },
      { title: "Technologies", value: data.totals.technologies, icon: BarChart2, color: "bg-pink-600" },
    ];
  }, [data]);

  const applySettings = () => {
    if (draft.rsrpMin > draft.rsrpMax) return toast.warn("RSRP: Min cannot be greater than Max");
    if (draft.rsrqMin > draft.rsrqMax) return toast.warn("RSRQ: Min cannot be greater than Max");
    setSettings(draft);
  };

  if (isDashLoading) return <PageLoadProgress />;
  if (dashError) return <div className="p-6 text-red-600">Failed to load dashboard data.</div>;
  if (!data) return <div className="p-6 text-red-600">Failed to load dashboard data.</div>;

  return (
    <div className="h-full no-scrollbar overflow-y-auto space-y-6 bg-white text-gray-900 p-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        {stats.map(s => <StatCard key={s.title} {...s} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Samples */}
        <ChartCard title="Monthly Samples" dataset={data.monthlySampleCounts} exportFileName="monthly_samples">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlySampleCounts} margin={{ top: 16, right: 24, left: -10, bottom: 8 }}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#60A5FA"
                strokeWidth={2}
                fill="url(#gradBlue)"
                dot={{ r: 2, stroke: '#60A5FA', strokeWidth: 1, fill: '#60A5FA' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Operator wise Samples WITH NETWORK TYPE FILTER */}
        <ChartCard 
          title={`Operator wise Samples${networkTypeFilter !== 'All' ? ` (${networkTypeFilter})` : ''}`}
          dataset={data.operatorWiseSamples} 
          exportFileName={`operator_samples_${networkTypeFilter}`}
          settings={{
            title: 'Network Type Filter',
            render: () => (
              <NetworkTypeFilterSettings 
                value={draftNetworkType} 
                onChange={setDraftNetworkType} 
              />
            ),
            onApply: () => setNetworkTypeFilter(draftNetworkType)
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.operatorWiseSamples} layout="vertical" margin={{ top: 12, right: 40, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#111827', fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: '#111827', fontSize: '12px', fontWeight: 600 }} />
                {data.operatorWiseSamples.map((entry, index) => (
                  <Cell key={`cell-ops-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Network Type Distribution */}
        <ChartCard title="Network Type Distribution" dataset={data.networkTypeDistribution} exportFileName="network_type_distribution">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.networkTypeDistribution} layout="vertical" margin={{ top: 12, right: 36, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#111827', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="#34D399" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: '#111827', fontSize: '12px', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* DYNAMIC METRIC PER OPERATOR WITH NETWORK TYPE FILTER */}
        <ChartCard 
          title={`${getMetricData(selectedMetric, data).label} Per Operator${networkTypeFilter !== 'All' ? ` (${networkTypeFilter})` : ''}`}
          dataset={getMetricData(selectedMetric, data).data} 
          exportFileName={`avg_${selectedMetric}_per_operator_${networkTypeFilter}`}
          settings={{
            title: 'Metric & Filter Settings',
            render: () => (
              <div className="space-y-4">
                <MetricSelectorSettings 
                  value={draftMetric} 
                  onChange={setDraftMetric} 
                />
                <div className="border-t pt-4">
                  <NetworkTypeFilterSettings 
                    value={draftNetworkType} 
                    onChange={setDraftNetworkType} 
                  />
                </div>
              </div>
            ),
            onApply: () => {
              setSelectedMetric(draftMetric);
              setNetworkTypeFilter(draftNetworkType);
            }
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={getMetricData(selectedMetric, data).data} 
              layout="vertical" 
              margin={{ top: 12, right: 60, left: 10, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis 
                type="number" 
                domain={getMetricData(selectedMetric, data).domain}
                tick={{ fill: '#6b7280', fontSize: 11 }} 
                tickFormatter={(v) => `${v} ${getMetricData(selectedMetric, data).unit}`}
              />
              <YAxis dataKey="name" type="category" width={140} tick={{ fill: '#111827', fontSize: 12 }} />
              <Tooltip 
                contentStyle={tooltipStyle} 
                formatter={(v) => [
                  `${Number(v).toFixed(2)} ${getMetricData(selectedMetric, data).unit}`, 
                  getMetricData(selectedMetric, data).label
                ]} 
              />
              <Bar dataKey="value" name={getMetricData(selectedMetric, data).label} radius={[0, 6, 6, 0]}>
                <LabelList 
                  dataKey="value" 
                  content={({ x = 0, y = 0, width = 0, height = 0, value }) => {
                    const midY = y + height / 2;
                    const barEndX = width >= 0 ? x + width : x;
                    const dx = width >= 0 ? 8 : -8;
                    const anchor = width >= 0 ? 'start' : 'end';
                    const val = Number.isFinite(Number(value)) ? Number(value).toFixed(1) : value;
                    return (
                      <text
                        x={barEndX + dx}
                        y={midY}
                        fill="#111827"
                        dominantBaseline="middle"
                        textAnchor={anchor}
                        fontSize={12}
                        fontWeight={600}
                      >
                        {`${val} ${getMetricData(selectedMetric, data).unit}`}
                      </text>
                    );
                  }}
                />
                {getMetricData(selectedMetric, data).data.map((entry, index) => (
                  <Cell 
                    key={`cell-metric-${index}`} 
                    fill={getMetricData(selectedMetric, data).colorFn(entry.value)} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Band Distribution */}
        <ChartCard title="Band Distribution" dataset={data.bandDistribution} exportFileName="band_distribution">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.bandDistribution} layout="vertical" margin={{ top: 12, right: 36, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#111827', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: '#111827', fontSize: '12px', fontWeight: 600 }} />
                {data.bandDistribution.map((entry, index) => (
                  <Cell key={`cell-band-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Handset wise Avg RSRP */}
        <ChartCard title="Handset wise Avg RSRP" dataset={data.handsetWiseAvg_bar} exportFileName="handset_avg_rsrp">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.handsetWiseAvg_bar}
              layout="vertical"
              margin={{ top: 12, right: 40, left: 10, bottom: 8 }}
              barCategoryGap="25%"
              barSize={14}
            >
              <ReferenceArea x1={-120} x2={-105} fill="#ef4444" fillOpacity={0.06} />
              <ReferenceArea x1={-105} x2={-95} fill="#f59e0b" fillOpacity={0.06} />
              <ReferenceArea x1={-95} x2={-85} fill="#60a5fa" fillOpacity={0.06} />
              <ReferenceArea x1={-85} x2={-60} fill="#10b981" fillOpacity={0.06} />

              <XAxis
                type="number"
                domain={[-120, -60]}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickFormatter={(v) => `${v} dBm`}
              />
              <YAxis
                dataKey="Make"
                type="category"
                width={180}
                tick={{ fill: '#111827', fontSize: 12 }}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(v) => [`${Number(v).toFixed(1)} dBm`, 'Avg RSRP']}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${label} • ${item.Samples?.toLocaleString()} samples` : label;
                }}
              />

              <Bar
                dataKey="Avg"
                name="Avg RSRP"
                radius={[0, 8, 8, 0]}
                isAnimationActive
                animationDuration={650}
                background={{ fill: 'rgba(0,0,0,0.06)', radius: [0, 8, 8, 0] }}
              >
                {(data?.handsetWiseAvg_bar ?? []).map((entry, index) => (
                  <Cell key={`cell-handset-${index}`} fill={getRSRPPointColor(entry.Avg)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Operator Coverage Rank */}
        <ChartCard
          title={`Operator Coverage Rank (RSRP ${settings.rsrpMin} to ${settings.rsrpMax} dBm)`}
          dataset={coverageRank}
          exportFileName="coverage_rank"
          settings={{
            title: 'Coverage Rank Settings',
            render: () => (
              <div className="space-y-3 text-sm">
                <div className="font-medium text-gray-700">RSRP Coverage Range (dBm)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Min</label>
                    <input
                      type="number" step="1"
                      className="w-full px-2 py-1 rounded border border-gray-300"
                      value={draft.rsrpMin}
                      onChange={(e) => setDraft(s => ({ ...s, rsrpMin: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Max</label>
                    <input
                      type="number" step="1"
                      className="w-full px-2 py-1 rounded border border-gray-300"
                      value={draft.rsrpMax}
                      onChange={(e) => setDraft(s => ({ ...s, rsrpMax: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
            ),
            onApply: applySettings
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={coverageRank}
              margin={{ top: 12, right: 40, left: 10, bottom: 40 }}
              barSize={24}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
                tick={{ fill: '#111827', fontSize: 12 }}
              />
              <YAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Samples in range']} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="value" position="top" style={{ fill: '#111827', fontSize: '12px', fontWeight: 600 }} />
                {coverageRank.map((entry, index) => (
                  <Cell key={`cell-cov-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {isCoverageLoading && <div className="absolute inset-0 bg-white/40 flex items-center justify-center text-gray-700 text-sm">Loading…</div>}
        </ChartCard>

        {/* Operator Quality Rank */}
        <ChartCard
          title={`Operator Quality Rank (RSRQ ${settings.rsrqMin} to ${settings.rsrqMax} dB)`}
          dataset={qualityRank}
          exportFileName="quality_rank"
          settings={{
            title: 'Quality Rank Settings',
            render: () => (
              <div className="space-y-3 text-sm">
                <div className="font-medium text-gray-700">RSRQ Quality Range (dB)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Min</label>
                    <input
                      type="number" step="0.5"
                      className="w-full px-2 py-1 rounded border border-gray-300"
                      value={draft.rsrqMin}
                      onChange={(e) => setDraft(s => ({ ...s, rsrqMin: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-gray-500">Max</label>
                    <input
                      type="number" step="0.5"
                      className="w-full px-2 py-1 rounded border border-gray-300"
                      value={draft.rsrqMax}
                      onChange={(e) => setDraft(s => ({ ...s, rsrqMax: Number(e.target.value) }))}
                    />
                  </div>
                </div>
              </div>
            ),
            onApply: applySettings
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={qualityRank}
              margin={{ top: 12, right: 40, left: 10, bottom: 40 }}
              barSize={24}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
                tick={{ fill: '#111827', fontSize: 12 }}
              />
              <YAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Samples in range']} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="value" position="top" style={{ fill: '#111827', fontSize: '12px', fontWeight: 600 }} />
                {qualityRank.map((entry, index) => (
                  <Cell key={`cell-qual-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {isQualityLoading && <div className="absolute inset-0 bg-white/40 flex items-center justify-center text-gray-700 text-sm">Loading…</div>}
        </ChartCard>
      </div>
    </div>
  );
};

export default DashboardPage;