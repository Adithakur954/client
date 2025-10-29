import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { toast } from 'react-toastify';
import ChartCard from '../ChartCard';
import MetricSelectorSettings from '../MetricSelectorSettings';
import { TOOLTIP_STYLE, METRICS } from '@/components/constants/dashboardConstants';
import { useMetricData } from '@/hooks/useDashboardData';
import { applyTopN } from '@/utils/dashboardUtils';
import { getMetricColorFunction } from '@/utils/chartUtils';

const MetricChart = ({ chartFilters, onChartFiltersChange, operators, networks }) => {
  const [selectedMetric, setSelectedMetric] = useState('rsrp');
  const [draftMetric, setDraftMetric] = useState('rsrp');

  const { data, isLoading } = useMetricData(selectedMetric, chartFilters);

  const filteredData = useMemo(() => {
    return applyTopN(data, chartFilters?.topN);
  }, [data, chartFilters?.topN]);

  const metricConfig = useMemo(() => {
    return METRICS.find(m => m.value === selectedMetric) || METRICS[0];
  }, [selectedMetric]);

  const colorFunction = useMemo(() => {
    return getMetricColorFunction(selectedMetric);
  }, [selectedMetric]);

  return (
    <ChartCard
      title={`${metricConfig.label} by Operator`}
      dataset={data}
      exportFileName={`avg_${selectedMetric}_per_operator`}
      isLoading={isLoading}
      chartFilters={chartFilters}
      onChartFiltersChange={onChartFiltersChange}
      operators={operators}
      networks={networks}
      showChartFilters={true}
      settings={{
        title: 'Metric Settings',
        render: () => (
          <MetricSelectorSettings
            value={draftMetric}
            onChange={setDraftMetric}
          />
        ),
        onApply: () => {
          setSelectedMetric(draftMetric);
          toast.success(`Switched to ${METRICS.find(m => m.value === draftMetric)?.label}`);
        }
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={filteredData}
          layout="vertical"
          margin={{ top: 12, right: 70, left: 10, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.08)" />
          <XAxis
            type="number"
            domain={metricConfig.domain}
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={140}
            tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v) => [
              `${Number(v).toFixed(2)} ${metricConfig.unit}`,
              metricConfig.label
            ]}
          />
          <Bar dataKey="value" name={metricConfig.label} radius={[0, 8, 8, 0]}>
            <LabelList
              dataKey="value"
              content={({ x = 0, y = 0, width = 0, height = 0, value }) => {
                const midY = y + height / 2;
                const barEndX = width >= 0 ? x + width : x;
                const dx = width >= 0 ? 10 : -10;
                const anchor = width >= 0 ? 'start' : 'end';
                const val = Number.isFinite(Number(value)) ? Number(value).toFixed(1) : value;
                return (
                  <text
                    x={barEndX + dx}
                    y={midY}
                    fill="#111827"
                    dominantBaseline="middle"
                    textAnchor={anchor}
                    fontSize={12}
                    fontWeight={700}
                  >
                    {`${val} ${metricConfig.unit}`}
                  </text>
                );
              }}
            />
            {filteredData?.map((entry, index) => (
              <Cell
                key={`cell-metric-${index}`}
                fill={colorFunction(entry.value)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default MetricChart;