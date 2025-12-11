import React, { useMemo } from "react";
import { Activity } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartContainer } from "../../common/ChartContainer";
import { EmptyState } from "../../common/EmptyState";
import { CHART_CONFIG } from "@/utils/constants";

// Define ranges for latency (in ms)
const LATENCY_RANGES = [
  { min: 0, max: 20, label: "0-20", color: "#22c55e", quality: "Excellent" },
  { min: 20, max: 50, label: "20-50", color: "#84cc16", quality: "Good" },
  { min: 50, max: 100, label: "50-100", color: "#facc15", quality: "Fair" },
  { min: 100, max: 150, label: "100-150", color: "#fb923c", quality: "Poor" },
  { min: 150, max: Infinity, label: "150+", color: "#ef4444", quality: "Bad" },
];

// Define ranges for jitter (in ms)
const JITTER_RANGES = [
  { min: 0, max: 5, label: "0-5", color: "#22c55e", quality: "Excellent" },
  { min: 5, max: 10, label: "5-10", color: "#84cc16", quality: "Good" },
  { min: 10, max: 20, label: "10-20", color: "#facc15", quality: "Fair" },
  { min: 20, max: 30, label: "20-30", color: "#fb923c", quality: "Poor" },
  { min: 30, max: Infinity, label: "30+", color: "#ef4444", quality: "Bad" },
];

// Define ranges for packet loss (in %)
const PACKET_LOSS_RANGES = [
  { min: 0, max: 1, label: "0-1", color: "#22c55e", quality: "Excellent" },
  { min: 1, max: 3, label: "1-3", color: "#84cc16", quality: "Good" },
  { min: 3, max: 5, label: "3-5", color: "#facc15", quality: "Fair" },
  { min: 5, max: 10, label: "5-10", color: "#fb923c", quality: "Poor" },
  { min: 10, max: Infinity, label: "10+", color: "#ef4444", quality: "Bad" },
];

