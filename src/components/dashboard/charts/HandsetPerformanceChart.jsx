import React from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ReferenceArea } from 'recharts';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE } from '@/components/constants/dashboardConstants';
import { useHandsetPerformance } from '@/hooks/useDashboardData';
import { getRSRPPointColor } from '@/utils/chartUtils';

const HandsetPerformanceChart = () => {
  const { data, isLoading } = useHandsetPerformance();

  return (
    <ChartCard
      title="Handset Performance (Avg RSRP)"
      dataset={data}
      exportFileName="handset_avg_rsrp"
      isLoading={isLoading}
      showChartFilters={false}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data?.slice(0, 10)}
          layout="vertical"
          margin={{ top: 12, right: 50, left: 10, bottom: 8 }}
          barCategoryGap="25%"
          barSize={16}
        >
          <ReferenceArea x1={-120} x2={-105} fill="#EF4444" fillOpacity={0.08} />
          <ReferenceArea x1={-105} x2={-95} fill="#F59E0B" fillOpacity={0.08} />
          <ReferenceArea x1={-95} x2={-85} fill="#3B82F6" fillOpacity={0.08} />
          <ReferenceArea x1={-85} x2={-60} fill="#10B981" fillOpacity={0.08} />

          <XAxis
            type="number"
            domain={[-120, -60]}
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            tickFormatter={(v) => `${v} dBm`}
          />
          <YAxis
            dataKey="Make"
            type="category"
            width={180}
            tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [`${Number(v).toFixed(1)} dBm`, 'Avg RSRP']}
            labelFormatter={(label, payload) => {
              const item = payload?.[0]?.payload;
              return item ? `${label} • ${item.Samples?.toLocaleString()} samples` : label;
            }}
          />

          <Bar
            dataKey="Avg"
            name="Avg RSRP"
            radius={[0, 8, 8, 0]}
            isAnimationActive
            animationDuration={650}
            background={{ fill: 'rgba(0,0,0,0.04)', radius: [0, 8, 8, 0] }}
          >
            {(data ?? []).map((entry, index) => (
              <Cell key={`cell-handset-${index}`} fill={getRSRPPointColor(entry.Avg)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default HandsetPerformanceChart;