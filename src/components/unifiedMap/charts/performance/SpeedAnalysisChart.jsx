import React, { useMemo } from "react";
import { Gauge } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "../../common/ChartContainer";
import { EmptyState } from "../../common/EmptyState";
import { CHART_CONFIG } from "@//utils/constants";

export const SpeedAnalysisChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations?.length) return [];

    return locations
      .filter((loc) => loc.speed != null && isFinite(loc.speed))
      .map((loc, idx) => ({
        index: idx + 1,
        speed: parseFloat(loc.speed) * 3.6, // Convert m/s to km/h
        timestamp: loc.timestamp,
        provider: loc.provider || "Unknown",
        band: loc.band || "Unknown",
      }))
      .sort((a, b) => {
        if (a.timestamp && b.timestamp) {
          return new Date(a.timestamp) - new Date(b.timestamp);
        }
        return 0;
      });
  }, [locations]);

  const stats = useMemo(() => {
    if (!data.length) return null;

    const speeds = data.map((d) => d.speed);
    return {
      avgSpeed: (speeds.reduce((a, b) => a + b, 0) / speeds.length).toFixed(1),
      maxSpeed: Math.max(...speeds).toFixed(1),
      minSpeed: Math.min(...speeds).toFixed(1),
    };
  }, [data]);

  const speedDistribution = useMemo(() => {
    if (!data.length) return [];

    const buckets = [
      { range: "0-20", min: 0, max: 20, count: 0, color: "#ef4444" },
      { range: "20-40", min: 20, max: 40, count: 0, color: "#f59e0b" },
      { range: "40-60", min: 40, max: 60, count: 0, color: "#eab308" },
      { range: "60-80", min: 60, max: 80, count: 0, color: "#22c55e" },
      { range: "80-100", min: 80, max: 100, count: 0, color: "#3b82f6" },
      { range: "100+", min: 100, max: Infinity, count: 0, color: "#8b5cf6" },
    ];

    data.forEach((d) => {
      const bucket = buckets.find((b) => d.speed >= b.min && d.speed < b.max);
      if (bucket) bucket.count++;
    });

    return buckets.filter((b) => b.count > 0);
  }, [data]);

  if (!data.length) {
    return (
      <ChartContainer ref={ref} title="Speed Analysis" icon={Gauge}>
        <EmptyState message="No speed data available" />
      </ChartContainer>
    );
  }

  return (
    <ChartContainer ref={ref} title={`Speed Analysis (${data.length} samples)`} icon={Gauge}>
      {/* Speed Statistics */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700 hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400 mb-1">Average Speed</div>
            <div className="text-xl font-bold text-blue-400">
              {stats.avgSpeed} <span className="text-xs text-slate-500">km/h</span>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700 hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400 mb-1">Max Speed</div>
            <div className="text-xl font-bold text-green-400">
              {stats.maxSpeed} <span className="text-xs text-slate-500">km/h</span>
            </div>
          </div>
          <div className="bg-slate-800 rounded-lg p-2 text-center border border-slate-700 hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400 mb-1">Min Speed</div>
            <div className="text-xl font-bold text-orange-400">
              {stats.minSpeed} <span className="text-xs text-slate-500">km/h</span>
            </div>
          </div>
        </div>
      )}

      

      {/* Speed Distribution */}
      <div>
        <div className="text-xs text-slate-400 mb-2 font-medium">Speed Distribution</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={speedDistribution} margin={{ ...CHART_CONFIG.margin, bottom: 20 }}>
            <CartesianGrid {...CHART_CONFIG.grid} />
            <XAxis
              dataKey="range"
              tick={{ fill: "#9CA3AF", fontSize: 11 }}
              label={{ value: "Speed Range (km/h)", position: "insideBottom", offset: -10, fill: "#9CA3AF" }}
            />
            <YAxis
              tick={{ fill: "#9CA3AF", fontSize: 11 }}
              label={{ value: "Count", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
            />
            <Tooltip className="text-sm text-white"
              contentStyle={CHART_CONFIG.tooltip}
              formatter={(value, name, props) => [
                `${value} samples (${((value / data.length) * 100).toFixed(1)}%)`,
                `${props.payload.range} km/h`,
              ]}
            />
            <Bar dataKey="count" className="text-white" radius={[8, 8, 0, 0]}>
              {speedDistribution.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartContainer>
  );
});

SpeedAnalysisChart.displayName = "SpeedAnalysisChart";