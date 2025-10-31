import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { PieChart } from '@mui/x-charts/PieChart';
import { Box, TextField, Typography, Grid, Paper } from '@mui/material';
import ChartCard from '../ChartCard';
import { useQualityRanking } from '@/hooks/useDashboardData';
import { formatNumber } from '@/utils/chartUtils';

const CHART_COLORS = [
  '#1976d2', '#d32f2f', '#388e3c', '#f57c00', 
  '#7b1fa2', '#0097a7', '#c2185b', '#5d4037',
];

const QualityRankingChart = () => {
  const [settings, setSettings] = useState({ rsrqMin: -10, rsrqMax: 0 });
  const [draft, setDraft] = useState({ rsrqMin: '-10', rsrqMax: '0' });

  const { data, isLoading } = useQualityRanking(settings.rsrqMin, settings.rsrqMax);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return { pieData: [], total: 0 };
    
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    
    const pieData = data.map((item, index) => ({
      id: index,
      value: item.value,
      label: item.label,
      percentage: total > 0 ? parseFloat(((item.value / total) * 100).toFixed(2)) : 0,
    }));

    return { pieData, total };
  }, [data]);

  useEffect(() => {
    setDraft({ 
      rsrqMin: String(settings.rsrqMin), 
      rsrqMax: String(settings.rsrqMax) 
    });
  }, [settings]);

  const applySettings = () => {
    const rsrqMin = Number(draft.rsrqMin);
    const rsrqMax = Number(draft.rsrqMax);

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
      dataset={chartData.pieData}
      exportFileName="quality_rank"
      isLoading={isLoading}
      showChartFilters={false}
      settings={{
        title: 'Quality Rank Settings',
        render: () => (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="600" gutterBottom>
              RSRQ Quality Range (dB)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Min (dB)"
                  value={draft.rsrqMin}
                  onChange={(e) => setDraft(s => ({ ...s, rsrqMin: e.target.value }))}
                  size="small"
                  inputProps={{ step: 0.5 }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max (dB)"
                  value={draft.rsrqMax}
                  onChange={(e) => setDraft(s => ({ ...s, rsrqMax: e.target.value }))}
                  size="small"
                  inputProps={{ step: 0.5 }}
                />
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}>
              Typical RSRQ range: -20 to -3 dB
            </Typography>
          </Box>
        ),
        onApply: applySettings
      }}
    >
      <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Total Display */}
        

        {/* Pie Chart */}
        <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 0 }}>
          <PieChart
            series={[
              {
                data: chartData.pieData,
                highlightScope: { faded: 'global', highlighted: 'item' },
                innerRadius: 50,
                outerRadius: 110,
                paddingAngle: 2,
                cornerRadius: 4,
                arcLabel: (item) => `${item.percentage}%`,
                arcLabelMinAngle: 25,
                valueFormatter: (item) => `${formatNumber(item.value)} (${item.percentage}%)`,
              },
            ]}
            colors={CHART_COLORS}
            height={350}
            slotProps={{
              legend: {
                direction: 'row',
                position: { vertical: 'bottom', horizontal: 'middle' },
                padding: { top: 10, bottom: 10 },
                itemMarkWidth: 12,
                itemMarkHeight: 12,
                markGap: 6,
                itemGap: 10,
              },
            }}
            margin={{ top: 10, right: 10, bottom: 70, left: 10 }}
            sx={{
              '& .MuiChartsLegend-series text': {
                fontSize: '12px !important',
                fontWeight: '500 !important',
              },
            }}
          />
        </Box>
      </Box>
    </ChartCard>
  );
};

export default QualityRankingChart;