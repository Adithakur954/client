import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  s = s.replace(/^IND[-\s]*/i, ''); // drop IND- prefix
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

// Ensure RSRP stays negative (if backend accidentally returns positive magnitudes)
const ensureNegative = (v) => {
  const n = toNumber(v, 0);
  if (!Number.isFinite(n)) return 0;
  // Treat bogus positives as magnitudes and flip
  return n > 0 ? -n : n;
};

// Merge operator counts (sum) for “Operator wise Samples”
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

// Merge averages (weighted if sampleCount exists, else average of means)
const mergeOperatorAverages = (raw, { nameKey = 'name', avgKey = 'value', weightKey = 'sampleCount' } = {}) => {
  if (!Array.isArray(raw)) return [];
  const acc = new Map();
  for (const item of raw) {
    const name = canonicalOperatorName(item?.[nameKey]);
    const avg = ensureNegative(item?.[avgKey]); // enforce negative for RSRP
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
    .sort((a, b) => a.value - b.value); // RSRP is negative; more negative first
};

const normalizeArray = (arr, nameKeys = ["name"], valueKeys = ["value"]) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => {
    const name = nameKeys.reduce((acc, key) => acc ?? item?.[key], null);
    const value = valueKeys.reduce((acc, key) => acc ?? item?.[key], null);
    return { ...item, name: String(name ?? ""), value: toNumber(value ?? 0) };
  });
};

// Single normalize method that understands both API responses
const normalizePayload = (resp) => {
  const payload = resp?.Data ?? resp?.data ?? resp ?? {};
  if (typeof payload === "string") return null;

  // 1) Operator wise samples (merge categories and SUM values)
  const operatorWiseSamplesRaw =
    payload.operatorWiseSamples ??
    payload.samplesByAlphaLong ??
    [];
  const operatorWiseSamplesMerged = mergeOperatorCounts(
    normalizeArray(operatorWiseSamplesRaw, ["name", "m_alpha_long"], ["value", "count"]),
    { nameKey: 'name', valueKey: 'value' }
  );

  // 2) Network type distribution
  const networkTypeDistribution = normalizeArray(
    payload.networkTypeDistribution ?? payload.networkTypeDistribution_horizontal_bar,
    ["name", "network"],
    ["value", "count"]
  );

  // 3) Monthly samples
  const monthlySampleCounts = normalizeArray(
    payload.monthlySampleCounts, ["month"], ["count"]
  );

  // 4) Avg RSRP per operator (merge + enforce negatives)
  const avgRsrpRaw =
    payload.avgRsrpPerOperator ?? payload.avgRsrpSinrPerOperator_bar ?? [];
  const avgRsrpPre = normalizeArray(avgRsrpRaw, ["name", "Operator"], ["value", "AvgRSRP"]);
  const avgRsrpPerOperator = mergeOperatorAverages(avgRsrpPre, {
    nameKey: 'name', avgKey: 'value', weightKey: 'sampleCount'
  }).map(x => ({ ...x, value: ensureNegative(x.value) }));

  // 5) Band distribution
  const bandDistribution = normalizeArray(
    payload.bandDistribution ?? payload.bandDistribution_pie,
    ["name", "band"], ["value", "count"]
  );

  // 6) Handset-wise avg (RSRP by make) — enforce negatives
  const handsetDistribution = normalizeArray(
    payload.handsetDistribution ?? payload.handsetWiseAvg_bar,
    ["name", "Make"], ["value", "Avg"]
  ).map(x => ({ ...x, value: ensureNegative(x.value) }));

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
    handsetDistribution
  };
};

// Build ranking dataset with rank number and merged operator categories
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

