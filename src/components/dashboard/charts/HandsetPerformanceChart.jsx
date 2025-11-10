import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Scatter, XAxis, YAxis, Tooltip, ReferenceArea, Cell } from 'recharts';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE } from '@/components/constants/dashboardConstants';
import { useHandsetPerformance } from '@/hooks/useDashboardData';
import { getRSRPPointColor } from '@/utils/chartUtils';

const HandsetPerformanceChart = () => {
  const { data, isLoading } = useHandsetPerformance();

  // Debug: Log data to console
  React.useEffect(() => {
    console.log('Handset Performance Data:', data);
  }, [data]);

  // Constants
  const CHART_Y_MIN = -120;
  const CHART_Y_MAX = -60;
  const TOP_HANDSETS_COUNT = 10;

  // Get signal quality label
  const getSignalQuality = (value) => {
    if (value >= -85) return 'Excellent';
    if (value >= -95) return 'Good';
    if (value >= -105) return 'Fair';
    return 'Poor';
  };

  // Simplified lollipop dot renderer
  const renderLollipopDot = (props) => {
    const { cx, cy, payload } = props;
    
    if (!payload || typeof cx !== 'number' || typeof cy !== 'number') {
      return null;
    }

    const avgValue = payload.Avg || payload.avg || payload.value;
    if (avgValue === undefined || avgValue === null) {
      return null;
    }

    const color = getRSRPPointColor(avgValue);
    
    return (
      <g>
        {/* Outer glow */}
        <circle
          cx={cx}
          cy={cy}
          r={10}
          fill={color}
          fillOpacity={0.2}
        />
        
        {/* Main circle */}
        <circle
          cx={cx}
          cy={cy}
          r={7}
          fill={color}
          stroke="#fff"
          strokeWidth={2}
          style={{ cursor: 'pointer' }}
        />
        
        {/* Inner highlight */}
        <circle
          cx={cx}
          cy={cy}
          r={3}
          fill="#fff"
          fillOpacity={0.4}
        />
      </g>
    );
  };

  // Custom Bar shape for lollipop sticks
  const renderLollipopStick = (props) => {
    const { x, y, width, height, payload } = props;
    
    if (!payload || !x || !y || !width || !height) {
      return null;
    }

    const avgValue = payload.Avg || payload.avg || payload.value;
    if (avgValue === undefined || avgValue === null) {
      return null;
    }

    const color = getRSRPPointColor(avgValue);
    const stickX = x + width / 2;
    
    // For reversed Y-axis:
    // y is the top of the bar (more negative value, better signal)
    // y + height is the bottom (baseline)
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

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const item = payload[0]?.payload;
    if (!item) return null;

    const avgValue = item.Avg || item.avg || item.value;
    const samples = item.Samples || item.samples;
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
        
        {/* Signal quality indicator */}
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

  // Prepare chart data - handle different data structures
  const chartData = React.useMemo(() => {
    if (!data || !Array.isArray(data)) {
      console.warn('No valid data available');
      return [];
    }

    const processedData = data.slice(0, TOP_HANDSETS_COUNT).map(item => ({
      Make: item.Make || item.make || item.name || 'Unknown',
      Avg: item.Avg || item.avg || item.value || 0,
      Samples: item.Samples || item.samples || 0,
      BaselineValue: CHART_Y_MIN, // For bar chart baseline
    }));

    console.log('Processed Chart Data:', processedData);
    return processedData;
  }, [data]);

  // Show message if no data
  if (!isLoading && (!chartData || chartData.length === 0)) {
    return (
      <ChartCard
        title="Handset Performance (Avg RSRP)"
        dataset={data}
        exportFileName="handset_avg_rsrp"
        isLoading={isLoading}
        showChartFilters={false}
      >
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">No data available</p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Handset Performance (Avg RSRP)"
      dataset={data}
      exportFileName="handset_avg_rsrp"
      isLoading={isLoading}
      showChartFilters={false}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 20, right: 20, left: 50, bottom: 60 }}
        >
          {/* Background reference areas for signal quality zones */}
          <ReferenceArea y1={-60} y2={-85} fill="#10B981" fillOpacity={0.08} />
          <ReferenceArea y1={-85} y2={-95} fill="#3B82F6" fillOpacity={0.08} />
          <ReferenceArea y1={-95} y2={-105} fill="#F59E0B" fillOpacity={0.08} />
          <ReferenceArea y1={-105} y2={-120} fill="#EF4444" fillOpacity={0.08} />

          {/* X-Axis */}
          <XAxis
            dataKey="Make"
            type="category"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: '#111827', fontSize: 11, fontWeight: 600 }}
            interval={0}
          />

          {/* Y-Axis */}
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
              style: { 
                textAnchor: 'middle', 
                fill: '#6b7280', 
                fontSize: 12, 
                fontWeight: 500 
              }
            }}
          />
          
          {/* Tooltip */}
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
          />

          {/* Lollipop sticks - using Bar with baseline */}
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

          {/* Lollipop dots - using Scatter */}
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