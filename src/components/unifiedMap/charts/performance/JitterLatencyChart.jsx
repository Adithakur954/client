import React, { useMemo } from "react";
import { Activity } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "../../common/ChartContainer";
import { EmptyState } from "../../common/EmptyState";
import { CHART_CONFIG } from "@/utils/constants";

export const JitterLatencyChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations?.length) return [];

    return locations
      .filter((loc) => loc.jitter != null || loc.latency != null)
      .map((loc, idx) => ({
        index: idx + 1,
        jitter: parseFloat(loc.jitter) || 0,
        latency: parseFloat(loc.latency) || 0,
      }));
  }, [locations]);

  const stats = useMemo(() => {
    if (!data.length) return null;

    return {
      avgJitter: (data.reduce((sum, d) => sum + d.jitter, 0) / data.length).toFixed(2),
      avgLatency: (data.reduce((sum, d) => sum + d.latency, 0) / data.length).toFixed(2),
    };
  }, [data]);

  if (!data.length) {
    return (
      <ChartContainer ref={ref} title="Network Latency & Jitter" icon={Activity}>
        <EmptyState message="No jitter/latency data available" />
      </ChartContainer>
    );
  }

  return (
    <ChartContainer ref={ref} title="Network Latency & Jitter" icon={Activity}>
      {stats && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-slate-800 rounded p-2 text-center hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400">Avg Latency</div>
            <div className="text-xl font-bold text-pink-400">{stats.avgLatency} ms</div>
          </div>
          <div className="bg-slate-800 rounded p-2 text-center hover:bg-slate-750 transition-colors">
            <div className="text-xs text-slate-400">Avg Jitter</div>
            <div className="text-xl font-bold text-indigo-400">{stats.avgJitter} ms</div>
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data} margin={CHART_CONFIG.margin}>
          <CartesianGrid {...CHART_CONFIG.grid} />
          <XAxis dataKey="index" tick={{ fill: "#9CA3AF", fontSize: 11 }} />
          <YAxis
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            label={{ value: "ms", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
          />
          <Tooltip contentStyle={CHART_CONFIG.tooltip} formatter={(value) => `${value.toFixed(2)} ms`} />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Line type="monotone" dataKey="latency" stroke="#ec4899" strokeWidth={2} dot={false} name="Latency" />
          <Line type="monotone" dataKey="jitter" stroke="#6366f1" strokeWidth={2} dot={false} name="Jitter" />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

JitterLatencyChart.displayName = "JitterLatencyChart";