// ------------------------ UI Components ------------------------
const ChartCard = ({ title, dataset, children }) => {
  const cardRef = useRef(null);
  return (
    <Card ref={cardRef} className="bg-slate-800/80 text-white border-slate-700 backdrop-blur-sm shadow-xl">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-semibold text-slate-200">{title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full hover:bg-slate-700">
                <MoreVertical className="h-4 w-4 text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200">
              <div className="px-3 py-2 text-xs opacity-70">Export</div>
              <DropdownMenuItem className="hover:bg-slate-800">Download PNG</DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-slate-800">Download CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="h-[320px]">
        {!dataset || dataset.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
};

const StatCard = ({ title, value, icon: Icon, color }) => (
  <Card className={`${color} text-white border-none shadow-lg`}>
    <CardContent className="p-4 flex items-center gap-4">
      <Icon className="h-8 w-8 opacity-90" />
      <div className="flex-1">
        <p className="text-3xl font-bold leading-tight">{Number(value ?? 0).toLocaleString()}</p>
        <p className="text-sm opacity-90">{title}</p>
      </div>
    </CardContent>
  </Card>
);

// Tooltip theme
const tooltipStyle = {
  backgroundColor: '#0f172a', // slate-900
  border: '1px solid #334155', // slate-700
  color: '#e2e8f0' // slate-200
};

// Permanent dBm label at end of bar
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
      fill="#e2e8f0"
      dominantBaseline="middle"
      textAnchor={anchor}
      fontSize={12}
      fontWeight={600}
    >
      {`${val} dBm`}
    </text>
  );
};

