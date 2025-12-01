import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { PieChart } from '@mui/x-charts/PieChart';
import { 
  Box, 
  TextField, 
  Typography, 
  Grid, 
  ToggleButton, 
  ToggleButtonGroup, 
  Divider, 
  Button, 
  ButtonGroup 
} from '@mui/material';
import { SignalCellularAlt, SignalCellular4Bar } from '@mui/icons-material';
import ChartCard from '../ChartCard';
import { useCoverageRanking, useQualityRanking } from '@/hooks/useDashboardData.js';
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

const OperatorRankingChart = () => {
  const [chartType, setChartType] = useState('coverage');
  
  const [coverageSettings, setCoverageSettings] = useState({ rsrpMin: -95, rsrpMax: 0 });
  const [qualitySettings, setQualitySettings] = useState({ rsrqMin: -10, rsrqMax: 0 });
  
  const [coverageDraft, setCoverageDraft] = useState({ rsrpMin: '-95', rsrpMax: '0' });
  const [qualityDraft, setQualityDraft] = useState({ rsrqMin: '-10', rsrqMax: '0' });

  const { data: coverageData, isLoading: coverageLoading } = useCoverageRanking(
    coverageSettings.rsrpMin, 
    coverageSettings.rsrpMax
  );
  
  const { data: qualityData, isLoading: qualityLoading } = useQualityRanking(
    qualitySettings.rsrqMin, 
    qualitySettings.rsrqMax
  );

  const currentData = chartType === 'coverage' ? coverageData : qualityData;
  const isLoading = chartType === 'coverage' ? coverageLoading : qualityLoading;

  const chartData = useMemo(() => {
    if (!currentData || currentData.length === 0) return [];
    
    const total = currentData.reduce((sum, item) => sum + (item.value || 0), 0);
    
    return currentData.map((item, index) => ({
      id: index,
      value: item.value,
      label: item.label,
      percentage: total > 0 ? parseFloat(((item.value / total) * 100).toFixed(2)) : 0,
      color: CHART_COLORS[index % CHART_COLORS.length]
    }));
  }, [currentData]);

  useEffect(() => {
    setCoverageDraft({ 
      rsrpMin: String(coverageSettings.rsrpMin), 
      rsrpMax: String(coverageSettings.rsrpMax) 
    });
  }, [coverageSettings]);

  useEffect(() => {
    setQualityDraft({ 
      rsrqMin: String(qualitySettings.rsrqMin), 
      rsrqMax: String(qualitySettings.rsrqMax) 
    });
  }, [qualitySettings]);

  const applyCoverageSettings = () => {
    const rsrpMin = Number(coverageDraft.rsrpMin);
    const rsrpMax = Number(coverageDraft.rsrpMax);

    if (isNaN(rsrpMin) || isNaN(rsrpMax)) {
      return toast.warn("Please enter valid numbers for RSRP range");
    }

    if (rsrpMin > rsrpMax) {
      return toast.warn("RSRP: Min cannot be greater than Max");
    }

    setCoverageSettings({ rsrpMin, rsrpMax });
  };

  const applyQualitySettings = () => {
    const rsrqMin = Number(qualityDraft.rsrqMin);
    const rsrqMax = Number(qualityDraft.rsrqMax);

    if (isNaN(rsrqMin) || isNaN(rsrqMax)) {
      return toast.warn("Please enter valid numbers for RSRQ range");
    }

    if (rsrqMin > rsrqMax) {
      return toast.warn("RSRQ: Min cannot be greater than Max");
    }

    setQualitySettings({ rsrqMin, rsrqMax });
  };

  const handleChartTypeChange = (_, newType) => {
    if (newType !== null) {
      setChartType(newType);
    }
  };

  const getTitle = () => {
    if (chartType === 'coverage') {
      return `Operator Coverage Ranking (RSRP ${coverageSettings.rsrpMin} to ${coverageSettings.rsrpMax} dBm)`;
    }
    return `Operator Quality Ranking (RSRQ ${qualitySettings.rsrqMin} to ${qualitySettings.rsrqMax} dB)`;
  };

  const renderSettings = () => (
    <Box sx={{ p: 2 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="600" gutterBottom>
          Chart Type
        </Typography>
        <ToggleButtonGroup
          value={chartType}
          exclusive
          onChange={handleChartTypeChange}
          fullWidth
          size="small"
          color="primary"
        >
          <ToggleButton value="coverage">Coverage (RSRP)</ToggleButton>
          <ToggleButton value="quality">Quality (RSRQ)</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ my: 2 }} />

      {chartType === 'coverage' && (
        <Box>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            RSRP Coverage Range (dBm)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Min (dBm)"
                value={coverageDraft.rsrpMin}
                onChange={(e) => setCoverageDraft(s => ({ ...s, rsrpMin: e.target.value }))}
                size="small"
                inputProps={{ step: 1 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max (dBm)"
                value={coverageDraft.rsrpMax}
                onChange={(e) => setCoverageDraft(s => ({ ...s, rsrpMax: e.target.value }))}
                size="small"
                inputProps={{ step: 1 }}
              />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}>
            Typical RSRP range: -140 to -44 dBm
          </Typography>
        </Box>
      )}

      {chartType === 'quality' && (
        <Box>
          <Typography variant="subtitle1" fontWeight="600" gutterBottom>
            RSRQ Quality Range (dB)
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Min (dB)"
                value={qualityDraft.rsrqMin}
                onChange={(e) => setQualityDraft(s => ({ ...s, rsrqMin: e.target.value }))}
                size="small"
                inputProps={{ step: 0.5 }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Max (dB)"
                value={qualityDraft.rsrqMax}
                onChange={(e) => setQualityDraft(s => ({ ...s, rsrqMax: e.target.value }))}
                size="small"
                inputProps={{ step: 0.5 }}
              />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block', fontStyle: 'italic' }}>
            Typical RSRQ range: -20 to -3 dB
          </Typography>
        </Box>
      )}
    </Box>
  );

  const renderHeaderActions = () => (
    <ButtonGroup size="small" variant="outlined" sx={{ mr: 1 }}>
      <Button
        onClick={() => setChartType('coverage')}
        variant={chartType === 'coverage' ? 'contained' : 'outlined'}
        startIcon={<SignalCellular4Bar />}
      >
        Coverage
      </Button>
      <Button
        onClick={() => setChartType('quality')}
        variant={chartType === 'quality' ? 'contained' : 'outlined'}
        startIcon={<SignalCellularAlt />}
      >
        Quality
      </Button>
    </ButtonGroup>
  );

  return (
    <ChartCard
      title={getTitle()}
      dataset={chartData}
      exportFileName={chartType === 'coverage' ? 'coverage_rank' : 'quality_rank'}
      isLoading={isLoading}
      showChartFilters={false}
      headerActions={renderHeaderActions()}
      settings={{
        title: 'Ranking Settings',
        render: renderSettings,
        onApply: chartType === 'coverage' ? applyCoverageSettings : applyQualitySettings
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

export default OperatorRankingChart;