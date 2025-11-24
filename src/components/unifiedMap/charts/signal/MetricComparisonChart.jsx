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
import { CHART_CONFIG } from "../../utils/constants";

export const MetricComparisonChart = React.forwardRef(({ locations }, ref) => {
  const chartData = useMemo(() => {
    if (!locations?.length) return [];

    return locations.map((loc, index) => {
      const normalizeRsrp = (val) =>
        val != null ? Math.max(0, Math.min(100, ((val + 140) / 40) * 100)) : null;
      const normalizeRsrq = (val) =>
        val != null ? Math.max(0, Math.min(100, ((val + 20) / 10) * 100)) : null;
      const normalizeSinr = (val) =>
        val != null ? Math.max(0, Math.min(100, ((val + 5) / 30) * 100)) : null;
      const normalizeMos = (val) =>
        val != null ? Math.max(0, Math.min(100, (val / 5) * 100)) : null;

      return {
        index: index + 1,
        timestamp: loc.timestamp,
        RSRP: normalizeRsrp(loc.rsrp),
        RSRQ: normalizeRsrq(loc.rsrq),
        SINR: normalizeSinr(loc.sinr),
        MOS: normalizeMos(loc.mos),
        rsrpActual: loc.rsrp?.toFixed(1) || "N/A",
        rsrqActual: loc.rsrq?.toFixed(1) || "N/A",
        sinrActual: loc.sinr?.toFixed(1) || "N/A",
        mosActual: loc.mos?.toFixed(2) || "N/A",
      };
    });
  }, [locations]);

  if (!chartData.length) {
    return (
      <ChartContainer ref={ref} title="Multi-Metric Comparison" icon={Activity}>
        <EmptyState message="No metrics available" />
      </ChartContainer>
    );
  }

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0].payload;

    return (
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
        <div className="text-xs text-slate-400 mb-2 font-semibold">
          Sample #{data.index}
        </div>
        <div className="space-y-1.5">
          {[
            { key: 'RSRP', color: 'blue-400', unit: 'dBm', actual: data.rsrpActual },
            { key: 'RSRQ', color: 'purple-400', unit: 'dB', actual: data.rsrqActual },
            { key: 'SINR', color: 'green-400', unit: 'dB', actual: data.sinrActual },
            { key: 'MOS', color: 'yellow-400', unit: '', actual: data.mosActual },
          ].map(({ key, color, unit, actual }) => (
            data[key] != null && (
              <div key={key} className="flex items-center justify-between gap-4 text-xs">
                <span className={`text-${color}`}>{key}:</span>
                <span className="text-white font-semibold">
                  {actual} {unit}
                </span>
              </div>
            )
          ))}
        </div>
      </div>
    );
  };

  return (
    <ChartContainer 
      ref={ref} 
      title={`Multi-Metric Comparison Timeline (${chartData.length} samples)`} 
      icon={Activity}
    >
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={CHART_CONFIG.margin}>
          <CartesianGrid {...CHART_CONFIG.grid} />
          <XAxis
            dataKey="index"
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            label={{
              value: "Sample Number",
              position: "insideBottom",
              offset: -10,
              fill: "#9CA3AF",
            }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#9CA3AF", fontSize: 11 }}
            label={{
              value: "Quality Score (%)",
              angle: -90,
              position: "insideLeft",
              fill: "#9CA3AF",
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: "12px" }} verticalAlign="top" height={36} />
          <Line type="monotone" dataKey="RSRP" stroke="#3b82f6" strokeWidth={2.5} dot={false} name="RSRP" connectNulls />
          <Line type="monotone" dataKey="RSRQ" stroke="#a855f7" strokeWidth={2.5} dot={false} name="RSRQ" connectNulls />
          <Line type="monotone" dataKey="SINR" stroke="#10b981" strokeWidth={2.5} dot={false} name="SINR" connectNulls />
          <Line type="monotone" dataKey="MOS" stroke="#fbbf24" strokeWidth={2.5} dot={false} name="MOS" connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
});

MetricComparisonChart.displayName = "MetricComparisonChart";