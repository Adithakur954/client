import React, { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import {
  AreaChart,
  Area,
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

export const ThroughputTimelineChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations?.length) return [];

    return locations
      .filter((loc) => loc.timestamp && (loc.dl_thpt != null || loc.ul_thpt != null))
      .map((loc, idx) => ({
        index: idx + 1,
        timestamp: loc.timestamp,
        dl: parseFloat(loc.dl_thpt) || 0,
        ul: parseFloat(loc.ul_thpt) || 0,
      }))
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [locations]);

  if (!data.length) {
    return (
      <ChartContainer ref={ref} title="Throughput Timeline" icon={TrendingUp}>
        <EmptyState message="No throughput data available" />
      </ChartContainer>
    );
  }

  return (
    <ChartContainer ref={ref} title="Throughput Timeline" icon={TrendingUp}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={CHART_CONFIG.margin}>
          <CartesianGrid {...CHART_CONFIG.grid} />
          <XAxis
            dataKey="index"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            label={{ value: "Sample Number", position: "insideBottom", offset: -5, fill: "#9CA3AF" }}
          />
          <YAxis
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            label={{ value: "Throughput (Mbps)", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
          />
          <Tooltip
            contentStyle={CHART_CONFIG.tooltip}
            formatter={(value) => `${value.toFixed(2)} Mbps`}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          <Area
            type="monotone"
            dataKey="dl"
            stackId="1"
            stroke="#06b6d4"
            fill="#06b6d4"
            fillOpacity={0.6}
            name="Download"
          />
          <Area
            type="monotone"
            dataKey="ul"
            stackId="1"
            stroke="#f97316"
            fill="#f97316"
            fillOpacity={0.6}
            name="Upload"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

ThroughputTimelineChart.displayName = "ThroughputTimelineChart";