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
  ButtonGroup,
  Paper,
  Chip,
  Fade,
} from '@mui/material';
import {
  SignalCellularAlt,
  SignalCellular4Bar,
  TrendingUp,
} from '@mui/icons-material';
import ChartCard from '../ChartCard';
import { useCoverageRanking, useQualityRanking } from '@/hooks/useDashboardData.js';
import { formatNumber } from '@/utils/chartUtils';

// Operator-specific brand colors with gradients
const OPERATOR_COLORS = {
  jio: {
    primary: '#0a3d91',
    gradient: 'linear-gradient(135deg, #0a3d91 0%, #1565c0 100%)',
    light: '#e3f2fd',
  },
  airtel: {
    primary: '#ff0000',
    gradient: 'linear-gradient(135deg, #ff0000 0%, #ff5252 100%)',
    light: '#ffebee',
  },
  vi: {
    primary: '#ffc107',
    gradient: 'linear-gradient(135deg, #ffc107 0%, #ffca28 100%)',
    light: '#fff8e1',
  },
  vodafone: {
    primary: '#e60000',
    gradient: 'linear-gradient(135deg, #e60000 0%, #ff1744 100%)',
    light: '#ffebee',
  },
};

// Fallback colors
const CHART_COLORS = ['#0a3d91', '#ff0000', '#ffc107', '#e60000', '#7b1fa2', '#0097a7'];

// Allowed telecom operators
const ALLOWED_OPERATORS = ['jio', 'airtel', 'vi', 'vodafone'];

// Helper function to get operator config
const getOperatorConfig = (name) => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('jio')) return OPERATOR_COLORS.jio;
  if (nameLower.includes('airtel')) return OPERATOR_COLORS.airtel;
  if (nameLower.includes('vi') || nameLower.includes('vodafone')) return OPERATOR_COLORS.vi;
  return {
    primary: CHART_COLORS[0],
    gradient: CHART_COLORS[0],
    light: '#f5f5f5',
  };
};

