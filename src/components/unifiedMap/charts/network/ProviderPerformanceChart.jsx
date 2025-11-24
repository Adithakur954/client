import React, { useMemo } from "react";
import { Globe } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { ChartContainer } from "../../common/ChartContainer";
import { EmptyState } from "../../common/EmptyState";
import { CHART_CONFIG } from "@/utils/constants";
import { filterValidData } from "@/utils/analyticsHelpers";

export const ProviderPerformanceChart = React.forwardRef(({ locations }, ref) => {
  const data = useMemo(() => {
    if (!locations?.length) return [];

    const providerStats = locations.reduce((acc, loc) => {
      const provider = loc.provider || "Unknown";
      if (!acc[provider]) {
        acc[provider] = {
          count: 0,
          avgRsrp: [],
          avgRsrq: [],
          avgSinr: [],
          avgMos: [],
          avgDl: [],
          avgUl: [],
          avgLatency: [],
          avgJitter: [],
        };
      }

      acc[provider].count++;
      if (loc.rsrp != null) acc[provider].avgRsrp.push(loc.rsrp);
      if (loc.rsrq != null) acc[provider].avgRsrq.push(loc.rsrq);
      if (loc.sinr != null) acc[provider].avgSinr.push(loc.sinr);
      if (loc.mos != null) acc[provider].avgMos.push(loc.mos);
      if (loc.dl_thpt != null) acc[provider].avgDl.push(parseFloat(loc.dl_thpt));
      if (loc.ul_thpt != null) acc[provider].avgUl.push(parseFloat(loc.ul_thpt));
      if (loc.latency != null) acc[provider].avgLatency.push(loc.latency);
      if (loc.jitter != null) acc[provider].avgJitter.push(loc.jitter);

      return acc;
    }, {});

    return Object.entries(providerStats)
      .map(([provider, data]) => ({
        provider,
        samples: data.count,
        MOS:
          data.avgMos.length > 0
            ? parseFloat((data.avgMos.reduce((a, b) => a + b, 0) / data.avgMos.length).toFixed(2))
            : null,
        "Download (Mbps)":
          data.avgDl.length > 0
            ? parseFloat((data.avgDl.reduce((a, b) => a + b, 0) / data.avgDl.length).toFixed(1))
            : null,
        "Upload (Mbps)":
          data.avgUl.length > 0
            ? parseFloat((data.avgUl.reduce((a, b) => a + b, 0) / data.avgUl.length).toFixed(1))
            : null,
        avgRsrp:
          data.avgRsrp.length > 0
            ? parseFloat((data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1))
            : null,
        avgRsrq:
          data.avgRsrq.length > 0
            ? parseFloat((data.avgRsrq.reduce((a, b) => a + b, 0) / data.avgRsrq.length).toFixed(1))
            : null,
        avgSinr:
          data.avgSinr.length > 0
            ? parseFloat((data.avgSinr.reduce((a, b) => a + b, 0) / data.avgSinr.length).toFixed(1))
            : null,
        avgLatency:
          data.avgLatency.length > 0
            ? parseFloat((data.avgLatency.reduce((a, b) => a + b, 0) / data.avgLatency.length).toFixed(1))
            : null,
        avgJitter:
          data.avgJitter.length > 0
            ? parseFloat((data.avgJitter.reduce((a, b) => a + b, 0) / data.avgJitter.length).toFixed(1))
            : null,
      }))
      .sort((a, b) => b.samples - a.samples);
  }, [locations]);

  const validData = filterValidData(data, 'provider');

  // Radar chart data (normalize metrics)
  const radarData = useMemo(() => {
    if (!validData.length) return [];

    return validData.slice(0, 3).map((item) => ({
      provider: item.provider,
      "Signal Quality": item.avgRsrp != null ? Math.min(100, ((item.avgRsrp + 140) / 40) * 100) : 0,
      "Throughput": item["Download (Mbps)"] != null ? Math.min(100, (item["Download (Mbps)"] / 100) * 100) : 0,
      "MOS": item.MOS != null ? (item.MOS / 5) * 100 : 0,
      "Latency": item.avgLatency != null ? Math.max(0, 100 - (item.avgLatency / 150) * 100) : 0,
    }));
  }, [validData]);

  if (!validData.length) {
    return (
      <ChartContainer ref={ref} title="Provider Performance Comparison" icon={Globe}>
        <EmptyState message="No provider data available" />
      </ChartContainer>
    );
  }

  return (
    <ChartContainer ref={ref} title="Provider Performance Comparison" icon={Globe}>
      {/* Main Performance Bar Chart */}
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={validData} margin={{ ...CHART_CONFIG.margin, bottom: 40 }}>
            <CartesianGrid {...CHART_CONFIG.grid} />
            <XAxis
              dataKey="provider"
              angle={-45}
              textAnchor="end"
              height={60}
              tick={{ fill: "#9CA3AF", fontSize: 11 }}
            />
            <YAxis tick={{ fill: "#9CA3AF", fontSize: 12 }} />
            <Tooltip
              contentStyle={CHART_CONFIG.tooltip}
              labelStyle={{ color: "#f1f5f9" }}
            />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
            <Bar dataKey="MOS" fill="#facc15" radius={[8, 8, 0, 0]} name="MOS Score" />
            <Bar dataKey="Download (Mbps)" fill="#06b6d4" radius={[8, 8, 0, 0]} name="Download" />
            <Bar dataKey="Upload (Mbps)" fill="#fb923c" radius={[8, 8, 0, 0]} name="Upload" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Radar Chart - Top 3 Providers */}
      {radarData.length > 0 && (
        <div className="mb-4">
          <div className="text-xs text-slate-400 mb-2 font-medium">
            Top 3 Providers - Overall Performance
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#475569" />
              <PolarAngleAxis
                dataKey="provider"
                tick={{ fill: "#9CA3AF", fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: "#9CA3AF", fontSize: 10 }}
              />
              <Tooltip
                contentStyle={CHART_CONFIG.tooltip}
                formatter={(value) => `${value.toFixed(1)}%`}
              />
              <Radar
                name={radarData[0]?.provider}
                dataKey="Signal Quality"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.3}
              />
              <Radar
                name={radarData[1]?.provider}
                dataKey="Throughput"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.3}
              />
              <Radar
                name={radarData[2]?.provider}
                dataKey="MOS"
                stroke="#facc15"
                fill="#facc15"
                fillOpacity={0.3}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sample Count Footer */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-400 justify-center bg-slate-800 p-3 rounded-lg">
        {validData.map((p, idx) => (
          <div key={idx} className="bg-slate-900 px-2 py-1 rounded hover:bg-slate-850 transition-colors">
            <span className="text-white font-semibold">{p.provider}:</span>{" "}
            <span className="text-slate-300">{p.samples} samples</span>
          </div>
        ))}
      </div>

      {/* Detailed Metrics Grid */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        {validData.slice(0, 4).map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-800 rounded-lg p-3 border border-slate-700 hover:border-slate-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-700">
              <span className="font-semibold text-white">{item.provider}</span>
              <span className="text-xs text-slate-400">{item.samples} samples</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="text-slate-400">MOS</div>
                <div className="text-yellow-400 font-semibold">
                  {item.MOS != null ? item.MOS.toFixed(2) : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-slate-400">RSRP</div>
                <div
                  className={`font-semibold ${
                    item.avgRsrp >= -90
                      ? "text-green-400"
                      : item.avgRsrp >= -105
                      ? "text-yellow-400"
                      : "text-red-400"
                  }`}
                >
                  {item.avgRsrp != null ? item.avgRsrp : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Download</div>
                <div className="text-cyan-400 font-semibold">
                  {item["Download (Mbps)"] != null ? `${item["Download (Mbps)"]} Mbps` : "N/A"}
                </div>
              </div>
              <div>
                <div className="text-slate-400">Upload</div>
                <div className="text-orange-400 font-semibold">
                  {item["Upload (Mbps)"] != null ? `${item["Upload (Mbps)"]} Mbps` : "N/A"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ChartContainer>
  );
});

ProviderPerformanceChart.displayName = "ProviderPerformanceChart";