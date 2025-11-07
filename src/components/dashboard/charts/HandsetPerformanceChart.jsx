import React from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Scatter, XAxis, YAxis, Tooltip, ReferenceArea } from 'recharts';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE } from '@/components/constants/dashboardConstants';
import { useHandsetPerformance } from '@/hooks/useDashboardData';
import { getRSRPPointColor } from '@/utils/chartUtils';

const HandsetPerformanceChart = () => {
  const { data, isLoading } = useHandsetPerformance();

  // Custom lollipop stick renderer (vertical)
  const renderLollipopStick = (props) => {
    const { x, y, width, height, payload } = props;
    const stickX = x + width / 2;
    const stickY = y + height;
    const endY = y; 
    
    return (
      <line
        x1={stickX}
        y1={stickY}
        x2={stickX}
        y2={endY}
        stroke={getRSRPPointColor(payload.Avg)}
        strokeWidth={3}
        strokeOpacity={0.6}
        strokeLinecap="round"
      />
    );
  };

  // Custom lollipop dot (at top of stick)
  const renderLollipopDot = (props) => {
    const { cx, cy, payload } = props;
    const color = getRSRPPointColor(payload.Avg);
    
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

  // Custom tooltip to avoid duplicates
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    // Get unique value (since both Bar and Scatter have same dataKey)
    const item = payload[0]?.payload;
    const avgValue = item?.Avg;
    const samples = item?.Samples;
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
              {Number(avgValue).toFixed(1)} dBm
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
        <div className="mt-2 pt-2 border-t border-gray-200">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-medium text-gray-600">
              {avgValue >= -85 ? 'Excellent' : 
               avgValue >= -95 ? 'Good' : 
               avgValue >= -105 ? 'Fair' : 'Poor'}
            </span>
          </div>
        </div>
      </div>
    );
  };

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
          data={data?.slice(0, 10)}
          margin={{ top: 20, right: 20, left: 50, bottom: 60 }}
        >
          {/* Background reference areas - reversed scale */}
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
            domain={[-120, -60]}
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
          
          {/* Use custom tooltip */}
          <Tooltip content={<CustomTooltip />} />

          {/* Lollipop sticks - hide from tooltip */}
          <Bar
            dataKey="Avg"
            shape={renderLollipopStick}
            isAnimationActive
            animationDuration={650}
            hide={true} // Hide from tooltip/legend
          />

          {/* Lollipop dots/circles */}
          <Scatter
            dataKey="Avg"
            shape={renderLollipopDot}
            isAnimationActive
            animationDuration={800}
            animationBegin={400}
            name="Avg RSRP"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default HandsetPerformanceChart;