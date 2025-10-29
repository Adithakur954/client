import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useBandDistribution } from '@/hooks/useDashboardData';
import { applyTopN } from '@/utils/dashboardUtils';
import { formatNumber } from '@/utils/chartUtils';

const BandDistributionChart = ({ chartFilters, onChartFiltersChange, operators, networks }) => {
  const { data, isLoading } = useBandDistribution(chartFilters);

  const filteredData = useMemo(() => {
    return applyTopN(data, chartFilters?.topN);
  }, [data, chartFilters?.topN]);

  return (
    <ChartCard
      title="Frequency Band Distribution"
      dataset={data}
      exportFileName="band_distribution"
      isLoading={isLoading}
      chartFilters={chartFilters}
      onChartFiltersChange={onChartFiltersChange}
      operators={operators}
      networks={networks}
      showChartFilters={true}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={filteredData}
          layout="vertical"
          margin={{ top: 12, right: 40, left: 10, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.08)" />
          <XAxis
            type="number"
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            tickFormatter={formatNumber}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={130}
            tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              style={{ fill: '#111827', fontSize: '12px', fontWeight: 700 }}
              formatter={formatNumber}
            />
            {filteredData?.map((entry, index) => (
              <Cell key={`cell-band-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default BandDistributionChart;