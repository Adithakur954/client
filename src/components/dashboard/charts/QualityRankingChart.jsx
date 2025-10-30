import React, { useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { toast } from 'react-toastify';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useQualityRanking } from '@/hooks/useDashboardData';
import { formatNumber } from '@/utils/chartUtils';

const QualityRankingChart = () => {
  const [settings, setSettings] = useState({ rsrqMin: -10, rsrqMax: 0 });
  const [draft, setDraft] = useState({ rsrqMin: '-10', rsrqMax: '0' }); // Store as strings

  const { data, isLoading } = useQualityRanking(settings.rsrqMin, settings.rsrqMax);

  useEffect(() => {
    setDraft({ 
      rsrqMin: String(settings.rsrqMin), 
      rsrqMax: String(settings.rsrqMax) 
    });
  }, [settings]);

  const applySettings = () => {
    const rsrqMin = Number(draft.rsrqMin);
    const rsrqMax = Number(draft.rsrqMax);

    // Validation
    if (isNaN(rsrqMin) || isNaN(rsrqMax)) {
      return toast.warn("Please enter valid numbers for RSRQ range");
    }

    if (rsrqMin > rsrqMax) {
      return toast.warn("RSRQ: Min cannot be greater than Max");
    }

    setSettings({ rsrqMin, rsrqMax });
  };

  return (
    <ChartCard
      title={`Operator Quality Ranking (RSRQ ${settings.rsrqMin} to ${settings.rsrqMax} dB)`}
      dataset={data}
      exportFileName="quality_rank"
      isLoading={isLoading}
      showChartFilters={false}
      settings={{
        title: 'Quality Rank Settings',
        render: () => (
          <div className="space-y-4">
            <div className="font-semibold text-gray-800 text-base">RSRQ Quality Range (dB)</div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Min (dB)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="-10"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={draft.rsrqMin}
                  onChange={(e) => setDraft(s => ({ ...s, rsrqMin: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Max (dB)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={draft.rsrqMax}
                  onChange={(e) => setDraft(s => ({ ...s, rsrqMax: e.target.value }))}
                />
              </div>
            </div>
            <div className="text-xs text-gray-500 italic">
              Typical RSRQ range: -20 to -3 dB
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
              <Cell key={`cell-qual-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};

export default QualityRankingChart;