import { adminApi } from "@/api/apiEndpoints";
import React, { useEffect, useState } from "react";
import {
  Bar,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
} from "recharts";
import ChartCard from "../ChartCard";

function AppChart() {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Add this missing state for metrics
  const [selectedMetrics, setSelectedMetrics] = useState([
    "avgDlTptMbps",
    "avgUlTptMbps",
  ]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await adminApi.getAppValue();
        console.log("API response:", resp);

        const formattedData = (resp?.Data || []).map((item) => ({
          appName: item.appName,
          avgDlTptMbps: parseFloat(item.avgDlTptMbps) || 0,
          avgUlTptMbps: parseFloat(item.avgUlTptMbps) || 0,
          avgMos: parseFloat(item.avgMos) || 0,
          sampleCount: parseInt(item.sampleCount) || 0,
          avgRsrp: parseFloat(item.avgRsrp) || 0,
          avgRsrq: parseFloat(item.avgRsrq) || 0,
          avgSinr: parseFloat(item.avgSinr) || 0,
        }));

        console.log("Formatted data:", formattedData);
        setChartData(formattedData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <ChartCard
      title="App wise distribution"
      dataset={chartData}
      isLoading={loading}
      showChartFilters={false}
      settings={{
        title: "Select Metrics to Display",
        render: () => (
          <div className="space-y-3">
            {[
              { key: "avgDlTptMbps", label: "Download Mbps" },
              { key: "avgUlTptMbps", label: "Upload Mbps" },
              { key: "avgMos", label: "MOS (Mean Opinion Score)" },
              { key: "sampleCount", label: "Sample Count" },
              { key: "avgRsrp", label: "RSRP" },
              { key: "avgRsrq", label: "RSRQ" },
              { key: "avgSinr", label: "SINR" },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedMetrics.includes(key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedMetrics((prev) => [...prev, key]);
                    } else {
                      setSelectedMetrics((prev) =>
                        prev.filter((m) => m !== key)
                      );
                    }
                  }}
                  className="accent-blue-600"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        ),
        onApply: () =>
          console.log("Selected metrics:", selectedMetrics),
      }}
    >
      {chartData.length > 0 ? (
        <div style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 30, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="appName"
                angle={-45}
                textAnchor="end"
                interval={0}
                height={80}
                tick={{
                  fill: "#111827",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              />
              <YAxis
                label={{
                  value: "Throughput (Mbps)",
                  angle: -90,
                  position: "insideLeft",
                  offset: 10,
                  style: {
                    textAnchor: "middle",
                    fill: "#6b7280",
                    fontSize: 12,
                  },
                }}
                tick={{ fill: "#6b7280", fontSize: 11 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "white",
                  border: "1px solid #ddd",
                  borderRadius: "8px",
                  padding: "10px",
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                wrapperStyle={{ paddingBottom: "10px" }}
              />

              {selectedMetrics.map((metric, idx) => (
                <Bar
                  key={metric}
                  dataKey={metric}
                  name={
                    {
                      avgDlTptMbps: "Download Mbps",
                      avgUlTptMbps: "Upload Mbps",
                      avgMos: "MOS",
                      sampleCount: "Samples",
                      avgRsrp: "RSRP",
                      avgRsrq: "RSRQ",
                      avgSinr: "SINR",
                    }[metric]
                  }
                  fill={
                    [
                      "#3B82F6",
                      "#10B981",
                      "#F59E0B",
                      "#8B5CF6",
                      "#EF4444",
                      "#6366F1",
                      "#14B8A6",
                    ][idx % 7]
                  }
                  radius={[4, 4, 0, 0]}
                  barSize={20}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </ChartCard>
  );
}

export default AppChart;