// Distribution Chart Tooltip
const DistributionTooltip = ({ active, payload, label, unit = "ms" }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
      <div className="font-semibold text-white mb-2 border-b border-slate-700 pb-2">
        {label} {unit}
      </div>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-slate-300 text-sm">{entry.name}</span>
            </div>
            <span className="font-semibold text-white text-sm">
              {entry.value} samples
              <span className="text-slate-400 text-xs ml-1">
                ({entry.payload?.percentage}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Single Distribution Bar Chart
const DistributionBarChart = ({ data, ranges, title, totalSamples, unit = "ms" }) => {
  const distributionData = useMemo(() => {
    return ranges.map((range) => {
      const count = data.filter(
        (d) => d >= range.min && d < range.max
      ).length;
      const percentage = totalSamples > 0 
        ? ((count / totalSamples) * 100).toFixed(1) 
        : 0;
      return {
        range: range.label,
        count,
        percentage,
        color: range.color,
        quality: range.quality,
      };
    });
  }, [data, ranges, totalSamples]);

  return (
    <div className="w-full">
      <div className="text-sm font-medium text-slate-300 mb-3 text-center">
        {title}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={distributionData} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
          <CartesianGrid {...CHART_CONFIG.grid} />
          <XAxis
            dataKey="range"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            label={{ value: unit, position: "bottom", fill: "#9CA3AF", fontSize: 11, offset: -5 }}
          />
          <YAxis
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            label={{ value: "Samples", angle: -90, position: "insideLeft", fill: "#9CA3AF", fontSize: 11 }}
          />
          <Tooltip content={(props) => <DistributionTooltip {...props} unit={unit} />} />
          <Bar dataKey="count" name={title} radius={[4, 4, 0, 0]}>
            {distributionData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      
      {/* Legend with quality labels */}
      <div className="mt-3 space-y-1.5">
        {distributionData.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between px-3 py-2 rounded-lg transition-colors hover:bg-slate-700/30"
            style={{ 
              backgroundColor: `${item.color}15`,
              borderLeft: `3px solid ${item.color}`
            }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full shadow-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium" style={{ color: item.color }}>
                {item.range} {unit}
              </span>
              <span className="text-xs text-slate-500">({item.quality})</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-white">
                {item.count} samples
              </span>
              <span className="text-xs text-slate-400 min-w-[45px] text-right">
                {item.percentage}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Quality Summary Bar
const QualitySummary = ({ data, ranges, title, totalSamples }) => {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-2">{title}</div>
      <div className="space-y-1.5">
        {ranges.map((range, idx) => {
          const count = data.filter(
            (d) => d >= range.min && d < range.max
          ).length;
          const percentage = totalSamples > 0 
            ? ((count / totalSamples) * 100).toFixed(1) 
            : 0;
          const barWidth = totalSamples > 0 ? (count / totalSamples) * 100 : 0;
          
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-16 text-xs text-slate-400">{range.quality}</div>
              <div className="flex-1 h-4 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: range.color,
                  }}
                />
              </div>
              <div className="w-16 text-xs text-right" style={{ color: range.color }}>
                {percentage}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const JitterLatencyChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations?.length) return [];

    return locations
      .filter((loc) => loc.jitter != null || loc.latency != null || loc.packet_loss != null)
      .map((loc) => ({
        jitter: parseFloat(loc.jitter) || 0,
        latency: parseFloat(loc.latency) || 0,
        packetLoss: parseFloat(loc.packet_loss) || 0,
      }));
  }, [locations]);

  const stats = useMemo(() => {
    if (!data.length) return null;

    const latencyValues = data.map((d) => d.latency);
    const jitterValues = data.map((d) => d.jitter);
    const packetLossValues = data.map((d) => d.packetLoss);

    return {
      avgJitter: (data.reduce((sum, d) => sum + d.jitter, 0) / data.length).toFixed(2),
      avgLatency: (data.reduce((sum, d) => sum + d.latency, 0) / data.length).toFixed(2),
      avgPacketLoss: (data.reduce((sum, d) => sum + d.packetLoss, 0) / data.length).toFixed(2),
      minLatency: Math.min(...latencyValues).toFixed(2),
      maxLatency: Math.max(...latencyValues).toFixed(2),
      minJitter: Math.min(...jitterValues).toFixed(2),
      maxJitter: Math.max(...jitterValues).toFixed(2),
      minPacketLoss: Math.min(...packetLossValues).toFixed(2),
      maxPacketLoss: Math.max(...packetLossValues).toFixed(2),
      latencyValues,
      jitterValues,
      packetLossValues,
    };
  }, [data]);

  if (!data.length) {
    return (
      <ChartContainer ref={ref} title="Network Quality Metrics" icon={Activity}>
        <EmptyState message="No network quality data available" />
      </ChartContainer>
    );
  }

  return (
    <ChartContainer ref={ref} title="Network Quality Metrics Distribution" icon={Activity}>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400">Avg Latency</div>
            <div className="text-xl font-bold text-pink-400">{stats.avgLatency} ms</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {stats.minLatency} - {stats.maxLatency} ms
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400">Avg Jitter</div>
            <div className="text-xl font-bold text-indigo-400">{stats.avgJitter} ms</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {stats.minJitter} - {stats.maxJitter} ms
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400">Avg Packet Loss</div>
            <div className="text-xl font-bold text-orange-400">{stats.avgPacketLoss}%</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {stats.minPacketLoss} - {stats.maxPacketLoss}%
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400">Quality Score</div>
            <div className={`text-xl font-bold ${
              stats.avgLatency < 50 && stats.avgJitter < 10 && stats.avgPacketLoss < 1
                ? "text-green-400" 
                : stats.avgLatency < 100 && stats.avgJitter < 20 && stats.avgPacketLoss < 3
                ? "text-yellow-400" 
                : "text-red-400"
            }`}>
              {stats.avgLatency < 50 && stats.avgJitter < 10 && stats.avgPacketLoss < 1
                ? "Excellent" 
                : stats.avgLatency < 100 && stats.avgJitter < 20 && stats.avgPacketLoss < 3
                ? "Good" 
                : "Poor"}
            </div>
          </div>
        </div>
      )}

      {/* Distribution Charts */}
      <div className="flex flex-col gap-4 mb-4">
        <div className="bg-slate-800/50 rounded-lg p-4">
          <DistributionBarChart
            data={stats?.latencyValues || []}
            ranges={LATENCY_RANGES}
            title="Latency Distribution"
            totalSamples={data.length}
            unit="ms"
          />
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <DistributionBarChart
            data={stats?.jitterValues || []}
            ranges={JITTER_RANGES}
            title="Jitter Distribution"
            totalSamples={data.length}
            unit="ms"
          />
        </div>
        <div className="bg-slate-800/50 rounded-lg p-4">
          <DistributionBarChart
            data={stats?.packetLossValues || []}
            ranges={PACKET_LOSS_RANGES}
            title="Packet Loss Distribution"
            totalSamples={data.length}
            unit="%"
          />
        </div>
      </div>

      {/* Quality Summary Blocks */}
      <div className="bg-slate-800 rounded-lg p-4">
        <div className="text-sm font-medium text-slate-300 mb-3">Quality Summary</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QualitySummary
            data={stats?.latencyValues || []}
            ranges={LATENCY_RANGES}
            title="Latency Quality"
            totalSamples={data.length}
          />
          <QualitySummary
            data={stats?.jitterValues || []}
            ranges={JITTER_RANGES}
            title="Jitter Quality"
            totalSamples={data.length}
          />
          <QualitySummary
            data={stats?.packetLossValues || []}
            ranges={PACKET_LOSS_RANGES}
            title="Packet Loss Quality"
            totalSamples={data.length}
          />
        </div>
      </div>
    </ChartContainer>
  );
});

JitterLatencyChart.displayName = "JitterLatencyChart";