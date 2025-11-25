// src/components/charts/AppChart.jsx
import React, { useState, useMemo } from "react";
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
import { useAppData } from "@/hooks/useDashboardData";

const METRIC_CONFIG = [
  { key: "avgDlTptMbps", label: "Download Mbps", color: "#3B82F6" },
  { key: "avgUlTptMbps", label: "Upload Mbps", color: "#10B981" },
  { key: "avgMos", label: "MOS", color: "#F59E0B" },
  { key: "sampleCount", label: "Sample Count", color: "#EF4444", isLine: true },
  { key: "avgRsrp", label: "RSRP", color: "#8B5CF6" },
  { key: "avgRsrq", label: "RSRQ", color: "#6366F1" },
  { key: "avgSinr", label: "SINR", color: "#14B8A6" },
  { key: "avgDuration", label: "Duration (Hours)", color: "#EC4899" },
];

function AppChart() {
  // ============================================
  // SWR HOOK - SINGLE SOURCE OF TRUTH
  // ============================================
  const { 
    data: chartData, 
    isLoading, 
    error,
    mutate,
    isValidating
  } = useAppData();

  // ✅ Debug logging
  console.log('🔍 [AppChart] Hook Result:', {
    chartData,
    isLoading,
    error,
    isValidating,
    dataType: typeof chartData,
    isArray: Array.isArray(chartData),
    length: chartData?.length
  });

  // Ensure data is always an array
  const data = useMemo(() => {
    if (!chartData) {
      console.warn('⚠️ [AppChart] chartData is null/undefined');
      return [];
    }
    if (!Array.isArray(chartData)) {
      console.warn('⚠️ [AppChart] chartData is not an array:', typeof chartData);
      return [];
    }
    return chartData;
  }, [chartData]);

  // ============================================
  // LOCAL FILTER STATES
  // ============================================
  const [selectedMetrics, setSelectedMetrics] = useState([
    "avgDlTptMbps",
    "avgUlTptMbps",
  ]);
  const [topN, setTopN] = useState(15);
  const [sortBy, setSortBy] = useState('sampleCount');

  // ============================================
  // FILTERED & SORTED DATA
  // ============================================
  const displayData = useMemo(() => {
    if (!data || data.length === 0) {
      console.warn('⚠️ [AppChart] No data to display');
      return [];
    }
    
    const sorted = [...data].sort((a, b) => {
      if (sortBy === 'sampleCount') return (b.sampleCount || 0) - (a.sampleCount || 0);
      if (sortBy === 'avgDlTptMbps') return (b.avgDlTptMbps || 0) - (a.avgDlTptMbps || 0);
      if (sortBy === 'appName') return (a.appName || '').localeCompare(b.appName || '');
      return 0;
    });
    
    const result = sorted.slice(0, topN);
    console.log('✅ [AppChart] Display Data:', result);
    return result;
  }, [data, topN, sortBy]);

  // ============================================
  // SETTINGS RENDER
  // ============================================
  const settingsRender = () => (
    <div className="space-y-4">
      {/* Metric Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Select Metrics to Display
        </label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {METRIC_CONFIG.map(({ key, label, color }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedMetrics.includes(key)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedMetrics((prev) => [...prev, key]);
                  } else {
                    setSelectedMetrics((prev) => prev.filter((m) => m !== key));
                  }
                }}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Top N */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Show Top Apps
        </label>
        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value={10}>Top 10</option>
          <option value={15}>Top 15</option>
          <option value={20}>Top 20</option>
          <option value={25}>Top 25</option>
        </select>
      </div>

      {/* Sort By */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Sort By
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
        >
          <option value="sampleCount">Most Samples</option>
          <option value="avgDlTptMbps">Highest Download Speed</option>
          <option value="appName">App Name (A-Z)</option>
        </select>
      </div>

      {/* Info */}
      <div className="pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Total Apps:</span>
            <span className="font-semibold text-gray-900">{data.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Showing:</span>
            <span className="font-semibold text-gray-900">{displayData.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Metrics Selected:</span>
            <span className="font-semibold text-gray-900">{selectedMetrics.length}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setSelectedMetrics(["avgDlTptMbps", "avgUlTptMbps"]);
            setTopN(15);
            setSortBy('sampleCount');
          }}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => mutate()}
          disabled={isValidating}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isValidating ? 'Loading...' : 'Refresh'}
        </button>
      </div>
    </div>
  );

  // ============================================
  // GET ACTIVE METRICS CONFIG
  // ============================================
  const activeMetrics = useMemo(() => {
    return METRIC_CONFIG.filter(m => selectedMetrics.includes(m.key));
  }, [selectedMetrics]);

  // ============================================
  // RENDER
  // ============================================
  return (
    <ChartCard
      title="App Wise Distribution"
      dataset={data}
      exportFileName="app_distribution"
      isLoading={isLoading}
      error={error}
      showChartFilters={false}
      settings={{
        title: "App Chart Settings",
        render: settingsRender,
        onApply: () => console.log("Selected metrics:", selectedMetrics),
      }}
    >
      {displayData.length > 0 ? (
        <div style={{ width: "100%", height: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={displayData}
              margin={{ top: 20, right: 50, left: 30, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="appName"
                angle={-45}
                interval={0}
                textAnchor="end"
                height={70}
                tick={{ fill: "#111827", fontSize: 11, fontWeight: 600 }}
              />

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

              <Tooltip />
              <Legend />

              {/* Render Bars */}
              {activeMetrics
                .filter((m) => !m.isLine)
                .map((metric) => (
                  <Bar
                    key={metric.key}
                    yAxisId="left"
                    dataKey={metric.key}
                    name={metric.label}
                    fill={metric.color}
                    barSize={20}
                    radius={[4, 4, 0, 0]}
                  />
                ))}

              {/* Render Line for Sample Count */}
              {selectedMetrics.includes("sampleCount") && (
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="sampleCount"
                  name="Sample Count"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ r: 4, fill: "#EF4444" }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          {isLoading ? 'Loading...' : 'No data available'}
        </div>
      )}
    </ChartCard>
  );
}

export default AppChart;