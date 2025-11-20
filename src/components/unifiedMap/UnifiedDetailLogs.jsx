import React, { useEffect, useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import { adminApi } from '@/api/apiEndpoints';
import toast from 'react-hot-toast';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { 
  BarChart3, 
  MapPin, 
  Layers, 
  Signal, 
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  PieChart as PieChartIcon,
  Download,
  Maximize2,
  Minimize2,
  Radio,
  Wifi,
  Zap,
  Gauge,
  Share2,      // Replaces Network
  Antenna,     // Replaces Antenna
  Globe2,
  Network,
  Globe       // Replaces Globe
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  ZAxis,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts';

const StatCard = ({ icon: Icon, label, value, subValue, color = "blue", trend }) => {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]} transition-all hover:scale-105`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs opacity-80 mb-1">{label}</p>
          <p className="text-2xl font-bold flex items-center gap-2">
            {value}
            {trend && (
              trend > 0 ? 
                <TrendingUp className="h-4 w-4 text-green-400" /> : 
                <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </p>
          {subValue && <p className="text-xs opacity-70 mt-1">{subValue}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 opacity-60" />}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all whitespace-nowrap ${
      active
        ? 'bg-blue-600 text-white shadow-lg'
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    } rounded-lg`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

// NEW: Band Distribution Chart
const BandDistributionChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const bandStats = locations.reduce((acc, loc) => {
      const band = loc.band || 'Unknown';
      if (!acc[band]) {
        acc[band] = { count: 0, avgRsrp: [], avgDl: [] };
      }
      acc[band].count++;
      if (loc.rsrp != null) acc[band].avgRsrp.push(loc.rsrp);
      if (loc.dl_thpt != null) acc[band].avgDl.push(parseFloat(loc.dl_thpt));
      return acc;
    }, {});

    return Object.entries(bandStats)
      .map(([name, data]) => ({
        name: `Band ${name}`,
        count: data.count,
        avgRsrp: data.avgRsrp.length > 0 
          ? (data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1)
          : 'N/A',
        avgDl: data.avgDl.length > 0
          ? (data.avgDl.reduce((a, b) => a + b, 0) / data.avgDl.length).toFixed(1)
          : 'N/A',
      }))
      .sort((a, b) => b.count - a.count);
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No band data</div>;
  }

  const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Radio className="h-4 w-4" />
        Frequency Band Distribution
      </h4>
      
      <div className="grid grid-cols-2 gap-4">
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              dataKey="count"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1e293b', 
                border: '1px solid #475569',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="space-y-2 overflow-y-auto max-h-[250px]">
          {data.map((item, idx) => (
            <div key={idx} className="bg-slate-800 p-2 rounded text-xs">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-white font-semibold">{item.name}</span>
                </div>
                <span className="text-slate-300">{item.count} pts</span>
              </div>
              <div className="grid grid-cols-2 gap-1 ml-5 text-xs">
                <div className="text-slate-400">
                  RSRP: <span className="text-blue-400">{item.avgRsrp}</span>
                </div>
                <div className="text-slate-400">
                  DL: <span className="text-cyan-400">{item.avgDl}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// NEW: Operator Comparison Chart
const OperatorComparisonChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const operatorStats = locations.reduce((acc, loc) => {
      const operator = loc.operator || 'Unknown';
      if (!acc[operator]) {
        acc[operator] = { count: 0, avgRsrp: [], avgMos: [], avgDl: [] };
      }
      acc[operator].count++;
      if (loc.rsrp != null) acc[operator].avgRsrp.push(loc.rsrp);
      if (loc.mos != null) acc[operator].avgMos.push(loc.mos);
      if (loc.dl_thpt != null) acc[operator].avgDl.push(parseFloat(loc.dl_thpt));
      return acc;
    }, {});

    return Object.entries(operatorStats)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgRsrp: data.avgRsrp.length > 0 
          ? (data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1)
          : 0,
        avgMos: data.avgMos.length > 0
          ? (data.avgMos.reduce((a, b) => a + b, 0) / data.avgMos.length).toFixed(2)
          : 0,
        avgDl: data.avgDl.length > 0
          ? (data.avgDl.reduce((a, b) => a + b, 0) / data.avgDl.length).toFixed(1)
          : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No operator data</div>;
  }

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Network className="h-4 w-4" />
        Operator Performance Comparison
      </h4>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis yAxisId="left" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Bar yAxisId="left" dataKey="avgRsrp" fill="#3b82f6" name="Avg RSRP" radius={[8, 8, 0, 0]} />
          <Bar yAxisId="right" dataKey="avgMos" fill="#fbbf24" name="Avg MOS" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2">
        {data.map((item, idx) => (
          <div key={idx} className="bg-slate-800 p-2 rounded text-xs">
            <div className="font-semibold text-white mb-1">{item.name}</div>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div className="text-slate-400">
                Samples: <span className="text-white">{item.count}</span>
              </div>
              <div className="text-slate-400">
                RSRP: <span className="text-blue-400">{item.avgRsrp}</span>
              </div>
              <div className="text-slate-400">
                MOS: <span className="text-yellow-400">{item.avgMos}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// NEW: PCI Distribution Chart
const PCIDistributionChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const pciStats = locations.reduce((acc, loc) => {
      const pci = loc.pci || 'Unknown';
      if (!acc[pci]) {
        acc[pci] = { count: 0, avgRsrp: [] };
      }
      acc[pci].count++;
      if (loc.rsrp != null) acc[pci].avgRsrp.push(loc.rsrp);
      return acc;
    }, {});

    return Object.entries(pciStats)
      .map(([name, data]) => ({
        name: `PCI ${name}`,
        count: data.count,
        avgRsrp: data.avgRsrp.length > 0 
          ? (data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1)
          : 'N/A',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No PCI data</div>;
  }

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Antenna className="h-4 w-4" />
        Top 10 Physical Cell IDs (PCI)
      </h4>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Bar dataKey="count" fill="#8b5cf6" name="Sample Count" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

// NEW: Speed vs Signal Quality Scatter
const SpeedVsSignalChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    return locations
      .filter(loc => loc.speed != null && loc.rsrp != null)
      .map(loc => ({
        speed: parseFloat(loc.speed) * 3.6, // m/s to km/h
        rsrp: loc.rsrp,
        sinr: loc.sinr || 0,
      }));
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No speed/signal data</div>;
  }

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Gauge className="h-4 w-4" />
        Speed vs Signal Quality
      </h4>

      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            type="number" 
            dataKey="speed" 
            name="Speed" 
            unit=" km/h"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            label={{ value: 'Speed (km/h)', position: 'insideBottom', offset: -10, fill: '#9CA3AF' }}
          />
          <YAxis 
            type="number" 
            dataKey="rsrp" 
            name="RSRP" 
            unit=" dBm"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            label={{ value: 'RSRP (dBm)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
          />
          <ZAxis type="number" dataKey="sinr" range={[20, 400]} name="SINR" />
          <Tooltip 
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value, name) => {
              if (name === 'Speed') return [`${value.toFixed(1)} km/h`, name];
              if (name === 'RSRP') return [`${value.toFixed(1)} dBm`, name];
              if (name === 'SINR') return [`${value.toFixed(1)} dB`, name];
              return [value, name];
            }}
          />
          <Scatter name="Measurements" data={data} fill="#3b82f6" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
});

// NEW: Throughput Over Time
const ThroughputTimelineChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    return locations
      .filter(loc => loc.timestamp && (loc.dl_thpt != null || loc.ul_thpt != null))
      .map((loc, idx) => ({
        index: idx + 1,
        timestamp: loc.timestamp,
        dl: parseFloat(loc.dl_thpt) || 0,
        ul: parseFloat(loc.ul_thpt) || 0,
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No throughput data</div>;
  }

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <TrendingUp className="h-4 w-4" />
        Throughput Timeline
      </h4>

      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="index"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            label={{ value: 'Sample Number', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
          />
          <YAxis 
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            label={{ value: 'Throughput (Mbps)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value) => `${value.toFixed(2)} Mbps`}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Area type="monotone" dataKey="dl" stackId="1" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} name="Download" />
          <Area type="monotone" dataKey="ul" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} name="Upload" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
});

// NEW: Jitter and Latency Analysis
const JitterLatencyChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    return locations
      .filter(loc => loc.jitter != null || loc.latency != null)
      .map((loc, idx) => ({
        index: idx + 1,
        jitter: parseFloat(loc.jitter) || 0,
        latency: parseFloat(loc.latency) || 0,
      }));
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No jitter/latency data</div>;
  }

  const avgJitter = (data.reduce((sum, d) => sum + d.jitter, 0) / data.length).toFixed(2);
  const avgLatency = (data.reduce((sum, d) => sum + d.latency, 0) / data.length).toFixed(2);

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Network Latency & Jitter
      </h4>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-xs text-slate-400">Avg Latency</div>
          <div className="text-xl font-bold text-pink-400">{avgLatency} ms</div>
        </div>
        <div className="bg-slate-800 rounded p-2 text-center">
          <div className="text-xs text-slate-400">Avg Jitter</div>
          <div className="text-xl font-bold text-indigo-400">{avgJitter} ms</div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="index"
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis 
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value) => `${value.toFixed(2)} ms`}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line type="monotone" dataKey="latency" stroke="#ec4899" strokeWidth={2} dot={false} name="Latency" />
          <Line type="monotone" dataKey="jitter" stroke="#6366f1" strokeWidth={2} dot={false} name="Jitter" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

// NEW: Provider Performance
const ProviderPerformanceChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const providerStats = locations.reduce((acc, loc) => {
      const provider = loc.provider || 'Unknown';
      if (!acc[provider]) {
        acc[provider] = { count: 0, avgRsrp: [], avgMos: [], avgDl: [], avgUl: [] };
      }
      acc[provider].count++;
      if (loc.rsrp != null) acc[provider].avgRsrp.push(loc.rsrp);
      if (loc.mos != null) acc[provider].avgMos.push(loc.mos);
      if (loc.dl_thpt != null) acc[provider].avgDl.push(parseFloat(loc.dl_thpt));
      if (loc.ul_thpt != null) acc[provider].avgUl.push(parseFloat(loc.ul_thpt));
      return acc;
    }, {});

    return Object.entries(providerStats)
      .map(([name, data]) => ({
        name,
        count: data.count,
        avgRsrp: data.avgRsrp.length > 0 
          ? (data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1)
          : 'N/A',
        avgMos: data.avgMos.length > 0
          ? (data.avgMos.reduce((a, b) => a + b, 0) / data.avgMos.length).toFixed(2)
          : 'N/A',
        avgDl: data.avgDl.length > 0
          ? (data.avgDl.reduce((a, b) => a + b, 0) / data.avgDl.length).toFixed(1)
          : 'N/A',
        avgUl: data.avgUl.length > 0
          ? (data.avgUl.reduce((a, b) => a + b, 0) / data.avgUl.length).toFixed(1)
          : 'N/A',
      }))
      .sort((a, b) => b.count - a.count);
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No provider data</div>;
  }

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Globe className="h-4 w-4" />
        Provider Performance Matrix
      </h4>

      <div className="space-y-2">
        {data.map((provider, idx) => (
          <div key={idx} className="bg-slate-800 rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-semibold text-white">{provider.name}</span>
              <span className="text-xs text-slate-400">{provider.count} samples</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="bg-slate-900 p-2 rounded text-center">
                <div className="text-slate-400 mb-1">RSRP</div>
                <div className="text-blue-400 font-bold">{provider.avgRsrp}</div>
              </div>
              <div className="bg-slate-900 p-2 rounded text-center">
                <div className="text-slate-400 mb-1">MOS</div>
                <div className="text-yellow-400 font-bold">{provider.avgMos}</div>
              </div>
              <div className="bg-slate-900 p-2 rounded text-center">
                <div className="text-slate-400 mb-1">DL</div>
                <div className="text-cyan-400 font-bold">{provider.avgDl}</div>
              </div>
              <div className="bg-slate-900 p-2 rounded text-center">
                <div className="text-slate-400 mb-1">UL</div>
                <div className="text-orange-400 font-bold">{provider.avgUl}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

// Keep existing charts...
const SignalDistributionChart = React.forwardRef(({ locations, metric, thresholds }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const currentThresholds = thresholds?.[metric] || [];
    if (currentThresholds.length === 0) return [];

    return currentThresholds.map(threshold => {
      const count = locations.filter(loc => {
        const val = loc[metric];
        return val != null && val >= threshold.min && val <= threshold.max;
      }).length;

      return {
        range: `${threshold.min} to ${threshold.max}`,
        count,
        color: threshold.color,
        percentage: ((count / locations.length) * 100).toFixed(1)
      };
    }).filter(item => item.count > 0);
  }, [locations, metric, thresholds]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No data available</div>;
  }

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        {metric.toUpperCase()} Distribution
      </h4>
      
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="range" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value, name) => [value, name === 'count' ? 'Points' : name]}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-slate-800 p-2 rounded">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
            <span className="text-slate-300 flex-1">{item.range}</span>
            <span className="font-semibold text-white">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
});

const TechnologyBreakdown = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const grouped = locations.reduce((acc, loc) => {
      const tech = loc.technology || 'Unknown';
      if (!acc[tech]) {
        acc[tech] = { count: 0, avgRsrp: [], avgSinr: [] };
      }
      acc[tech].count++;
      if (loc.rsrp != null) acc[tech].avgRsrp.push(loc.rsrp);
      if (loc.sinr != null) acc[tech].avgSinr.push(loc.sinr);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, data]) => ({
      name,
      count: data.count,
      avgRsrp: data.avgRsrp.length > 0 
        ? (data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1)
        : 'N/A',
      avgSinr: data.avgSinr.length > 0
        ? (data.avgSinr.reduce((a, b) => a + b, 0) / data.avgSinr.length).toFixed(1)
        : 'N/A'
    })).sort((a, b) => b.count - a.count);
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No technology data</div>;
  }

  const TECH_COLORS = {
    'LTE': '#10b981',
    '5G': '#8b5cf6',
    '4G': '#3b82f6',
    '3G': '#f59e0b',
    'Unknown': '#6b7280'
  };

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Layers className="h-4 w-4" />
        Technology Distribution
      </h4>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={TECH_COLORS[entry.name] || '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-1">
        {data.map((item, idx) => (
          <div key={idx} className="bg-slate-800 p-2 rounded text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: TECH_COLORS[item.name] || '#6b7280' }}
                />
                <span className="text-white font-semibold">{item.name}</span>
              </div>
              <span className="text-slate-300">{item.count} points</span>
            </div>
            <div className="grid grid-cols-2 gap-2 ml-5">
              <div className="text-slate-400">
                Avg RSRP: <span className="text-blue-400 font-semibold">{item.avgRsrp}</span>
              </div>
              <div className="text-slate-400">
                Avg SINR: <span className="text-green-400 font-semibold">{item.avgSinr}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const MetricComparisonRadar = React.forwardRef(({ locations }, ref) => {
  const chartData = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    return locations.map((loc, index) => {
      const normalizeRsrp = (val) => val != null ? Math.max(0, Math.min(100, ((val + 140) / 40) * 100)) : null;
      const normalizeRsrq = (val) => val != null ? Math.max(0, Math.min(100, ((val + 20) / 10) * 100)) : null;
      const normalizeSinr = (val) => val != null ? Math.max(0, Math.min(100, ((val + 5) / 30) * 100)) : null;
      const normalizeMos = (val) => val != null ? Math.max(0, Math.min(100, (val / 5) * 100)) : null;

      return {
        index: index + 1,
        timestamp: loc.timestamp,
        RSRP: normalizeRsrp(loc.rsrp),
        RSRQ: normalizeRsrq(loc.rsrq),
        SINR: normalizeSinr(loc.sinr),
        MOS: normalizeMos(loc.mos),
        rsrpActual: loc.rsrp?.toFixed(1) || 'N/A',
        rsrqActual: loc.rsrq?.toFixed(1) || 'N/A',
        sinrActual: loc.sinr?.toFixed(1) || 'N/A',
        mosActual: loc.mos?.toFixed(2) || 'N/A',
      };
    });
  }, [locations]);

  const stats = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const metrics = ['rsrp', 'rsrq', 'sinr', 'mos'];
    
    return metrics.map(metric => {
      const values = locations
        .map(loc => loc[metric])
        .filter(val => val != null && !isNaN(val));

      if (values.length === 0) return null;

      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      let normalized;
      if (metric === 'rsrp') {
        normalized = ((avg + 140) / 40) * 100;
      } else if (metric === 'rsrq') {
        normalized = ((avg + 20) / 10) * 100;
      } else if (metric === 'sinr') {
        normalized = ((avg + 5) / 30) * 100;
      } else if (metric === 'mos') {
        normalized = (avg / 5) * 100;
      } else {
        normalized = Math.min((avg / 100) * 100, 100);
      }

      return {
        metric: metric.toUpperCase(),
        value: Math.max(0, Math.min(100, normalized)),
        actual: avg.toFixed(2)
      };
    }).filter(Boolean);
  }, [locations]);

  if (chartData.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No metrics available</div>;
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <div className="text-xs text-slate-400 mb-2 font-semibold">
          Sample #{data.index}
          {data.timestamp && (
            <div className="text-slate-500 font-normal mt-0.5">
              {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          {data.RSRP != null && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                <span className="text-blue-400">RSRP:</span>
              </div>
              <span className="text-white font-semibold">
                {data.rsrpActual} dBm <span className="text-slate-400">({data.RSRP.toFixed(1)}%)</span>
              </span>
            </div>
          )}
          {data.RSRQ != null && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                <span className="text-purple-400">RSRQ:</span>
              </div>
              <span className="text-white font-semibold">
                {data.rsrqActual} dB <span className="text-slate-400">({data.RSRQ.toFixed(1)}%)</span>
              </span>
            </div>
          )}
          {data.SINR != null && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-400"></div>
                <span className="text-green-400">SINR:</span>
              </div>
              <span className="text-white font-semibold">
                {data.sinrActual} dB <span className="text-slate-400">({data.SINR.toFixed(1)}%)</span>
              </span>
            </div>
          )}
          {data.MOS != null && (
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                <span className="text-yellow-400">MOS:</span>
              </div>
              <span className="text-white font-semibold">
                {data.mosActual} <span className="text-slate-400">({data.MOS.toFixed(1)}%)</span>
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3" ref={ref}>
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Multi-Metric Comparison Timeline ({chartData.length} samples)
      </h4>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart 
          data={chartData} 
          margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="index" 
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            label={{ 
              value: 'Sample Number', 
              position: 'insideBottom', 
              offset: -10, 
              fill: '#9CA3AF',
              fontSize: 12
            }}
          />
          <YAxis 
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
            label={{ 
              value: 'Quality Score (%)', 
              angle: -90, 
              position: 'insideLeft', 
              fill: '#9CA3AF',
              fontSize: 12
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ fontSize: '12px' }}
            iconType="line"
            verticalAlign="top"
            height={36}
          />
          
          <Line 
            type="monotone" 
            dataKey="RSRP" 
            stroke="#3b82f6" 
            strokeWidth={2.5}
            dot={false}
            name="RSRP (Signal Strength)"
            connectNulls
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
          
          <Line 
            type="monotone" 
            dataKey="RSRQ" 
            stroke="#a855f7" 
            strokeWidth={2.5}
            dot={false}
            name="RSRQ (Signal Quality)"
            connectNulls
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
          
          <Line 
            type="monotone" 
            dataKey="SINR" 
            stroke="#10b981" 
            strokeWidth={2.5}
            dot={false}
            name="SINR (Signal/Noise)"
            connectNulls
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
          
          <Line 
            type="monotone" 
            dataKey="MOS" 
            stroke="#fbbf24" 
            strokeWidth={2.5}
            dot={false}
            name="MOS (User Experience)"
            connectNulls
            activeDot={{ r: 5, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-4 gap-2 text-xs">
        {stats.map((item, idx) => {
          const colorConfig = {
            RSRP: {
              border: 'border-blue-500/30',
              bg: 'bg-blue-500/10',
              text: 'text-blue-400',
              dot: 'bg-blue-400'
            },
            RSRQ: {
              border: 'border-purple-500/30',
              bg: 'bg-purple-500/10',
              text: 'text-purple-400',
              dot: 'bg-purple-400'
            },
            SINR: {
              border: 'border-green-500/30',
              bg: 'bg-green-500/10',
              text: 'text-green-400',
              dot: 'bg-green-400'
            },
            MOS: {
              border: 'border-yellow-500/30',
              bg: 'bg-yellow-500/10',
              text: 'text-yellow-400',
              dot: 'bg-yellow-400'
            }
          };

          const config = colorConfig[item.metric];

          return (
            <div 
              key={idx} 
              className={`border rounded-lg p-2.5 ${config.border} ${config.bg} transition-all hover:scale-105`}
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-2 h-2 rounded-full ${config.dot}`}></div>
                <div className="text-slate-400 text-xs font-medium">{item.metric}</div>
              </div>
              <div className={`font-bold text-base ${config.text}`}>
                {item.actual}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                Score: {item.value.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

// Main Component
function UnifiedDetailLogs({
  locations = [],
  totalLocations = 0,
  filteredCount = 0,
  dataToggle,
  enableDataToggle,
  selectedMetric,
  siteData = [],
  siteToggle,
  appSummary,
  enableSiteToggle,
  showSiteMarkers,
  showSiteSectors,
  polygons = [],
  visiblePolygons = [],
  polygonSource,
  showPolygons,
  onlyInsidePolygons,
  coverageHoleFilters,
  viewport,
  mapCenter,
  projectId,
  sessionIds = [],
  isLoading,
  thresholds,
  logArea,
  onClose,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [appSubTab, setAppSubTab] = useState('details');

  // Refs for all charts
  const distributionChartRef = useRef(null);
  const techChartRef = useRef(null);
  const radarChartRef = useRef(null);
  const bandChartRef = useRef(null);
  const operatorChartRef = useRef(null);
  const pciChartRef = useRef(null);
  const speedChartRef = useRef(null);
  const throughputTimelineRef = useRef(null);
  const jitterLatencyRef = useRef(null);
  const providerPerfRef = useRef(null);
  const mosChartRef = useRef(null);
  const throughputChartRef = useRef(null);
  const signalChartRef = useRef(null);
  const qoeChartRef = useRef(null);
  const indoorCount = useRef(null);
  const outdoorCount = useRef(null);

  // Fetch duration using SWR
  const fetchDuration = async () => {
    if (!sessionIds || sessionIds.length === 0) return null;
    const payload = { session_ids: sessionIds };
    const resp = await adminApi.getNetworkDurations(payload);
    return resp?.Data || null;
  };

  const { data: duration } = useSWR(
    sessionIds && sessionIds.length > 0 ? ['network-duration', sessionIds] : null,
    fetchDuration,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const stats = useMemo(() => {
    if (!locations || locations.length === 0) return null;

    const values = locations
      .map(loc => loc[selectedMetric])
      .filter(val => val != null && !isNaN(val));

    if (values.length === 0) return null;

    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    return { avg, min, max, median, count: values.length };
  }, [locations, selectedMetric]);

  const polygonStats = useMemo(() => {
    if (!polygons || polygons.length === 0) return null;

    const withPoints = polygons.filter(p => p.pointCount > 0);
    const totalPoints = polygons.reduce((sum, p) => sum + (p.pointCount || 0), 0);
    const avgPoints = withPoints.length > 0 ? totalPoints / withPoints.length : 0;

    return {
      total: polygons.length,
      withData: withPoints.length,
      totalPoints,
      avgPoints: avgPoints.toFixed(1)
    };
  }, [polygons]);


  const ioSummary = useMemo(() => {
  if (!logArea || typeof logArea !== 'object') return null;

  let totalIndoor = 0;
  let totalOutdoor = 0;

  Object.values(logArea).forEach(session => {
    if (session.Indoor?.inputCount) {
      totalIndoor += session.Indoor.inputCount;
    }
    if (session.Outdoor?.inputCount) {
      totalOutdoor += session.Outdoor.inputCount;
    }
  });

  return {
    indoor: totalIndoor,
    outdoor: totalOutdoor,
    total: totalIndoor + totalOutdoor
  };
}, [logArea]);

  const handleExport = async () => {
    try {
      toast.loading('Preparing comprehensive export...', { id: 'export' });

      const zip = new JSZip();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);

      const wb = XLSX.utils.book_new();

     
      const summaryData = [
        ['Analytics Export Report'],
        ['Generated:', new Date().toLocaleString()],
        ['Project ID:', projectId],
        ['Session IDs:', sessionIds.join(', ')],
        [''],
        ['Summary Statistics'],
        ['Total Points:', totalLocations],
        ['Filtered Points:', filteredCount],
        ['Selected Metric:', selectedMetric?.toUpperCase()],
        ['Indoor Points:', logArea ? logArea.Indoor?.inputCount : 'N/A'],
        ['Outdoor Points:', logArea ? logArea.Outdoor?.inputCount : 'N/A'],
        [''],
      ];

      if (stats) {
        summaryData.push(
          ['Metric Statistics'],
          ['Average:', stats.avg.toFixed(2)],
          ['Minimum:', stats.min.toFixed(2)],
          ['Maximum:', stats.max.toFixed(2)],
          ['Median:', stats.median.toFixed(2)],
          ['Count:', stats.count]
        );
      }

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

      // Location data
      if (locations && locations.length > 0) {
        const locationData = locations.map(loc => ({
          'Latitude': loc.lat,
          'Longitude': loc.lng,
          'Operator': loc.operator || 'N/A',
          'Provider': loc.provider || 'N/A',
          'Technology': loc.technology || 'N/A',
          'Band': loc.band || 'N/A',
          'PCI': loc.pci || 'N/A',
          'RSRP (dBm)': loc.rsrp || 'N/A',
          'RSRQ (dB)': loc.rsrq || 'N/A',
          'SINR (dB)': loc.sinr || 'N/A',
          'DL Throughput (Mbps)': loc.dl_thpt || 'N/A',
          'UL Throughput (Mbps)': loc.ul_thpt || 'N/A',
          'MOS': loc.mos || 'N/A',
          'Latency (ms)': loc.latency || 'N/A',
          'Jitter (ms)': loc.jitter || 'N/A',
          'Speed (m/s)': loc.speed || 'N/A',
          'Timestamp': loc.timestamp || 'N/A',
        }));
        const wsLocations = XLSX.utils.json_to_sheet(locationData);
        XLSX.utils.book_append_sheet(wb, wsLocations, 'Location Data');
      }

      // App summary
      if (appSummary && Object.keys(appSummary).length > 0) {
        const appData = [];
        Object.entries(appSummary).forEach(([sessionId, apps]) => {
          Object.entries(apps).forEach(([appName, metrics]) => {
            appData.push({
              'Session ID': sessionId,
              'Application': metrics.appName || appName,
              'Duration': metrics.durationHHMMSS || 'N/A',
              'Samples': metrics.sampleCount || 0,
              'MOS Score': metrics.avgMos?.toFixed(2) || 'N/A',
              'Avg RSRP (dBm)': metrics.avgRsrp?.toFixed(1) || 'N/A',
              'Avg RSRQ (dB)': metrics.avgRsrq?.toFixed(1) || 'N/A',
              'Avg SINR (dB)': metrics.avgSinr?.toFixed(1) || 'N/A',
              'Avg DL (Mbps)': metrics.avgDlTptMbps?.toFixed(2) || 'N/A',
              'Avg UL (Mbps)': metrics.avgUlTptMbps?.toFixed(2) || 'N/A',
              'Avg Latency (ms)': metrics.avgLatency?.toFixed(2) || 'N/A',
              'Avg Jitter (ms)': metrics.avgJitter?.toFixed(2) || 'N/A',
              'Packet Loss (%)': metrics.avgPacketLoss?.toFixed(2) || 'N/A',
              'First Used': metrics.firstUsedAt || 'N/A',
              'Last Used': metrics.lastUsedAt || 'N/A',
            });
          });
        });
        const wsApps = XLSX.utils.json_to_sheet(appData);
        XLSX.utils.book_append_sheet(wb, wsApps, 'Application Performance');
      }

      if (duration) {
        const durationData = [
          ['Session Duration Information'],
          ['Total Duration:', duration.total_duration || 'N/A'],
          ['Start Time:', duration.start_time || 'N/A'],
          ['End Time:', duration.end_time || 'N/A'],
        ];
        const wsDuration = XLSX.utils.aoa_to_sheet(durationData);
        XLSX.utils.book_append_sheet(wb, wsDuration, 'Duration');
      }

      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      zip.file(`analytics-data-${timestamp}.xlsx`, excelBuffer);

      // Capture charts
      const captureChart = async (ref, filename) => {
        if (ref.current) {
          try {
            const canvas = await html2canvas(ref.current, {
              backgroundColor: '#0f172a',
              scale: 2,
              logging: false,
            });
            const blob = await new Promise(resolve => canvas.toBlob(resolve));
            zip.file(filename, blob);
          } catch (error) {
            console.error(`Failed to capture ${filename}:`, error);
          }
        }
      };

      // Capture all charts
      await Promise.all([
        captureChart(distributionChartRef, `signal-distribution-${timestamp}.png`),
        captureChart(techChartRef, `technology-breakdown-${timestamp}.png`),
        captureChart(radarChartRef, `metric-comparison-${timestamp}.png`),
        captureChart(bandChartRef, `band-distribution-${timestamp}.png`),
        captureChart(operatorChartRef, `operator-comparison-${timestamp}.png`),
        captureChart(pciChartRef, `pci-distribution-${timestamp}.png`),
        captureChart(speedChartRef, `speed-vs-signal-${timestamp}.png`),
        captureChart(throughputTimelineRef, `throughput-timeline-${timestamp}.png`),
        captureChart(jitterLatencyRef, `jitter-latency-${timestamp}.png`),
        captureChart(providerPerfRef, `provider-performance-${timestamp}.png`),
        captureChart(mosChartRef, `mos-comparison-${timestamp}.png`),
        captureChart(throughputChartRef, `throughput-comparison-${timestamp}.png`),
        captureChart(signalChartRef, `signal-quality-${timestamp}.png`),
        captureChart(qoeChartRef, `qoe-comparison-${timestamp}.png`),
      ]);

      const readme = `Analytics Export Report
=======================
Generated: ${new Date().toLocaleString()}
Project ID: ${projectId}
Session IDs: ${sessionIds.join(', ')}

Contents:
---------
1. Excel File (analytics-data-${timestamp}.xlsx):
   - Summary: Overview and statistics
   - Location Data: Complete dataset with all fields
   - Application Performance: App-wise performance metrics
   - Duration: Session duration information

2. Chart Images (PNG format):
   - Signal Distribution
   - Technology Breakdown
   - Metric Comparison Timeline
   - Band Distribution
   - Operator Comparison
   - PCI Distribution
   - Speed vs Signal Quality
   - Throughput Timeline
   - Jitter & Latency Analysis
   - Provider Performance Matrix
   - Application Performance Charts

Notes:
------
- All metrics are averaged where applicable
- N/A indicates missing or unavailable data
- Charts are high-resolution (2x scale)
`;

      zip.file('README.txt', readme);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      saveAs(zipBlob, `analytics-export-${timestamp}.zip`);

      toast.success('Comprehensive export completed!', { id: 'export' });
    } catch (error) {
      console.error('Export error:', error);
      toast.error(`Export failed: ${error.message}`, { id: 'export' });
    }
  };

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-40 flex gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Show Analytics
        </button>
        <button
          onClick={onClose}
          className="bg-red-900 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-red-800 transition-all"
          title="Close Analytics"
        >
          ✕
        </button>
      </div>
    );
  }

  const containerWidth = expanded ? 'w-[95vw] max-w-[1400px]' : 'w-[480px]';

  return (
    <div className={`fixed ${expanded ? 'top-20 left-1/2 -translate-x-1/2' : 'bottom-4 right-4'} z-40 ${containerWidth} bg-slate-950 text-white rounded-lg shadow-2xl border border-slate-700 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900 rounded-t-lg">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold">Analytics</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!locations || locations.length === 0}
            className="flex items-center gap-2 text-slate-400 hover:text-green-400 transition-colors p-2 rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download Complete Analytics Package"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs font-medium hidden lg:inline">Export All</span>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-800"
            title={expanded ? "Minimize" : "Expand"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800 font-bold"
            title="Collapse"
          >
            −
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-slate-800"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-3 bg-slate-900 border-b border-slate-700 overflow-x-auto">
        <TabButton 
          active={activeTab === 'overview'} 
          onClick={() => setActiveTab('overview')}
          icon={BarChart3}
        >
          Overview
        </TabButton>
        <TabButton 
          active={activeTab === 'signal'} 
          onClick={() => setActiveTab('signal')}
          icon={Signal}
        >
          Signal
        </TabButton>
        <TabButton 
          active={activeTab === 'network'} 
          onClick={() => setActiveTab('network')}
          icon={Wifi}
        >
          Network
        </TabButton>
        <TabButton 
          active={activeTab === 'performance'} 
          onClick={() => setActiveTab('performance')}
          icon={Zap}
        >
          Performance
        </TabButton>
        <TabButton 
          active={activeTab === 'Application'} 
          onClick={() => setActiveTab('Application')}
          icon={PieChartIcon}
        >
          Apps
        </TabButton>
        <TabButton 
          active={activeTab === 'comparison'} 
          onClick={() => setActiveTab('comparison')}
          icon={Activity}
        >
          Timeline
        </TabButton>
      </div>

      {/* Content */}
      <div className={`${expanded ? 'max-h-[calc(100vh-200px)]' : 'max-h-[70vh]'} overflow-y-auto p-4 space-y-4`}>
        {isLoading && (
          <div className="text-center py-8 text-slate-400">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading analytics...
          </div>
        )}

       

{activeTab === 'overview' && (
  <div className="space-y-4">
    <div className={`grid ${expanded ? 'grid-cols-4' : 'grid-cols-2'} gap-3`}>
      <StatCard
        icon={MapPin}
        label="Total Points"
        value={totalLocations.toLocaleString()}
        color="blue"
      />
      <StatCard
        icon={Activity}
        label="Displayed"
        value={filteredCount.toLocaleString()}
        color="green"
      />
      
      {enableSiteToggle && (
        <StatCard
          icon={Layers}
          label="Sites"
          value={siteData.length}
          subValue={siteToggle}
          color="purple"
        />
      )}
      {showPolygons && polygonStats && (
        <StatCard
          icon={Layers}
          label="Polygons"
          value={polygonStats.total}
          subValue={`${polygonStats.withData} with data`}
          color="orange"
        />
      )}
    </div>

    {/* Indoor/Outdoor Count Boxes */}
   

    {stats && (
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {selectedMetric.toUpperCase()} Statistics
        </h4>
        
        <div className={`grid ${expanded ? 'grid-cols-5' : 'grid-cols-3'} gap-3`}>
          <div className="bg-slate-800 rounded p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Average</div>
            <div className="text-xl font-bold text-white">{stats.avg.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800 rounded p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Minimum</div>
            <div className="text-xl font-bold text-blue-400">{stats.min.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800 rounded p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Maximum</div>
            <div className="text-xl font-bold text-green-400">{stats.max.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800 rounded p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Median</div>
            <div className="text-xl font-bold text-purple-400">{stats.median.toFixed(2)}</div>
          </div>
          <div className="bg-slate-800 rounded p-3 text-center">
            <div className="text-xs text-slate-400 mb-1">Count</div>
            <div className="text-xl font-bold text-yellow-400">{stats.count}</div>
          </div>
        </div>
      </div>
    )}

     {ioSummary && (ioSummary.indoor > 0 || ioSummary.outdoor > 0) && (
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Indoor/Outdoor Distribution
        </h4>
        
        <div className="grid grid-cols-2 gap-3">
          {/* Indoor Box */}
          {ioSummary.indoor > 0 && (
            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-lg p-4 hover:shadow-lg hover:shadow-cyan-500/10 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-cyan-500/20 p-2.5 rounded-lg">
                  <svg 
                    className="h-6 w-6 text-cyan-400" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-cyan-300/70 font-medium">Indoor Points</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {ioSummary.indoor.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-cyan-500/20">
                <span className="text-xs text-slate-400">Percentage of Total</span>
                <span className="text-sm font-semibold text-cyan-400">
                  {ioSummary.total > 0 ? `${((ioSummary.indoor / ioSummary.total) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>
          )}
          
          {/* Outdoor Box */}
          {ioSummary.outdoor > 0 && (
            <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 rounded-lg p-4 hover:shadow-lg hover:shadow-green-500/10 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <div className="bg-green-500/20 p-2.5 rounded-lg">
                  <svg 
                    className="h-6 w-6 text-green-400" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-green-300/70 font-medium">Outdoor Points</div>
                  <div className="text-2xl font-bold text-green-400">
                    {ioSummary.outdoor.toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-green-500/20">
                <span className="text-xs text-slate-400">Percentage of Total</span>
                <span className="text-sm font-semibold text-green-400">
                  {ioSummary.total > 0 ? `${((ioSummary.outdoor / ioSummary.total) * 100).toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {duration && (
      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Session Information
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-slate-800 p-3 rounded">
            <div className="text-slate-400 text-xs mb-1">Duration</div>
            <div className="text-white font-semibold">{duration.total_duration || 'N/A'}</div>
          </div>
          <div className="bg-slate-800 p-3 rounded">
            <div className="text-slate-400 text-xs mb-1">Start Time</div>
            <div className="text-white font-semibold">
              {duration.start_time ? new Date(duration.start_time).toLocaleTimeString() : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
)}
        {/* Signal Tab */}
        {activeTab === 'signal' && (
          <div className={`grid ${expanded ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <SignalDistributionChart
              ref={distributionChartRef}
              locations={locations}
              metric={selectedMetric}
              thresholds={thresholds}
            />
            <TechnologyBreakdown ref={techChartRef} locations={locations} />
          </div>
        )}

        {/* Network Tab */}
        {activeTab === 'network' && (
          <div className={`grid ${expanded ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <BandDistributionChart ref={bandChartRef} locations={locations} />
            <OperatorComparisonChart ref={operatorChartRef} locations={locations} />
            <PCIDistributionChart ref={pciChartRef} locations={locations} />
            <ProviderPerformanceChart ref={providerPerfRef} locations={locations} />
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className={`grid ${expanded ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <ThroughputTimelineChart ref={throughputTimelineRef} locations={locations} />
            <JitterLatencyChart ref={jitterLatencyRef} locations={locations} />
            <SpeedVsSignalChart ref={speedChartRef} locations={locations} />
          </div>
        )}

        {/* Application Tab - Keep existing code */}
        {activeTab === 'Application' && (
          <div className="space-y-4">
            <div className="flex gap-2 bg-slate-800 p-2 rounded-lg">
              <button
                onClick={() => setAppSubTab('details')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  appSubTab === 'details'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <Activity className="h-4 w-4" />
                  App Details
                </div>
              </button>
              <button
                onClick={() => setAppSubTab('comparison')}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  appSubTab === 'comparison'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Comparison Charts
                </div>
              </button>
            </div>

            {appSubTab === 'details' && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Application Performance Summary
                </h4>
                
                {appSummary && Object.keys(appSummary).length > 0 ? (
                  <div className={`grid ${expanded ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                    {Object.entries(appSummary).flatMap(([sessionId, apps]) =>
                      Object.entries(apps).map(([appName, metrics]) => (
                        <div key={`${sessionId}-${appName}`} className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
                            <div className="font-semibold text-white flex items-center gap-2">
                              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                              {metrics.appName || appName}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-400">Session</span>
                              <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded font-mono">
                                {sessionId}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                            <div className="bg-slate-900 p-2 rounded">
                              <div className="text-slate-400 mb-1">Duration</div>
                              <div className="text-white font-semibold">
                                {metrics.durationHHMMSS || 'N/A'}
                              </div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded">
                              <div className="text-slate-400 mb-1">Samples</div>
                              <div className="text-white font-semibold">
                                {metrics.sampleCount || 0}
                              </div>
                            </div>
                            <div className="bg-slate-900 p-2 rounded">
                              <div className="text-slate-400 mb-1">MOS Score</div>
                              <div className="text-yellow-400 font-semibold text-lg">
                                {metrics.avgMos != null ? metrics.avgMos.toFixed(2) : 'N/A'}
                              </div>
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
                              <Signal className="h-3 w-3" />
                              Signal Quality
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400">RSRP (dBm)</div>
                                <div className={`font-semibold ${
                                  metrics.avgRsrp >= -90 ? 'text-green-400' :
                                  metrics.avgRsrp >= -105 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {metrics.avgRsrp != null ? metrics.avgRsrp.toFixed(1) : 'N/A'}
                                </div>
                              </div>
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400">RSRQ (dB)</div>
                                <div className="text-purple-400 font-semibold">
                                  {metrics.avgRsrq != null ? metrics.avgRsrq.toFixed(1) : 'N/A'}
                                </div>
                              </div>
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400">SINR (dB)</div>
                                <div className="text-green-400 font-semibold">
                                  {metrics.avgSinr != null ? metrics.avgSinr.toFixed(1) : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mb-3">
                            <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Throughput
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400 mb-1">Download</div>
                                <div className="text-cyan-400 font-semibold text-base">
                                  {metrics.avgDlTptMbps != null 
                                    ? `${metrics.avgDlTptMbps.toFixed(1)}`
                                    : 'N/A'}
                                  {metrics.avgDlTptMbps != null && (
                                    <span className="text-xs ml-1">Mbps</span>
                                  )}
                                </div>
                              </div>
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400 mb-1">Upload</div>
                                <div className="text-orange-400 font-semibold text-base">
                                  {metrics.avgUlTptMbps != null 
                                    ? `${metrics.avgUlTptMbps.toFixed(1)}`
                                    : 'N/A'}
                                  {metrics.avgUlTptMbps != null && (
                                    <span className="text-xs ml-1">Mbps</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div>
                            <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
                              <Activity className="h-3 w-3" />
                              Quality of Experience
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400">Latency</div>
                                <div className={`font-semibold ${
                                  metrics.avgLatency < 50 ? 'text-green-400' :
                                  metrics.avgLatency < 100 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {metrics.avgLatency != null 
                                    ? `${metrics.avgLatency.toFixed(1)}ms`
                                    : 'N/A'}
                                </div>
                              </div>
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400">Jitter</div>
                                <div className="text-indigo-400 font-semibold">
                                  {metrics.avgJitter != null 
                                    ? `${metrics.avgJitter.toFixed(1)}ms`
                                    : 'N/A'}
                                </div>
                              </div>
                              <div className="bg-slate-900 p-2 rounded">
                                <div className="text-slate-400">Pkt Loss</div>
                                <div className={`font-semibold ${
                                  metrics.avgPacketLoss === 0 ? 'text-green-400' :
                                  metrics.avgPacketLoss < 1 ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {metrics.avgPacketLoss != null 
                                    ? `${metrics.avgPacketLoss.toFixed(1)}%`
                                    : 'N/A'}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
                    <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No application performance data available</p>
                  </div>
                )}
              </div>
            )}

            {appSubTab === 'comparison' && (
              <div className="space-y-4">
                {appSummary && Object.keys(appSummary).length > 0 ? (() => {
                  const chartData = Object.entries(appSummary).flatMap(([sessionId, apps]) =>
                    Object.entries(apps).map(([appName, metrics]) => ({
                      name: metrics.appName || appName,
                      mos: metrics.avgMos || 0,
                      dl: metrics.avgDlTptMbps || 0,
                      ul: metrics.avgUlTptMbps || 0,
                      latency: metrics.avgLatency || 0,
                      jitter: metrics.avgJitter || 0,
                      packetLoss: metrics.avgPacketLoss || 0,
                      rsrp: metrics.avgRsrp || 0,
                      rsrq: metrics.avgRsrq || 0,
                      sinr: metrics.avgSinr || 0,
                      sessionId
                    }))
                  );

                  return (
                    <>
                      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700" ref={mosChartRef}>
                        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4" />
                          MOS Score Comparison
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="name" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tick={{ fill: '#9CA3AF', fontSize: 11 }}
                            />
                            <YAxis domain={[0, 5]} tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                            <Bar dataKey="mos" fill="#fbbf24" name="MOS Score" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700" ref={throughputChartRef}>
                        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Throughput Comparison
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="name" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tick={{ fill: '#9CA3AF', fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                              formatter={(value) => `${value.toFixed(2)} Mbps`}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                            <Bar dataKey="dl" fill="#06b6d4" name="Download (Mbps)" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="ul" fill="#f97316" name="Upload (Mbps)" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700" ref={signalChartRef}>
                        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                          <Signal className="h-4 w-4" />
                          Signal Quality Comparison
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="name" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tick={{ fill: '#9CA3AF', fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                            <Line type="monotone" dataKey="rsrp" stroke="#3b82f6" name="RSRP (dBm)" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="rsrq" stroke="#a855f7" name="RSRQ (dB)" strokeWidth={2} dot={{ r: 4 }} />
                            <Line type="monotone" dataKey="sinr" stroke="#10b981" name="SINR (dB)" strokeWidth={2} dot={{ r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-slate-900 rounded-lg p-4 border border-slate-700" ref={qoeChartRef}>
                        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Quality of Experience Comparison
                        </h4>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis 
                              dataKey="name" 
                              angle={-45}
                              textAnchor="end"
                              height={80}
                              tick={{ fill: '#9CA3AF', fontSize: 11 }}
                            />
                            <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#1e293b', 
                                border: '1px solid #475569',
                                borderRadius: '8px',
                                color: '#fff'
                              }}
                              formatter={(value, name) => {
                                if (name === 'Latency (ms)' || name === 'Jitter (ms)') {
                                  return `${value.toFixed(2)} ms`;
                                }
                                return `${value.toFixed(2)}%`;
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} iconType="circle" />
                            <Bar dataKey="latency" fill="#ec4899" name="Latency (ms)" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="jitter" fill="#6366f1" name="Jitter (ms)" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="packetLoss" fill="#ef4444" name="Packet Loss (%)" radius={[8, 8, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  );
                })() : (
                  <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
                    <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 text-sm">No comparison data available</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Timeline Tab */}
        {activeTab === 'comparison' && (
          <div className="space-y-4">
            <MetricComparisonRadar
              ref={radarChartRef}
              locations={locations}
            />
          </div>
        )}

        {/* Session Info Footer */}
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-xs space-y-2">
          {projectId && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Project ID:</span>
              <span className="font-mono text-blue-400 font-semibold">{projectId}</span>
            </div>
          )}
          {sessionIds.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Session IDs:</span>
              <span className="font-mono text-green-400 font-semibold">{sessionIds.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UnifiedDetailLogs;