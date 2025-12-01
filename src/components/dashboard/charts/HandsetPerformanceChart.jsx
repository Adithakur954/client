// src/components/charts/HandsetPerformanceChart.jsx
import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Scatter, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ReferenceArea, 
  Cell 
} from 'recharts';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE } from '@/components/constants/dashboardConstants';
import { useHandsetPerformance } from '@/hooks/useDashboardData.js';
import { getRSRPPointColor } from '@/utils/chartUtils';

const HandsetPerformanceChart = () => {
  // ============================================
  // SWR HOOK - SINGLE SOURCE OF TRUTH
  // ============================================
  const { 
    data: rawData, 
    isLoading, 
    error,
    mutate 
  } = useHandsetPerformance();

  // Ensure data is always an array
  const data = useMemo(() => {
    if (!rawData || !Array.isArray(rawData)) return [];
    return rawData;
  }, [rawData]);

  // ============================================
  // LOCAL FILTER STATES
  // ============================================
  const [topN, setTopN] = useState(10);
  const [minSamples, setMinSamples] = useState(0);
  const [sortBy, setSortBy] = useState('avg');

  // ============================================
  // CONSTANTS
  // ============================================
  const CHART_Y_MIN = -120;
  const CHART_Y_MAX = -60;

  // ============================================
  // SIGNAL QUALITY HELPER
  // ============================================
  const getSignalQuality = (value) => {
    if (value >= -85) return 'Excellent';
    if (value >= -95) return 'Good';
    if (value >= -105) return 'Fair';
    return 'Poor';
  };

  // ============================================
  // CHART DATA PREPARATION
  // ============================================
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Apply filters
    let filtered = data.filter(item => item.Samples >= minSamples);
    
    // Sort
    if (sortBy === 'avg') {
      filtered.sort((a, b) => b.Avg - a.Avg);
    } else {
      filtered.sort((a, b) => b.Samples - a.Samples);
    }
    
    // Take top N and add baseline
    return filtered.slice(0, topN).map(item => ({
      ...item,
      BaselineValue: CHART_Y_MIN,
    }));
  }, [data, topN, minSamples, sortBy]);

  // ============================================
  // CUSTOM RENDERERS
  // ============================================
  const renderLollipopDot = (props) => {
    const { cx, cy, payload } = props;
    
    if (!payload || typeof cx !== 'number' || typeof cy !== 'number') {
      return null;
    }

    const avgValue = payload.Avg;
    if (avgValue === undefined || avgValue === null) {
      return null;
    }

    const color = getRSRPPointColor(avgValue);
    
    return (
      <g>
        <circle cx={cx} cy={cy} r={10} fill={color} fillOpacity={0.2} />
        <circle cx={cx} cy={cy} r={7} fill={color} stroke="#fff" strokeWidth={2} style={{ cursor: 'pointer' }} />
        <circle cx={cx} cy={cy} r={3} fill="#fff" fillOpacity={0.4} />
      </g>
    );
  };

  const renderLollipopStick = (props) => {
    const { x, y, width, height, payload } = props;
    
    if (!payload || !x || !y || !width || !height) {
      return null;
    }

    const avgValue = payload.Avg;
    if (avgValue === undefined || avgValue === null) {
      return null;
    }

    const color = getRSRPPointColor(avgValue);
    const stickX = x + width / 2;
    
    return (
      <line
        x1={stickX}
        y1={y}
        x2={stickX}
        y2={y + height}
        stroke={color}
        strokeWidth={3}
        strokeOpacity={0.6}
        strokeLinecap="round"
      />
    );
  };

  // ============================================
  // CUSTOM TOOLTIP
  // ============================================
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const item = payload[0]?.payload;
    if (!item) return null;

    const avgValue = item.Avg;
    const samples = item.Samples;
    const color = getRSRPPointColor(avgValue);

    return (
      <div style={TOOLTIP_STYLE}>
        <p className="font-semibold text-gray-900 mb-2 border-b pb-1">
          {label}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-600">Avg RSRP:</span>
            <span className="text-sm font-bold" style={{ color }}>
              {avgValue ? Number(avgValue).toFixed(1) : 'N/A'} dBm
            </span>
          </div>
          {samples && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-gray-600">Samples:</span>
              <span className="text-xs font-medium text-gray-700">
                {samples.toLocaleString()}
              </span>
            </div>
          )}
        </div>
        
        {avgValue && (
          <div className="mt-2 pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs font-medium text-gray-600">
                {getSignalQuality(avgValue)}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================
  // SETTINGS RENDER
  // ============================================
  const settingsRender = () => (
    <div className="space-y-4">
      {/* Top N Selector */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Show Top Handsets
        </label>
        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={15}>Top 15</option>
          <option value={20}>Top 20</option>
          <option value={25}>Top 25</option>
        </select>
      </div>

      {/* Min Samples Filter */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Minimum Samples
        </label>
        <input
          type="number"
          value={minSamples}
          onChange={(e) => setMinSamples(Number(e.target.value))}
          min="0"
          step="100"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="0"
        />
        <p className="text-xs text-gray-500">Only show handsets with at least this many samples</p>
      </div>

      {/* Sort By */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Sort By
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="avg">Best Signal Quality</option>
          <option value="samples">Most Samples</option>
        </select>
      </div>

      {/* Info */}
      <div className="pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Total Handsets:</span>
            <span className="font-semibold text-gray-900">{data.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Showing:</span>
            <span className="font-semibold text-gray-900">{chartData.length}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => {
            setTopN(10);
            setMinSamples(0);
            setSortBy('avg');
          }}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => mutate()}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );

  // ============================================
  // RENDER
  // ============================================
  return (
    <ChartCard
      title="Handset Performance (Avg RSRP)"
      dataset={data}
      exportFileName="handset_avg_rsrp"
      isLoading={isLoading}
      error={error}
      showChartFilters={false}
      settings={{
        title: 'Handset Performance Settings',
        render: settingsRender,
        onApply: () => console.log('✅ Settings applied')
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 50, bottom: 60 }}
        >
          {/* Background reference areas */}
          <ReferenceArea y1={-60} y2={-85} fill="#10B981" fillOpacity={0.08} />
          <ReferenceArea y1={-85} y2={-95} fill="#3B82F6" fillOpacity={0.08} />
          <ReferenceArea y1={-95} y2={-105} fill="#F59E0B" fillOpacity={0.08} />
          <ReferenceArea y1={-105} y2={-120} fill="#EF4444" fillOpacity={0.08} />

          <XAxis
            dataKey="Make"
            type="category"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: '#111827', fontSize: 11, fontWeight: 600 }}
            interval={0}
          />

          <YAxis
            type="number"
            domain={[CHART_Y_MIN, CHART_Y_MAX]}
            reversed={true}
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            tickFormatter={(v) => `${v} dBm`}
            label={{ 
              value: 'RSRP (dBm)', 
              angle: -90, 
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: '#6b7280', fontSize: 12, fontWeight: 500 }
            }}
          />
          
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />

          <Bar
            dataKey="Avg"
            fill="transparent"
            shape={renderLollipopStick}
            isAnimationActive={true}
            animationDuration={600}
            baseLine={CHART_Y_MIN}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} />
            ))}
          </Bar>

          <Scatter
            dataKey="Avg"
            fill="#8884d8"
            shape={renderLollipopDot}
            isAnimationActive={true}
            animationDuration={800}
            animationBegin={400}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default HandsetPerformanceChart;