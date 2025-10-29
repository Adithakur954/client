import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE, NETWORK_COLORS, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useOperatorSamples } from '@/hooks/useDashboardData';
import { applyTopN } from '@/utils/dashboardUtils';
import { formatNumber } from '@/utils/chartUtils';

const OperatorNetworkChart = ({ chartFilters, onChartFiltersChange, operators, networks }) => {
  const { data, isLoading } = useOperatorSamples(chartFilters);

  const filteredData = useMemo(() => {
    return applyTopN(data, chartFilters?.topN);
  }, [data, chartFilters?.topN]);

  const networkTypes = useMemo(() => {
    if (!data) return [];
    const types = new Set();
    data.forEach(op => {
      Object.keys(op).forEach(key => {
        if (key !== 'name' && key !== 'total') {
          types.add(key);
        }
      });
    });
    // Sort network types in descending order (5G, 4G, 3G, 2G)
    return Array.from(types).sort((a, b) => {
      const order = { '5G': 1, '4G': 2, '3G': 3, '2G': 4 };
      return (order[a] || 99) - (order[b] || 99);
    });
  }, [data]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    return (
      <div style={TOOLTIP_STYLE}>
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload
          .filter(p => p.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-700">{entry.name}:</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {formatNumber(entry.value)}
              </span>
            </div>
          ))}
        <div className="border-t border-gray-200 mt-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">Total:</span>
            <span className="text-sm font-bold text-gray-900">
              {formatNumber(payload.reduce((sum, p) => sum + (p.value || 0), 0))}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ChartCard
      title="Operator Network Distribution by Technology"
      dataset={data}
      exportFileName="operator_network_samples"
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
          margin={{ top: 12, right: 24, left: 24, bottom: 40 }}
          barGap={4}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.08)" />
          <XAxis
            dataKey="name"
            tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
            angle={-20}
            textAnchor="end"
            height={60}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            tickFormatter={formatNumber}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="rect"
            iconSize={12}
            formatter={(value) => <span className="text-sm font-medium">{value}</span>}
          />
          {networkTypes.map((network, idx) => (
            <Bar
              key={network}
              dataKey={network}
              name={network}
              fill={NETWORK_COLORS[network] || CHART_COLORS[idx % CHART_COLORS.length]}
              radius={[4, 4, 0, 0]}
              barSize={24}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default OperatorNetworkChart;