import { adminApi } from "@/api/apiEndpoints";
import React, { useEffect, useState } from "react";
import {
  Bar,
  Legend,
  XAxis,
  Line,
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
        onApply: () => console.log("Selected metrics:", selectedMetrics),
      }}
    >
      {chartData.length > 0 ? (
        <div style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 20, right: 50, left: 30, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />

              {/* X Axis */}
              <XAxis
                dataKey="appName"
                angle={-45}
                interval={0}
                textAnchor="end"
                height={70}
                tick={{ fill: "#111827", fontSize: 11, fontWeight: 600 }}
              />

              {/* LEFT Y AXIS — Main Metrics */}
              <YAxis
                yAxisId="left"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                label={{
                  value: "Performance Metrics",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#6b7280", fontSize: 12 },
                }}
              />

              {/* RIGHT Y AXIS — Sample Count */}
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#EF4444", fontSize: 11 }}
                label={{
                  value: "Samples",
                  angle: 90,
                  position: "insideRight",
                  style: { fill: "#EF4444", fontSize: 12 },
                }}
              />

              {/* Tooltip + Legend */}
              <Tooltip />
              <Legend />

              {/* ZIG-ZAG LINE FOR SAMPLE COUNT */}
              <defs>
                <pattern
                  id="zigzagStroke"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M0 3 L3 0 L6 3 L3 6 Z"
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth="1.5"
                  />
                </pattern>
              </defs>

             

              {/* METRIC BARS */}
              {selectedMetrics
                .filter((m) => m !== "sampleCount")
                .map((metric, idx) => (
                  <Bar
                    key={metric}
                    yAxisId="left"
                    dataKey={metric}
                    name={
                      {
                        avgDlTptMbps: "Download Mbps",
                        avgUlTptMbps: "Upload Mbps",
                        avgMos: "MOS",
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
                    barSize={20}
                    radius={[4, 4, 0, 0]}
                  />
                ))}

              {/* SAMPLE COUNT LINE (ZIGZAG) */}
              {selectedMetrics.includes("sampleCount") && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sampleCount"
                  name="Sample Count"
                  stroke="url(#zigzagStroke)"
                  strokeWidth={3}
                  dot={{ r: 3, fill: "#EF4444" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </ChartCard>
  );
}

export default AppChart;
