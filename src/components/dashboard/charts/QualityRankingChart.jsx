import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Gauge, gaugeClasses } from '@mui/x-charts/Gauge';
import {
  Box,
  TextField,
  Typography,
  Grid,
  Chip,
  Fade,
  ToggleButton,
  ToggleButtonGroup,
  alpha,
} from '@mui/material';
import {
  SignalCellularAlt,
  SignalCellular4Bar,
  Circle,
} from '@mui/icons-material';
import ChartCard from '../ChartCard';
import { useCoverageRanking, useQualityRanking } from '@/hooks/useDashboardData.js';
import { formatNumber } from '@/utils/chartUtils';

const OPERATOR_COLORS = {
  jio: { primary: '#0a3d91', light: '#e3f2fd', dark: '#0d47a1' },
  airtel: { primary: '#E40000', light: '#ffebee', dark: '#b71c1c' },
  vi: { primary: '#FFB800', light: '#fff8e1', dark: '#f57f17' },
  vodafone: { primary: '#e60000', light: '#ffebee', dark: '#c62828' },
  yas: { primary: '#7b1fa2', light: '#f3e5f5', dark: '#4a148c' },
};

const ALLOWED_OPERATORS = ['jio', 'airtel', 'vi', 'vodafone', 'yas'];

const getOperatorConfig = (name) => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('jio')) return OPERATOR_COLORS.jio;
  if (nameLower.includes('airtel')) return OPERATOR_COLORS.airtel;
  if (nameLower.includes('yas')) return OPERATOR_COLORS.yas;
  if (nameLower.includes('vi') || nameLower.includes('vodafone')) return OPERATOR_COLORS.vi;
  return { primary: '#607D8B', light: '#ECEFF1', dark: '#455A64' };
};

