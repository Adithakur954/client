import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { toast } from 'react-toastify';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useCoverageRanking } from '@/hooks/useDashboardData';
import { formatNumber } from '@/utils/chartUtils';

const CoverageRankingChart = () => {
  const [settings, setSettings] = useState({ rsrpMin: -95, rsrpMax: 0 });
  const [draft, setDraft] = useState(settings);

  const { data, isLoading } = useCoverageRanking(settings.rsrpMin, settings.rsrpMax);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const applySettings = () => {
    if (draft.rsrpMin > draft.rsrpMax) {
      return toast.warn("RSRP: Min cannot be greater than Max");
    }
    setSettings(draft);
  };

  return (
    <ChartCard
      title={`Operator Coverage Ranking (RSRP ${settings.rsrpMin} to ${settings.rsrpMax} dBm)`}
      dataset={data}
      exportFileName="coverage_rank"
      isLoading={isLoading}
      showChartFilters={false}
      settings={{
        title: 'Coverage Rank Settings',
        render: () => (
          <div className="space-y-4">
            <div className="font-semibold text-gray-800 text-base">RSRP Coverage Range (dBm)</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Min</label>
                <input
                  type="number"
                  step="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={draft.rsrpMin}
                  onChange={(e) => setDraft(s => ({ ...s, rsrpMin: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Max</label>
                <input
                  type="number"
                  step="1"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={draft.rsrpMax}
                  onChange={(e) => setDraft(s => ({ ...s, rsrpMax: Number(e.target.value) }))}
                />
              </div>
            </div>
          </div>
        ),
        onApply: applySettings
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 40, left: 10, bottom: 45 }}
          barSize={28}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal stroke="rgba(0,0,0,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={55}
            tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
          />
          <YAxis
            type="number"
            tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            tickFormatter={formatNumber}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v.toLocaleString(), 'Samples in range']} />
          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
            <LabelList
              dataKey="value"
              position="top"
              style={{ fill: '#111827', fontSize: '12px', fontWeight: 700 }}
              formatter={formatNumber}
            />
            {data?.map((entry, index) => (
              <Cell key={`cell-cov-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default CoverageRankingChart;