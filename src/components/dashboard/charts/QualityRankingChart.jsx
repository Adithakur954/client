import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { PieChart } from '@mui/x-charts/PieChart';
import {
  Box,
  TextField,
  Typography,
  Grid,
  Button,
  ButtonGroup,
  Paper,
  Chip,
  Fade,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  SignalCellularAlt,
  SignalCellular4Bar,
  TrendingUp,
} from '@mui/icons-material';
import ChartCard from '../ChartCard';
import { useCoverageRanking, useQualityRanking } from '@/hooks/useDashboardData.js';
import { formatNumber } from '@/utils/chartUtils';

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

const CHART_COLORS = ['#0a3d91', '#ff0000', '#ffc107', '#e60000', '#7b1fa2', '#0097a7'];
const ALLOWED_OPERATORS = ['jio', 'airtel', 'vi', 'vodafone'];

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

  const chartData = useMemo(() => {
    if (!currentData || currentData.length === 0) return [];

    const filteredData = currentData.filter((item) => {
      const nameLower = item.name.toLowerCase();
      return ALLOWED_OPERATORS.some((operator) => nameLower.includes(operator));
    });

    const total = filteredData.reduce((sum, item) => sum + (item.value || 0), 0);

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

  const handleChartTypeChange = (event, newType) => {
    if (newType !== null) {
      setChartType(newType);
    }
  };

  const getTitle = () => {
    if (chartType === 'coverage') {
      return `Coverage Ranking (RSRP ${coverageSettings.rsrpMin} to ${coverageSettings.rsrpMax} dBm)`;
    }
    return `Quality Ranking (RSRQ ${qualitySettings.rsrqMin} to ${qualitySettings.rsrqMax} dB)`;
  };

  const renderSettings = () => (
    <Box sx={{ p: 2 }}>
      {chartType === 'coverage' && (
        <Fade in={chartType === 'coverage'}>
          <Box>
            <Typography variant="subtitle1" fontWeight="600" fontSize="16px" gutterBottom>
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
                  sx={{ '& .MuiInputLabel-root': { fontSize: '14px' }, '& .MuiInputBase-input': { fontSize: '14px' } }}
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
                  sx={{ '& .MuiInputLabel-root': { fontSize: '14px' }, '& .MuiInputBase-input': { fontSize: '14px' } }}
                />
              </Grid>
            </Grid>
            <Paper sx={{ mt: 2, p: 1.5, backgroundColor: '#e3f2fd', borderRadius: 2 }}>
              <Typography variant="caption" color="primary" fontWeight="500" fontSize="12px">
                💡 Typical RSRP range: -140 to -44 dBm
              </Typography>
            </Paper>
          </Box>
        </Fade>
      )}

      {chartType === 'quality' && (
        <Fade in={chartType === 'quality'}>
          <Box>
            <Typography variant="subtitle1" fontWeight="600" fontSize="16px" gutterBottom>
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
                  sx={{ '& .MuiInputLabel-root': { fontSize: '14px' }, '& .MuiInputBase-input': { fontSize: '14px' } }}
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
                  sx={{ '& .MuiInputLabel-root': { fontSize: '14px' }, '& .MuiInputBase-input': { fontSize: '14px' } }}
                />
              </Grid>
            </Grid>
            <Paper sx={{ mt: 2, p: 1.5, backgroundColor: '#fff3e0', borderRadius: 2 }}>
              <Typography variant="caption" color="warning.dark" fontWeight="500" fontSize="12px">
                💡 Typical RSRQ range: -20 to -3 dB
              </Typography>
            </Paper>
          </Box>
        </Fade>
      )}
    </Box>
  );

  const HeaderToggleButtons = () => (
    <ToggleButtonGroup
      value={chartType}
      exclusive
      onChange={handleChartTypeChange}
      size="small"
      sx={{
        '& .MuiToggleButton-root': {
          fontSize: '13px',
          py: 0.5,
          px: 1.5,
          textTransform: 'none',
          fontWeight: 600,
          border: '1px solid #e0e0e0',
          '&.Mui-selected': {
            color: '#fff',
          },
        },
      }}
    >
      <ToggleButton
        value="coverage"
        sx={{
          '&.Mui-selected': {
            background: 'linear-gradient(45deg, #1976d2 30%, #42a5f5 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #1565c0 30%, #1976d2 90%)',
            },
          },
        }}
      >
        <SignalCellular4Bar sx={{ fontSize: 16, mr: 0.5 }} />
        Coverage
      </ToggleButton>
      <ToggleButton
        value="quality"
        sx={{
          '&.Mui-selected': {
            background: 'linear-gradient(45deg, #f57c00 30%, #ffb74d 90%)',
            '&:hover': {
              background: 'linear-gradient(45deg, #ef6c00 30%, #f57c00 90%)',
            },
          },
        }}
      >
        <SignalCellularAlt sx={{ fontSize: 16, mr: 0.5 }} />
        Quality
      </ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <ChartCard
      title={getTitle()}
      dataset={chartData}
      exportFileName={chartType === 'coverage' ? 'coverage_rank' : 'quality_rank'}
      isLoading={isLoading}
      showChartFilters={false}
      headerActions={<HeaderToggleButtons />}
      settings={{
        title: `${chartType === 'coverage' ? 'RSRP' : 'RSRQ'} Range Settings`,
        render: renderSettings,
        onApply: chartType === 'coverage' ? applyCoverageSettings : applyQualitySettings,
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          gap: 1.5,
          p: 1.5,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            flex: '0 0 50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            minWidth: 0,
          }}
        >
          <Box sx={{ position: 'relative' }}>
            <PieChart
              series={[
                {
                  data: chartData,
                  highlightScope: { faded: 'global', highlighted: 'item' },
                  faded: {
                    innerRadius: 20,
                    additionalRadius: -20,
                    color: 'gray',
                  },
                  innerRadius: 50,
                  outerRadius: 95,
                  paddingAngle: 3,
                  cornerRadius: 6,
                  arcLabel: (item) => `${item.percentage}%`,
                  arcLabelMinAngle: 25,
                  arcLabelRadius: '70%',
                  valueFormatter: (item) =>
                    `${formatNumber(item.value)} (${item.percentage}%)`,
                },
              ]}
              colors={chartData.map((item) => item.color)}
              width={240}
              height={240}
              slotProps={{
                legend: { hidden: true },
              }}
              sx={{
                '& .MuiPieArc-root': {
                  stroke: '#ffffff',
                  strokeWidth: 2,
                  filter: 'drop-shadow(2px 4px 6px rgba(0,0,0,0.15))',
                  transition: 'all 0.3s ease',
                  cursor: 'pointer',
                  '&:hover': {
                    filter: 'drop-shadow(4px 6px 12px rgba(0,0,0,0.3))',
                  },
                },
                '& .MuiChartsArcLabel-root': {
                  fill: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                },
              }}
              margin={{ top: 10, bottom: 10, left: 10, right: 10 }}
            />

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
                  fontSize: '18px',
                }}
              >
                {formatNumber(stats.total)}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  color: '#666',
                  fontSize: '11px',
                  display: 'block',
                }}
              >
                Total Samples
              </Typography>
              {stats.leader && (
                <Chip
                  icon={<TrendingUp sx={{ fontSize: 14 }} />}
                  label={stats.leader.label}
                  size="small"
                  sx={{
                    mt: 0.5,
                    height: 20,
                    fontSize: '10px',
                    background: stats.leader.gradient,
                    color: stats.leader.color === '#ffc107' ? '#333' : '#fff',
                    fontWeight: 600,
                    '& .MuiChip-icon': { ml: 0.5 },
                  }}
                />
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 0.5, mt: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Chip
              size="small"
              label={`${chartData.length} Operators`}
              sx={{ fontSize: '11px', height: 22, backgroundColor: '#f5f5f5', fontWeight: 500 }}
            />
            <Chip
              size="small"
              label={`Avg: ${formatNumber(Math.round(stats.average))}`}
              sx={{ fontSize: '11px', height: 22, backgroundColor: '#f5f5f5', fontWeight: 500 }}
            />
          </Box>
        </Box>

        <Box
          sx={{
            flex: '0 0 48%',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            minWidth: 0,
            pr: 0.5,
            '&::-webkit-scrollbar': {
              width: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: '#ccc',
              borderRadius: '2px',
            },
          }}
        >
          <Typography
            variant="subtitle2"
            fontWeight="700"
            sx={{
              color: '#333',
              mb: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              fontSize: '14px',
              flexShrink: 0,
            }}
          >
             Rankings
          </Typography>

          {chartData.map((item, index) => (
            <Paper
              key={index}
              elevation={2}
              sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 1.5,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                border: `1px solid ${item.color}20`,
                flexShrink: 0,
                '&:hover': {
                  transform: 'translateX(3px)',
                  boxShadow: `0 4px 12px ${item.color}30`,
                  borderColor: item.color,
                },
              }}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: `linear-gradient(90deg, ${item.lightColor} 0%, #ffffff 100%)`,
                  opacity: 0.5,
                }}
              />

              <Box
                sx={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                }}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: '5px',
                    background: item.gradient,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: item.color === '#ffc107' ? '#333' : '#fff',
                    fontWeight: 800,
                    fontSize: '14px',
                    boxShadow: `0 2px 6px ${item.color}40`,
                    flexShrink: 0,
                  }}
                >
                  #{item.rank}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    variant="body2"
                    fontWeight="700"
                    sx={{
                      color: '#333',
                      lineHeight: 1.2,
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.3,
                      mb: 0.3,
                    }}
                  >
                    <span style={{ fontSize: '12px' }}>{item.icon}</span>
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

                  <Box
                    sx={{
                      height: 4,
                      backgroundColor: '#e0e0e0',
                      borderRadius: 2,
                      overflow: 'hidden',
                      mb: 0.3,
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${item.percentage}%`,
                        background: item.gradient,
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: '#666',
                        fontSize: '11px',
                        fontWeight: 500,
                      }}
                    >
                      {formatNumber(item.value)}
                    </Typography>
                    <Chip
                      label={`${item.percentage}%`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '11px',
                        fontWeight: 700,
                        background: item.gradient,
                        color: item.color === '#ffc107' ? '#333' : '#fff',
                        '& .MuiChip-label': { px: 0.8 },
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