import React, { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import { adminApi } from "../api/apiEndpoints";
import Spinner from "../components/common/Spinner";

import {
  ResponsiveContainer,
  AreaChart, Area,
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, LabelList, ReferenceArea,
} from "recharts";

import {
  Users, Car, Waypoints, FileText, Wifi, BarChart2, RadioTower, MoreVertical, Settings as SettingsIcon
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
    const avg = ensureNegative(item?.[avgKey]);
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
    .sort((a, b) => a.value - b.value);
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

  const operatorWiseSamplesRaw =
    payload.operatorWiseSamples ??
    payload.samplesByAlphaLong ??
    [];
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

  const avgRsrpRaw =
    payload.avgRsrpPerOperator ?? payload.avgRsrpSinrPerOperator_bar ?? [];
  const avgRsrpPre = normalizeArray(avgRsrpRaw, ["name", "Operator"], ["value", "AvgRSRP"]);
  const avgRsrpPerOperator = mergeOperatorAverages(avgRsrpPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  }).map(x => ({ ...x, value: ensureNegative(x.value) }));

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
  Avg: ensureNegative(x?.Avg),       // keep Avg negative
  Samples: toNumber(x?.Samples),     // keep samples for tooltip
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
    bandDistribution,
    handsetDistribution,
    handsetWiseAvg_bar
  };
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

// Neutral tooltip style (no dark/light dependency)
const tooltipStyle = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  color: '#111827'
};

// Label at end of bar for RSRP
const RSRPValueLabel = ({ x = 0, y = 0, width = 0, height = 0, value }) => {
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
      {`${val} dBm`}
    </text>
  );
};

// ---------- Utility: export PNG/CSV ----------
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

// ------------------------ Reusable Cards ------------------------
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

  // default table columns: show all primitive keys
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
          <CardTitle className="text/base font-semibold text-gray-800">{title}</CardTitle>
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

        {/* Settings dialog, opened from chart menu */}
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

// KPI card: responsive, overflow-safe text
const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card className="bg-white text-gray-900 border-gray-200 shadow-sm">
    <CardContent className="p-4 flex items-center gap-3 min-w-0">
      <div className={`h-10 w-10 rounded-md flex items-center justify-center ${color} text-white flex-shrink-0`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-2xl md:text-3xl font-bold leading-tight truncate">{Number(value ?? 0).toLocaleString()}</p>
        <p className="text-xs md:text-sm text-gray-500 truncate">{title}</p>
      </div>
    </CardContent>
  </Card>
);

// ------------------------ Page (with SWR) ------------------------
const DashboardPage = () => {
  // Applied settings (drive SWR keys) + Draft settings (edited in dialog)
  const [settings, setSettings] = useState({
    rsrpMin: -95, rsrpMax: 0,
    rsrqMin: -10, rsrqMax: 0,
  });
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);

  // Base dashboard payload via SWR (fetches both endpoints concurrently)
  const fetchDashboard = async () => {
    try {
      const [statsResp, graphsResp] = await Promise.all([
        adminApi.getReactDashboardData(),
        adminApi.getDashboardGraphData(),
        
      ]);
      console.log('statsResp', statsResp);
      console.log('graphsResp', graphsResp);
      // console.log('onlineUsersResp', onlineUsersResp);
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
  } = useSWR('dashboard:core', fetchDashboard, {
    keepPreviousData: true,
    dedupingInterval: 60_000,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });

  // Ranking data via SWR (keys depend on applied settings)
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
    mutate: refreshCoverage,
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
    mutate: refreshQuality,
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
      // { title: "Total Bands", value: data.totals.bands, icon: RadioTower, color: "bg-indigo-600" }
    ];
  }, [data]);

  const applySettings = () => {
    if (draft.rsrpMin > draft.rsrpMax) return toast.warn("RSRP: Min cannot be greater than Max");
    if (draft.rsrqMin > draft.rsrqMax) return toast.warn("RSRQ: Min cannot be greater than Max");
    setSettings(draft);
    // Optionally force revalidate immediately:
    // refreshCoverage();
    // refreshQuality();
  };

  if (isDashLoading) return <Spinner />;
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

        {/* Operator wise Samples */}
        <ChartCard title="Operator wise Samples" dataset={data.operatorWiseSamples} exportFileName="operator_samples">
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

        {/* Avg RSRP per Operator */}
        <ChartCard title="Avg RSRP (dBm) Per Operator" dataset={data.avgRsrpPerOperator} exportFileName="avg_rsrp_per_operator">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.avgRsrpPerOperator} layout="vertical" margin={{ top: 12, right: 40, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis type="number" domain={[-120, -60]} tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v) => `${v} dBm`} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fill: '#111827', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v).toFixed(1)} dBm`, 'Avg RSRP']} />
              <Bar dataKey="value" name="RSRP" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" content={RSRPValueLabel} />
                {data.avgRsrpPerOperator.map((entry, index) => (
                  <Cell key={`cell-rsrp-${index}`} fill={getRSRPPointColor(entry.value)} />
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
              <ReferenceArea x1={-95}  x2={-85} fill="#60a5fa" fillOpacity={0.06} />
              <ReferenceArea x1={-85}  x2={-60} fill="#10b981" fillOpacity={0.06} />

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
                formatter={(v, name, { payload }) => [`${Number(v).toFixed(1)} dBm`, 'Avg RSRP']}
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
                <LabelList
                  dataKey="value"
                  content={({ x = 0, y = 0, width = 0, height = 0, value }) => {
                    const midY = y + height / 2;
                    const barEndX = x + width;
                    return (
                      <text
                        x={barEndX + 8}
                        y={midY}
                        fill="#111827"
                        dominantBaseline="middle"
                        textAnchor="start"
                        fontSize={12}
                        fontWeight={600}
                      >
                        
                      </text>
                    );
                  }}
                />
                {(data?.handsetDistribution ?? [])
                  .map(d => ({ ...d, value: Number(d.value) > 0 ? -Number(d.value) : Number(d.value) }))
                  .sort((a, b) => a.value - b.value)
                  .slice(0, 12)
                  .map((entry, index) => (
                    <Cell key={`cell-handset-${index}`} fill={getRSRPPointColor(entry.Avg)} />
                  ))
                }
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
          <div className="absolute inset-0 pointer-events-none" />
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