const OperatorRankingChart = () => {
  const [chartType, setChartType] = useState('coverage');
  const [hoveredOperator, setHoveredOperator] = useState(null);

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
          percentage: total > 0 ? parseFloat(((item.value / total) * 100).toFixed(1)) : 0,
          color: config.primary,
          lightColor: config.light,
          darkColor: config.dark,
          rank: index + 1,
        };
      });
  }, [currentData]);

  const stats = useMemo(() => {
    if (chartData.length === 0) return { total: 0, average: 0 };
    const total = chartData.reduce((sum, item) => sum + item.value, 0);
    const average = total / chartData.length;
    return { total, average };
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
      {chartType === 'coverage' ? (
        <Fade in>
          <Box>
            <Typography variant="subtitle2" fontWeight="700" gutterBottom color="primary">
              RSRP Range (dBm)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Min"
                  value={coverageDraft.rsrpMin}
                  onChange={(e) => setCoverageDraft((s) => ({ ...s, rsrpMin: e.target.value }))}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max"
                  value={coverageDraft.rsrpMax}
                  onChange={(e) => setCoverageDraft((s) => ({ ...s, rsrpMax: e.target.value }))}
                  size="small"
                />
              </Grid>
            </Grid>
          </Box>
        </Fade>
      ) : (
        <Fade in>
          <Box>
            <Typography variant="subtitle2" fontWeight="700" gutterBottom sx={{ color: '#f57c00' }}>
              RSRQ Range (dB)
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Min"
                  value={qualityDraft.rsrqMin}
                  onChange={(e) => setQualityDraft((s) => ({ ...s, rsrqMin: e.target.value }))}
                  size="small"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Max"
                  value={qualityDraft.rsrqMax}
                  onChange={(e) => setQualityDraft((s) => ({ ...s, rsrqMax: e.target.value }))}
                  size="small"
                />
              </Grid>
            </Grid>
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
          fontSize: '11px',
          py: 0.4,
          px: 1.2,
          textTransform: 'none',
          fontWeight: 600,
          border: '1px solid #ddd',
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
            background: 'linear-gradient(135deg, #1565c0, #42a5f5)',
          },
        }}
      >
        <SignalCellular4Bar sx={{ fontSize: 14, mr: 0.5 }} />
        Coverage
      </ToggleButton>
      <ToggleButton
        value="quality"
        sx={{
          '&.Mui-selected': {
            background: 'linear-gradient(135deg, #ef6c00, #ffb74d)',
          },
        }}
      >
        <SignalCellularAlt sx={{ fontSize: 14, mr: 0.5 }} />
        Quality
      </ToggleButton>
    </ToggleButtonGroup>
  );

  // Multi-Ring Gauge Component
  const MultiRingGauge = () => {
    const size = 280;
    const centerX = size / 2;
    const centerY = size / 2;
    const ringWidth = 16;
    const gap = 4;
    const startAngle = -135;
    const endAngle = 135;
    const totalAngle = endAngle - startAngle;

    const getArcPath = (radius, percentage) => {
      const angle = (percentage / 100) * totalAngle;
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = ((startAngle + angle) * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      const largeArc = angle > 180 ? 1 : 0;

      return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
    };

    const getBackgroundArcPath = (radius) => {
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;

      const x1 = centerX + radius * Math.cos(startRad);
      const y1 = centerY + radius * Math.sin(startRad);
      const x2 = centerX + radius * Math.cos(endRad);
      const y2 = centerY + radius * Math.sin(endRad);

      return `M ${x1} ${y1} A ${radius} ${radius} 0 1 1 ${x2} ${y2}`;
    };

    return (
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size}>
          {chartData.map((item, index) => {
            const radius = (size / 2) - 20 - index * (ringWidth + gap);
            const isHovered = hoveredOperator === item.id;

            return (
              <g
                key={item.id}
                onMouseEnter={() => setHoveredOperator(item.id)}
                onMouseLeave={() => setHoveredOperator(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Background Arc */}
                <path
                  d={getBackgroundArcPath(radius)}
                  fill="none"
                  stroke={alpha(item.color, 0.15)}
                  strokeWidth={ringWidth}
                  strokeLinecap="round"
                />
                {/* Value Arc */}
                <path
                  d={getArcPath(radius, item.percentage)}
                  fill="none"
                  stroke={item.color}
                  strokeWidth={isHovered ? ringWidth + 4 : ringWidth}
                  strokeLinecap="round"
                  style={{
                    filter: isHovered ? `drop-shadow(0 0 8px ${item.color})` : 'none',
                    transition: 'all 0.3s ease',
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Center Content */}
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
          {hoveredOperator !== null ? (
            // Show hovered operator info
            <Fade in>
              <Box>
                <Typography
                  variant="h5"
                  fontWeight="900"
                  sx={{ color: chartData[hoveredOperator]?.color, lineHeight: 1 }}
                >
                  {chartData[hoveredOperator]?.percentage}%
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight="700"
                  sx={{ color: chartData[hoveredOperator]?.darkColor, fontSize: '11px' }}
                >
                  {chartData[hoveredOperator]?.label}
                </Typography>
                <Typography variant="caption" display="block" sx={{ color: '#888', fontSize: '10px' }}>
                  {formatNumber(chartData[hoveredOperator]?.value)}
                </Typography>
              </Box>
            </Fade>
          ) : (
            // Show total info
            <Box>
              <Typography
                variant="h5"
                fontWeight="900"
                sx={{
                  background: chartType === 'coverage'
                    ? 'linear-gradient(135deg, #1565c0, #42a5f5)'
                    : 'linear-gradient(135deg, #ef6c00, #ffb74d)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1,
                }}
              >
                {formatNumber(stats.total)}
              </Typography>
              <Typography variant="caption" sx={{ color: '#666', fontSize: '10px' }}>
                Total Samples
              </Typography>
              <Typography variant="caption" display="block" sx={{ color: '#999', fontSize: '9px' }}>
                {chartData.length} Operators
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    );
  };

  // Compact Legend
  const CompactLegend = () => (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.5,
        justifyContent: 'center',
      }}
    >
      {chartData.map((item) => (
        <Chip
          key={item.id}
          size="small"
          icon={<Circle sx={{ fontSize: '8px !important', color: `${item.color} !important` }} />}
          label={`${item.label}: ${item.percentage}%`}
          onMouseEnter={() => setHoveredOperator(item.id)}
          onMouseLeave={() => setHoveredOperator(null)}
          sx={{
            height: 22,
            fontSize: '10px',
            fontWeight: 600,
            backgroundColor: hoveredOperator === item.id ? alpha(item.color, 0.15) : '#f5f5f5',
            border: '1px solid',
            borderColor: hoveredOperator === item.id ? item.color : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            '& .MuiChip-icon': { ml: 0.5 },
            '& .MuiChip-label': { px: 0.75 },
          }}
        />
      ))}
    </Box>
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
        title: `${chartType === 'coverage' ? 'RSRP' : 'RSRQ'} Settings`,
        render: renderSettings,
        onApply: chartType === 'coverage' ? applyCoverageSettings : applyQualitySettings,
      }}
    >
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          boxSizing: 'border-box',
          overflow: 'hidden',
          gap: 2,
        }}
      >
        {/* Multi-Ring Gauge */}
        <MultiRingGauge />

        {/* Compact Legend */}
        <CompactLegend />
      </Box>
    </ChartCard>
  );
};

export default OperatorRankingChart;