// Helper function to get operator icon
const getOperatorIcon = (name) => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('jio')) return '📶';
  if (nameLower.includes('airtel')) return '📡';
  if (nameLower.includes('vi') || nameLower.includes('vodafone')) return '📱';
  return '📊';
};

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

  // Filter and process chart data
  const chartData = useMemo(() => {
    if (!currentData || currentData.length === 0) return [];

    // Filter only allowed operators (JIO, Airtel, Vi, Vodafone)
    const filteredData = currentData.filter((item) => {
      const nameLower = item.name.toLowerCase();
      return ALLOWED_OPERATORS.some((operator) => nameLower.includes(operator));
    });

    // Calculate total from filtered data
    const total = filteredData.reduce((sum, item) => sum + (item.value || 0), 0);

    // Sort by value descending and map with colors
    return filteredData
      .sort((a, b) => b.value - a.value)
      .map((item, index) => {
        const config = getOperatorConfig(item.name);

        return {
          id: index,
          value: item.value,
          label: item.name,
          originalRank: item.rank,
          percentage: total > 0 ? parseFloat(((item.value / total) * 100).toFixed(1)) : 0,
          color: config.primary,
          gradient: config.gradient,
          lightColor: config.light,
          icon: getOperatorIcon(item.name),
          rank: index + 1,
        };
      });
  }, [currentData]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (chartData.length === 0) return { total: 0, leader: null, average: 0 };

    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const leader = chartData[0];
    const average = total / chartData.length;

    return { total, leader, average };
  }, [chartData]);

  useEffect(() => {
    setCoverageDraft({
      rsrpMin: String(coverageSettings.rsrpMin),
      rsrpMax: String(coverageSettings.rsrpMax),
    });
  }, [coverageSettings]);

  useEffect(() => {
    setQualityDraft({
      rsrqMin: String(qualitySettings.rsrqMin),
      rsrqMax: String(qualitySettings.rsrqMax),
    });
  }, [qualitySettings]);

  const applyCoverageSettings = () => {
    const rsrpMin = Number(coverageDraft.rsrpMin);
    const rsrpMax = Number(coverageDraft.rsrpMax);

    if (isNaN(rsrpMin) || isNaN(rsrpMax)) {
      return toast.warn('Please enter valid numbers for RSRP range');
    }

    if (rsrpMin > rsrpMax) {
      return toast.warn('RSRP: Min cannot be greater than Max');
    }

    setCoverageSettings({ rsrpMin, rsrpMax });
  };

  const applyQualitySettings = () => {
    const rsrqMin = Number(qualityDraft.rsrqMin);
    const rsrqMax = Number(qualityDraft.rsrqMax);

    if (isNaN(rsrqMin) || isNaN(rsrqMax)) {
      return toast.warn('Please enter valid numbers for RSRQ range');
    }

    if (rsrqMin > rsrqMax) {
      return toast.warn('RSRQ: Min cannot be greater than Max');
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
          <ToggleButton value="coverage">
            <SignalCellular4Bar sx={{ mr: 1, fontSize: 18 }} />
            Coverage (RSRP)
          </ToggleButton>
          <ToggleButton value="quality">
            <SignalCellularAlt sx={{ mr: 1, fontSize: 18 }} />
            Quality (RSRQ)
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Divider sx={{ my: 2 }} />

      {chartType === 'coverage' && (
        <Fade in={chartType === 'coverage'}>
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
                  onChange={(e) => setCoverageDraft((s) => ({ ...s, rsrpMin: e.target.value }))}
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
                  onChange={(e) => setCoverageDraft((s) => ({ ...s, rsrpMax: e.target.value }))}
                  size="small"
                  inputProps={{ step: 1 }}
                />
              </Grid>
            </Grid>
            <Paper
              sx={{
                mt: 2,
                p: 1.5,
                backgroundColor: '#e3f2fd',
                borderRadius: 2,
              }}
            >
              <Typography variant="caption" color="primary" fontWeight="500">
                💡 Typical RSRP range: -140 to -44 dBm
              </Typography>
            </Paper>
          </Box>
        </Fade>
      )}

      {chartType === 'quality' && (
        <Fade in={chartType === 'quality'}>
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
                  onChange={(e) => setQualityDraft((s) => ({ ...s, rsrqMin: e.target.value }))}
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
                  onChange={(e) => setQualityDraft((s) => ({ ...s, rsrqMax: e.target.value }))}
                  size="small"
                  inputProps={{ step: 0.5 }}
                />
              </Grid>
            </Grid>
            <Paper
              sx={{
                mt: 2,
                p: 1.5,
                backgroundColor: '#fff3e0',
                borderRadius: 2,
              }}
            >
              <Typography variant="caption" color="warning.dark" fontWeight="500">
                💡 Typical RSRQ range: -20 to -3 dB
              </Typography>
            </Paper>
          </Box>
        </Fade>
      )}
    </Box>
  );

  const renderHeaderActions = () => (
    <ButtonGroup size="small" variant="outlined" sx={{ mr: 1 }}>
      <Button
        onClick={() => setChartType('coverage')}
        variant={chartType === 'coverage' ? 'contained' : 'outlined'}
        startIcon={<SignalCellular4Bar sx={{ fontSize: 16 }} />}
        sx={{
          fontSize: '12px',
          py: 0.5,
          transition: 'all 0.3s ease',
          ...(chartType === 'coverage' && {
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
          }),
        }}
      >
        Coverage
      </Button>
      <Button
        onClick={() => setChartType('quality')}
        variant={chartType === 'quality' ? 'contained' : 'outlined'}
        startIcon={<SignalCellularAlt sx={{ fontSize: 16 }} />}
        sx={{
          fontSize: '12px',
          py: 0.5,
          transition: 'all 0.3s ease',
          ...(chartType === 'quality' && {
            background: 'linear-gradient(45deg, #f57c00 30%, #ffb74d 90%)',
          }),
        }}
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
        onApply: chartType === 'coverage' ? applyCoverageSettings : applyQualitySettings,
      }}
    >
      {/* Main Container - Side by Side Layout */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          gap: 2,
          p: 2,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        {/* LEFT SIDE - Pie Chart */}
        <Box
          sx={{
            flex: '0 0 52%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <PieChart
              series={[
                {
                  data: chartData,
                  highlightScope: { faded: 'global', highlighted: 'item' },
                  faded: {
                    innerRadius: 25,
                    additionalRadius: -25,
                    color: 'gray',
                  },
                  innerRadius: 55,
                  outerRadius: 105,
                  paddingAngle: 3,
                  cornerRadius: 8,
                  arcLabel: (item) => `${item.percentage}%`,
                  arcLabelMinAngle: 20,
                  arcLabelRadius: '68%',
                  valueFormatter: (item) =>
                    `${formatNumber(item.value)} (${item.percentage}%)`,
                },
              ]}
              colors={chartData.map((item) => item.color)}
              width={260}
              height={260}
              slotProps={{
                legend: { hidden: true },
              }}
              sx={{
                '& .MuiPieArc-root': {
                  stroke: '#ffffff',
                  strokeWidth: 3,
                  filter: 'drop-shadow(3px 5px 8px rgba(0,0,0,0.2))',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  cursor: 'pointer',
                  '&:hover': {
                    filter: 'drop-shadow(5px 8px 15px rgba(0,0,0,0.35))',
                    transform: 'scale(1.03)',
                  },
                },
                '& .MuiChartsArcLabel-root': {
                  fill: '#ffffff',
                  fontWeight: 700,
                  fontSize: '11px',
                  textShadow: '1px 1px 3px rgba(0,0,0,0.6)',
                },
              }}
              margin={{ top: 15, bottom: 15, left: 15, right: 15 }}
            />

            {/* Center Label */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <Typography
                variant="h6"
                fontWeight="800"
                sx={{
                  background:
                    chartType === 'coverage'
                      ? 'linear-gradient(135deg, #1976d2, #42a5f5)'
                      : 'linear-gradient(135deg, #f57c00, #ffb74d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.1,
                  fontSize: '16px',
                }}
              >
                {formatNumber(stats.total)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#666',
                  fontSize: '9px',
                  display: 'block',
                }}
              >
                Total Samples
              </Typography>
              {stats.leader && (
                <Chip
                  icon={<TrendingUp sx={{ fontSize: 12 }} />}
                  label={stats.leader.label}
                  size="small"
                  sx={{
                    mt: 0.5,
                    height: 18,
                    fontSize: '8px',
                    background: stats.leader.gradient,
                    color: stats.leader.color === '#ffc107' ? '#333' : '#fff',
                    fontWeight: 600,
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Stats Below Chart */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip
              size="small"
              label={`${chartData.length} Operators`}
              sx={{ fontSize: '9px', height: 20, backgroundColor: '#f5f5f5', fontWeight: 500 }}
            />
            <Chip
              size="small"
              label={`Avg: ${formatNumber(Math.round(stats.average))}`}
              sx={{ fontSize: '9px', height: 20, backgroundColor: '#f5f5f5', fontWeight: 500 }}
            />
            <Chip
              size="small"
              icon={
                chartType === 'coverage' ? (
                  <SignalCellular4Bar sx={{ fontSize: 12 }} />
                ) : (
                  <SignalCellularAlt sx={{ fontSize: 12 }} />
                )
              }
              label={chartType === 'coverage' ? 'RSRP' : 'RSRQ'}
              sx={{
                fontSize: '9px',
                height: 20,
                backgroundColor: chartType === 'coverage' ? '#e3f2fd' : '#fff3e0',
                color: chartType === 'coverage' ? '#1976d2' : '#f57c00',
                fontWeight: 600,
                '& .MuiChip-icon': {
                  color: 'inherit',
                },
              }}
            />
          </Box>
        </Box>

        {/* RIGHT SIDE - Beautiful Legend */}
        <Box
          sx={{
            flex: '0 0 45%',
            display: 'flex',
            flexDirection: 'column',
            gap: 1.2,
            overflowY: 'auto',
            pr: 0.5,
            '&::-webkit-scrollbar': {
              width: '5px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#ccc',
              borderRadius: '3px',
            },
          }}
        >
          {/* Legend Title */}
          <Typography
            variant="subtitle2"
            fontWeight="700"
            sx={{
              color: '#333',
              mb: 0.3,
              display: 'flex',
              alignItems: 'center',
              gap: 0.8,
              fontSize: '12px',
            }}
          >
            📊 Operator Rankings
          </Typography>

          {/* Legend Items */}
          {chartData.map((item, index) => (
            <Paper
              key={index}
              elevation={3}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 2,
                transition: 'all 0.3s ease',
                cursor: 'pointer',
                border: `2px solid ${item.color}20`,
                '&:hover': {
                  transform: 'translateX(4px)',
                  boxShadow: `0 5px 16px ${item.color}40`,
                  borderColor: item.color,
                },
              }}
            >
              {/* Gradient Background */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `linear-gradient(90deg, ${item.lightColor} 0%, #ffffff 100%)`,
                  opacity: 0.6,
                }}
              />

              {/* Content */}
              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2,
                  p: 1.2,
                }}
              >
                {/* Rank Badge */}
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '6px',
                    background: item.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color === '#ffc107' ? '#333' : '#fff',
                    fontWeight: 800,
                    fontSize: '14px',
                    boxShadow: `0 3px 8px ${item.color}50`,
                    flexShrink: 0,
                  }}
                >
                  #{item.rank}
                </Box>

                {/* Operator Info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight="700"
                    sx={{
                      color: '#333',
                      lineHeight: 1.2,
                      fontSize: '11px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.4,
                      mb: 0.4,
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{item.icon}</span>
                    <span
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.label}
                    </span>
                  </Typography>

                  {/* Progress Bar */}
                  <Box
                    sx={{
                      height: 5,
                      backgroundColor: '#e0e0e0',
                      borderRadius: 2.5,
                      overflow: 'hidden',
                      mb: 0.4,
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${item.percentage}%`,
                        background: item.gradient,
                        transition: 'width 0.5s ease',
                        boxShadow: `0 0 6px ${item.color}80`,
                      }}
                    />
                  </Box>

                  {/* Stats */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#666',
                        fontSize: '9px',
                        fontWeight: 600,
                      }}
                    >
                      {formatNumber(item.value)} samples
                    </Typography>
                    <Chip
                      label={`${item.percentage}%`}
                      size="small"
                      sx={{
                        height: 16,
                        fontSize: '9px',
                        fontWeight: 700,
                        background: item.gradient,
                        color: item.color === '#ffc107' ? '#333' : '#fff',
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      </Box>
    </ChartCard>
  );
};

export default OperatorRankingChart;