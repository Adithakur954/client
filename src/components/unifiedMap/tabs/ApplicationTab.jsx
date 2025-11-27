import React, { useState, useMemo } from "react";
import { Activity, BarChart3, Signal, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";


export const ApplicationTab = ({ appSummary, expanded, chartRefs }) => {
  const [appSubTab, setAppSubTab] = useState("details");

  const chartData = useMemo(() => {
  if (!appSummary || !Object.keys(appSummary).length) return [];

  // Aggregate by app name
  const appAggregates = {};

  Object.entries(appSummary).forEach(([sessionId, apps]) => {
    Object.entries(apps).forEach(([appName, metrics]) => {
      const name = metrics.appName || appName;
      
      if (!appAggregates[name]) {
        appAggregates[name] = {
          name,
          totalMos: 0,
          totalDl: 0,
          totalUl: 0,
          totalLatency: 0,
          count: 0,
          sessionIds: [],
        };
      }
      
      appAggregates[name].totalMos += metrics.avgMos || 0;
      appAggregates[name].totalDl += metrics.avgDlTptMbps || 0;
      appAggregates[name].totalUl += metrics.avgUlTptMbps || 0;
      appAggregates[name].totalLatency += metrics.avgLatency || 0;
      appAggregates[name].count += 1;
      appAggregates[name].sessionIds.push(sessionId);
    });
  });

  // Calculate averages
  return Object.values(appAggregates).map((app) => ({
    name: app.name,
    mos: app.count > 0 ? app.totalMos / app.count : 0,
    dl: app.count > 0 ? app.totalDl / app.count : 0,
    ul: app.count > 0 ? app.totalUl / app.count : 0,
    latency: app.count > 0 ? app.totalLatency / app.count : 0,
    sessionCount: app.count,
    sessionIds: app.sessionIds,
  }));
}, [appSummary]);

  if (!appSummary || Object.keys(appSummary).length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-800 rounded-lg p-6 text-center border border-slate-700">
          <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-2">No Application Performance Data Available</p>
          <p className="text-slate-500 text-xs">
            Application metrics will appear here when data is available from your sessions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-Tab Navigation */}
      <div className="flex gap-2 bg-slate-800 p-2 rounded-lg">
        <button
          onClick={() => setAppSubTab("details")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            appSubTab === "details"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Activity className="h-4 w-4" />
            App Details ({Object.keys(appSummary).length})
          </div>
        </button>
        <button
          onClick={() => setAppSubTab("comparison")}
          className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
            appSubTab === "comparison"
              ? "bg-blue-600 text-white shadow-md"
              : "bg-slate-700 text-slate-300 hover:bg-slate-600"
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Comparison Charts
          </div>
        </button>
      </div>

      {/* Details Sub-Tab */}
      {appSubTab === "details" && (
        <AppDetailsView appSummary={appSummary} expanded={expanded} />
      )}

      {/* Comparison Sub-Tab */}
      {appSubTab === "comparison" && (
        <AppComparisonView chartData={chartData} chartRefs={chartRefs} />
      )}
    </div>
  );
};

// App Details View
const AppDetailsView = ({ appSummary, expanded }) => {
  return (
    <div className={`grid ${expanded ? "grid-cols-2" : "grid-cols-1"} gap-3`}>
      {Object.entries(appSummary).flatMap(([sessionId, apps]) =>
        Object.entries(apps).map(([appName, metrics]) => (
          <AppPerformanceCard
            key={`${sessionId}-${appName}`}
            sessionId={sessionId}
            appName={appName}
            metrics={metrics}
          />
        ))
      )}
    </div>
  );
};

// App Performance Card
const AppPerformanceCard = ({ sessionId, appName, metrics }) => (
  <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-colors">
    {/* Header */}
    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-700">
      <div className="font-semibold text-white flex items-center gap-2">
        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
        {metrics.appName || appName}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="text-slate-400">Session</span>
        <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded font-mono text-[10px]">
          {sessionId}
        </span>
      </div>
    </div>

    {/* Duration, Samples, MOS */}
    <div className="grid grid-cols-3 gap-2 text-xs mb-3">
      <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
        <div className="text-slate-400 mb-1">Duration</div>
        <div className="text-white font-semibold">{metrics.durationHHMMSS || "N/A"}</div>
      </div>
      <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
        <div className="text-slate-400 mb-1">Samples</div>
        <div className="text-white font-semibold">{metrics.sampleCount || 0}</div>
      </div>
      <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
        <div className="text-slate-400 mb-1">MOS</div>
        <div className="text-yellow-400 font-semibold text-lg">
          {metrics.avgMos != null ? metrics.avgMos.toFixed(2) : "N/A"}
        </div>
      </div>
    </div>

    {/* Signal Quality */}
    <div className="mb-3">
      <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
        <Signal className="h-3 w-3" />
        Signal Quality
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">RSRP (dBm)</div>
          <div className={getSignalColor(metrics.avgRsrp, [-90, -105])}>
            {metrics.avgRsrp != null ? metrics.avgRsrp.toFixed(1) : "N/A"}
          </div>
        </div>
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">RSRQ (dB)</div>
          <div className="font-semibold text-purple-400">
            {metrics.avgRsrq != null ? metrics.avgRsrq.toFixed(1) : "N/A"}
          </div>
        </div>
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">SINR (dB)</div>
          <div className="font-semibold text-green-400">
            {metrics.avgSinr != null ? metrics.avgSinr.toFixed(1) : "N/A"}
          </div>
        </div>
      </div>
    </div>

    {/* Throughput */}
    <div className="mb-3">
      <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        Throughput
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">Download</div>
          <div className="font-semibold text-cyan-400">
            {metrics.avgDlTptMbps != null ? `${metrics.avgDlTptMbps.toFixed(1)} Mbps` : "N/A"}
          </div>
        </div>
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">Upload</div>
          <div className="font-semibold text-orange-400">
            {metrics.avgUlTptMbps != null ? `${metrics.avgUlTptMbps.toFixed(1)} Mbps` : "N/A"}
          </div>
        </div>
      </div>
    </div>

    {/* QoE Metrics */}
    <div>
      <div className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1">
        <Activity className="h-3 w-3" />
        Quality of Experience
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">Latency</div>
          <div className={getLatencyColor(metrics.avgLatency)}>
            {metrics.avgLatency != null ? `${metrics.avgLatency.toFixed(1)} ms` : "N/A"}
          </div>
        </div>
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">Jitter</div>
          <div className="font-semibold text-indigo-400">
            {metrics.avgJitter != null ? `${metrics.avgJitter.toFixed(1)} ms` : "N/A"}
          </div>
        </div>
        <div className="bg-slate-900 p-2 rounded hover:bg-slate-850 transition-colors">
          <div className="text-slate-400 text-[10px]">Loss</div>
          <div className={getPacketLossColor(metrics.avgPacketLoss)}>
            {metrics.avgPacketLoss != null ? `${metrics.avgPacketLoss.toFixed(1)}%` : "N/A"}
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Helper functions for color classes
const getSignalColor = (value, thresholds) => {
  if (value == null) return "font-semibold text-slate-400";
  if (value >= thresholds[0]) return "font-semibold text-green-400";
  if (value >= thresholds[1]) return "font-semibold text-yellow-400";
  return "font-semibold text-red-400";
};

const getLatencyColor = (value) => {
  if (value == null) return "font-semibold text-slate-400";
  if (value < 50) return "font-semibold text-green-400";
  if (value < 100) return "font-semibold text-yellow-400";
  return "font-semibold text-red-400";
};

const getPacketLossColor = (value) => {
  if (value == null) return "font-semibold text-slate-400";
  if (value === 0) return "font-semibold text-green-400";
  if (value < 1) return "font-semibold text-yellow-400";
  return "font-semibold text-red-400";
};

// App Comparison View
const AppComparisonView = ({ chartData, chartRefs }) => {
  if (!chartData?.length) {
    return (
      <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
        <BarChart3 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm">No application data for comparison</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* MOS Comparison */}
      <div 
        ref={chartRefs?.mosChart}
        className="bg-slate-900 rounded-lg p-4 border border-slate-700"
      >
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          MOS Score Comparison
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={80} 
              tick={{ fill: "#9CA3AF", fontSize: 11 }} 
            />
            <YAxis domain={[0, 5]} tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip 
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
                color: "#fff",
              }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="mos" fill="#fbbf24" name="MOS Score" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Throughput Comparison */}
      <div 
        ref={chartRefs?.throughputChart}
        className="bg-slate-900 rounded-lg p-4 border border-slate-700"
      >
        <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Throughput Comparison
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="name" 
              angle={-45} 
              textAnchor="end" 
              height={80} 
              tick={{ fill: "#9CA3AF", fontSize: 11 }} 
            />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip 
              contentStyle={{
                backgroundColor: "#1e293b",
                border: "1px solid #475569",
                borderRadius: "8px",
                color: "#fff",
              }}
              formatter={(value) => `${value.toFixed(2)} Mbps`} 
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="dl" fill="#06b6d4" name="Download (Mbps)" radius={[8, 8, 0, 0]} />
            <Bar dataKey="ul" fill="#fb923c" name="Upload (Mbps)" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};