// ------------------------ Page ------------------------
const DashboardPage = () => {
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);

  // Ranking states and settings
  const [settings, setSettings] = useState({
    rsrpMin: -95, rsrpMax: 0,   // "good coverage" default
    rsrqMin: -10, rsrqMax: 0,   // "good quality" default
  });
  const [rankLoading, setRankLoading] = useState(false);
  const [coverageRank, setCoverageRank] = useState([]); // [{ name, value, rank, label }]
  const [qualityRank, setQualityRank] = useState([]);   // same shape

  // Fetch main dashboard data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [statsResp, graphsResp] = await Promise.all([
          adminApi.getReactDashboardData(),
          adminApi.getDashboardGraphData()
        ]);
        const merged = { ...(statsResp?.Data ?? {}), ...(graphsResp?.Data ?? {}) };
        const normalized = normalizePayload({ Data: merged });
        setPayload(normalized);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
        toast.error(`Failed to load dashboard: ${err?.message ?? 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch ranking charts when settings change
  const fetchRanking = useCallback(async () => {
    setRankLoading(true);
    try {
      // Add these methods in adminApi (see backend section below)
      const [covResp, qualResp] = await Promise.all([
        adminApi.getOperatorCoverageRanking({ min: settings.rsrpMin, max: settings.rsrpMax }),
        adminApi.getOperatorQualityRanking({ min: settings.rsrqMin, max: settings.rsrqMax })
      ]);

      const covPayload = covResp?.Data ?? covResp?.data ?? covResp ?? [];
      const qualPayload = qualResp?.Data ?? qualResp?.data ?? qualResp ?? [];

      const covRank = buildRanking(covPayload, { nameKey: 'name', countKey: 'count' });
      const qualRank = buildRanking(qualPayload, { nameKey: 'name', countKey: 'count' });

      setCoverageRank(covRank);
      setQualityRank(qualRank);
    } catch (err) {
      console.error("Ranking fetch error:", err);
      toast.error(`Failed to load ranking charts: ${err?.message ?? 'Unknown error'}`);
    } finally {
      setRankLoading(false);
    }
  }, [settings]);

  useEffect(() => { fetchRanking(); }, [fetchRanking]);

  const data = payload;

  const stats = useMemo(() => {
    if (!data?.totals) return [];
    return [
      { title: "Users", value: data.totals.users, icon: Users, color: "bg-purple-600" },
      { title: "Total Drive Sessions", value: data.totals.sessions, icon: Car, color: "bg-teal-600" },
      { title: "Online Sessions", value: data.totals.onlineSessions, icon: Waypoints, color: "bg-orange-600" },
      { title: "Total Samples", value: data.totals.samples, icon: FileText, color: "bg-amber-600" },
      { title: "Operators", value: data.totals.operators, icon: Wifi, color: "bg-sky-600" },
      { title: "Technologies", value: data.totals.technologies, icon: BarChart2, color: "bg-pink-600" },
      { title: "Total Bands", value: data.totals.bands, icon: RadioTower, color: "bg-indigo-600" }
    ];
  }, [data]);

  const applySettings = () => {
    // validate ranges a bit
    if (settings.rsrpMin > settings.rsrpMax) return toast.warn("RSRP: Min cannot be greater than Max");
    if (settings.rsrqMin > settings.rsrqMax) return toast.warn("RSRQ: Min cannot be greater than Max");
    fetchRanking();
  };

  if (loading) return <Spinner />;
  if (!data) return <div className="p-6 text-red-500">Failed to load dashboard data.</div>;

  return (
    <div className="h-full  no-scrollbar overflow-y-auto space-y-6 bg-slate-900 text-slate-100 p-6">
      {/* Top toolbar: KPI + Settings */}
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-6">
          {stats.map(s => <StatCard key={s.title} {...s} />)}
        </div>

        {/* Graph Settings */}
        <div className="flex items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-200">
                <SettingsIcon className="h-4 w-4" />
                Graph Settings
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200 w-[320px] p-3">
              <div className="space-y-3 text-sm">
                <div className="font-semibold text-slate-300">RSRP Coverage Range (dBm)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Min</label>
                    <input
                      type="number" step="1"
                      className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700"
                      value={settings.rsrpMin}
                      onChange={(e) => setSettings(s => ({ ...s, rsrpMin: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Max</label>
                    <input
                      type="number" step="1"
                      className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700"
                      value={settings.rsrpMax}
                      onChange={(e) => setSettings(s => ({ ...s, rsrpMax: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="font-semibold text-slate-300 pt-2">RSRQ Quality Range (dB)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Min</label>
                    <input
                      type="number" step="0.5"
                      className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700"
                      value={settings.rsrqMin}
                      onChange={(e) => setSettings(s => ({ ...s, rsrqMin: Number(e.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Max</label>
                    <input
                      type="number" step="0.5"
                      className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700"
                      value={settings.rsrqMax}
                      onChange={(e) => setSettings(s => ({ ...s, rsrqMax: Number(e.target.value) }))}
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    onClick={applySettings}
                    className="w-full px-3 py-2 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Samples (modern area) */}
        <ChartCard title="Monthly Samples" dataset={data.monthlySampleCounts}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.monthlySampleCounts} margin={{ top: 16, right: 24, left: -10, bottom: 8 }}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60A5FA" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#60A5FA" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#60A5FA"
                strokeWidth={2}
                fill="url(#gradBlue)"
                dot={{ r: 2, stroke: '#60A5FA', strokeWidth: 1, fill: '#0ea5e9' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Operator wise Samples (merged categories) */}
        <ChartCard title="Operator wise Samples" dataset={data.operatorWiseSamples}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.operatorWiseSamples} layout="vertical" margin={{ top: 12, right: 40, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#e2e8f0', fontSize: 12 }} />
              <Tooltip cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }} contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: '#e2e8f0', fontSize: '12px', fontWeight: 600 }} />
                {data.operatorWiseSamples.map((entry, index) => (
                  <Cell key={`cell-ops-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Network Type Distribution */}
        <ChartCard title="Network Type Distribution" dataset={data.networkTypeDistribution}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.networkTypeDistribution} layout="vertical" margin={{ top: 12, right: 36, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#e2e8f0', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" fill="#34D399" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: '#e2e8f0', fontSize: '12px', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Avg RSRP per Operator (merged categories, enforced negative) */}
        <ChartCard title="Avg RSRP (dBm) Per Operator" dataset={data.avgRsrpPerOperator}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.avgRsrpPerOperator} layout="vertical" margin={{ top: 12, right: 40, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis type="number" domain={[-120, -60]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={(v) => `${v} dBm`} />
              <YAxis dataKey="name" type="category" width={140} tick={{ fill: '#e2e8f0', fontSize: 12 }} />
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
        <ChartCard title="Band Distribution" dataset={data.bandDistribution}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.bandDistribution} layout="vertical" margin={{ top: 12, right: 36, left: 10, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis dataKey="name" type="category" width={130} tick={{ fill: '#e2e8f0', fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                <LabelList dataKey="value" position="right" style={{ fill: '#e2e8f0', fontSize: '12px', fontWeight: 600 }} />
                {data.bandDistribution.map((entry, index) => (
                  <Cell key={`cell-band-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Handset wise Avg RSRP — enforced negative, with permanent labels & thresholds */}
        <ChartCard title="Handset wise Avg RSRP" dataset={data.handsetDistribution}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data.handsetDistribution}
              layout="vertical"
              margin={{ top: 12, right: 40, left: 10, bottom: 8 }}
              barCategoryGap="25%"
              barSize={14}
            >
               {/* Quality zones */}
  <ReferenceArea x1={-120} x2={-105} fill="#ef4444" fillOpacity={0.06} />
  <ReferenceArea x1={-105} x2={-95} fill="#f59e0b" fillOpacity={0.06} />
  <ReferenceArea x1={-95}  x2={-85} fill="#60a5fa" fillOpacity={0.06} />
  <ReferenceArea x1={-85}  x2={-60} fill="#10b981" fillOpacity={0.06} />

  <XAxis
    type="number"
    domain={[-120, -60]}
    tick={{ fill: '#94a3b8', fontSize: 11 }}
    tickFormatter={(v) => `${v} dBm`}
  />
  <YAxis
    dataKey="name"
    type="category"
    width={180}
    tick={{ fill: '#e2e8f0', fontSize: 12 }}
  />
  <Tooltip
    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', color: '#e2e8f0' }}
    formatter={(v) => [`${Number(v).toFixed(1)} dBm`, 'Avg RSRP']}
  />

  <Bar
    dataKey="value"
    name="Avg RSRP"
    radius={[0, 8, 8, 0]}
    isAnimationActive
    animationDuration={650}
    background={{ fill: 'rgba(148,163,184,0.10)', radius: [0, 8, 8, 0] }}
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
            fill="#e2e8f0"
            dominantBaseline="middle"
            textAnchor="start"
            fontSize={12}
            fontWeight={600}
          >
            {`${Number(value).toFixed(1)} dBm`}
          </text>
        );
      }}
    />
    {
      (data?.handsetDistribution ?? [])
        .map(d => ({ ...d, value: Number(d.value) > 0 ? -Number(d.value) : Number(d.value) }))
        .sort((a, b) => a.value - b.value)
        .slice(0, 12)
        .map((entry, index) => (
          <Cell key={`cell-handset-${index}`} fill={getRSRPPointColor(entry.value)} />
        ))
    }
  </Bar>
</BarChart>
          </ResponsiveContainer>
        </ChartCard>

        
<ChartCard title={`Operator Coverage Rank (RSRP ${settings.rsrpMin} to ${settings.rsrpMax} dBm)`} dataset={coverageRank}>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart
      data={coverageRank}
      margin={{ top: 12, right: 40, left: 10, bottom: 40 }}
      barSize={24}
    >
      <CartesianGrid strokeDasharray="3 3" horizontal stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        interval={0}
        angle={-20}
        textAnchor="end"
        height={50}
        tick={{ fill: '#e2e8f0', fontSize: 12 }}
      />
      <YAxis
        type="number"
        tick={{ fill: '#94a3b8', fontSize: 11 }}
      />
      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Samples in range']} />
      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
        <LabelList dataKey="value" position="top" style={{ fill: '#e2e8f0', fontSize: '12px', fontWeight: 600 }} />
        {coverageRank.map((entry, index) => (
          <Cell key={`cell-cov-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
  {rankLoading && <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center text-slate-300 text-sm">Loading…</div>}
</ChartCard>

       
        <ChartCard title={`Operator Quality Rank (RSRQ ${settings.rsrqMin} to ${settings.rsrqMax} dB)`} dataset={qualityRank}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={qualityRank}
              margin={{ top: 12, right: 40, left: 10, bottom: 40 }}
              barSize={24}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal stroke="rgba(148, 163, 184, 0.2)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
                tick={{ fill: '#e2e8f0', fontSize: 12 }}
              />
              <YAxis
                type="number"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Samples in range']} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                <LabelList dataKey="value" position="top" style={{ fill: '#e2e8f0', fontSize: '12px', fontWeight: 600 }} />
                {qualityRank.map((entry, index) => (
                  <Cell key={`cell-qual-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {rankLoading && <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center text-slate-300 text-sm">Loading…</div>}
        </ChartCard>
      </div>
    </div>
  );
};

export default DashboardPage;