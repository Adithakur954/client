import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { PieChart } from '@mui/x-charts/PieChart';
import { Box, TextField, Typography, Grid } from '@mui/material';
import ChartCard from '../ChartCard';
import { useCoverageRanking } from '@/hooks/useDashboardData.js';
import { formatNumber } from '@/utils/chartUtils';

const CHART_COLORS = [
  '#1976d2',
  '#d32f2f',
  '#388e3c',
  '#f57c00',
  '#7b1fa2',
  '#0097a7',
  '#c2185b',
  '#5d4037',
];

const CoverageRankingChart = () => {
  const [settings, setSettings] = useState({ rsrpMin: -95, rsrpMax: 0 });
  const [draft, setDraft] = useState({ rsrpMin: '-95', rsrpMax: '0' });

  const { data, isLoading } = useCoverageRanking(settings.rsrpMin, settings.rsrpMax);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    
    return data.map((item, index) => ({
      id: index,
      value: item.value,
      label: item.label,
      percentage: total > 0 ? parseFloat(((item.value / total) * 100).toFixed(2)) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [data]);

  useEffect(() => {
    setDraft({ 
      rsrpMin: String(settings.rsrpMin), 
      rsrpMax: String(settings.rsrpMax) 
    });
  }, [settings]);

  const applySettings = () => {
    const rsrpMin = Number(draft.rsrpMin);
    const rsrpMax = Number(draft.rsrpMax);

    if (isNaN(rsrpMin) || isNaN(rsrpMax)) {
      return toast.warn("Please enter valid numbers for RSRP range");
    }

    if (rsrpMin > rsrpMax) {
      return toast.warn("RSRP: Min cannot be greater than Max");
    }

    setSettings({ rsrpMin, rsrpMax });
  };

  return (
    <ChartCard
      title={`Operator Coverage Ranking (RSRP ${settings.rsrpMin} to ${settings.rsrpMax} dBm)`}
      dataset={chartData}
      exportFileName="coverage_rank"
      isLoading={isLoading}
      showChartFilters={false}
      settings={{
        title: 'Coverage Rank Settings',
        render: () => (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="600" gutterBottom>
              RSRP Coverage Range (dBm)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Min (dBm)"
                  value={draft.rsrpMin}
                  onChange={(e) => setDraft(s => ({ ...s, rsrpMin: e.target.value }))}
                  size="small"
                  inputProps={{ step: 1 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max (dBm)"
                  value={draft.rsrpMax}
                  onChange={(e) => setDraft(s => ({ ...s, rsrpMax: e.target.value }))}
                  size="small"
                  inputProps={{ step: 1 }}
                />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}>
              Typical RSRP range: -140 to -44 dBm
            </Typography>
          </Box>
        ),
        onApply: applySettings
      }}
    >
      <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PieChart
          series={[
            {
              data: chartData,
              highlightScope: { faded: 'global', highlighted: 'item' },
              faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
              innerRadius: 60,
              outerRadius: 130,
              paddingAngle: 2,
              cornerRadius: 5,
              arcLabel: (item) => `${item.percentage}%`,
              arcLabelMinAngle: 35,
              arcLabelRadius: '60%',
              valueFormatter: (item) => `${formatNumber(item.value)} (${item.percentage}%)`,
            },
          ]}
          colors={CHART_COLORS}
          width={500}
          height={400}
          slotProps={{
            legend: {
              direction: 'row',
              position: { vertical: 'bottom', horizontal: 'middle' },
              padding: 0,
            },
          }}
          sx={{
            '& .MuiPieArc-root': {
              stroke: '#fff',
              strokeWidth: 2,
            },
            '& .MuiChartsLegend-mark': {
              width: 14,
              height: 14,
            },
            '& .MuiChartsLegend-series': {
              gap: '6px',
            },
            '& .MuiChartsLegend-root': {
              gap: '12px',
            },
            '& .MuiChartsLegend-label': {
              fontSize: '13px !important',
              fontWeight: '500 !important',
            },
          }}
          margin={{ top: 20, bottom: 80, left: 20, right: 20 }}
        />
      </Box>
    </ChartCard>
  );
};

export default CoverageRankingChart;