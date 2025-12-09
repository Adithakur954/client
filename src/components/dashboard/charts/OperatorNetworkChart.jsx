import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell } from 'recharts';
import { Settings, Download, Filter, Activity, TrendingUp, Radio, X, BarChart3 } from 'lucide-react';
import { NETWORK_COLORS, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useOperatorMetrics, useOperatorsAndNetworks } from '@/hooks/useDashboardData.js';
import { formatNumber } from '@/utils/chartUtils';
import Spinner from '@/components/common/Spinner';

// Enhanced color palette for technologies
const TECH_COLORS = {
  '5G': '#8B5CF6',
  '5G-SA': '#7C3AED',
  '5G-NSA': '#A78BFA',
  '4G': '#3B82F6',
  '4G+': '#2563EB',
  'LTE': '#6366F1',
  'LTE-A': '#4F46E5',
  '3G': '#10B981',
  'HSPA': '#059669',
  'HSPA+': '#34D399',
  '2G': '#F59E0B',
  'GSM': '#D97706',
  'NR': '#EC4899',
  'WCDMA': '#14B8A6',
};

// Fallback colors
const FALLBACK_COLORS = [
  '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1'
];

// Get color for technology
const getTechColor = (tech, index) => {
  if (TECH_COLORS[tech]) return TECH_COLORS[tech];
  if (NETWORK_COLORS && NETWORK_COLORS[tech]) return NETWORK_COLORS[tech];
  if (CHART_COLORS && CHART_COLORS[index]) return CHART_COLORS[index];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
};

// Helper function to check if a value is invalid/unknown
const isInvalidValue = (value) => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'number' && (value === 0 || isNaN(value))) return true;
  
  const strValue = String(value).toLowerCase().trim();
  return (
    strValue === '' ||
    strValue === 'unknown' ||
    strValue === 'null' ||
    strValue === 'undefined' ||
    strValue === 'n/a' ||
    strValue === 'na' ||
    strValue === '-' ||
    strValue === '000 000' ||
    strValue === '000000' ||
    strValue === '0 0 0' ||
    strValue === '000' ||
    strValue === '00' ||
    strValue === '0' ||
    /^0+[\s]*0*$/.test(strValue) ||
    /^[\s0\-]+$/.test(strValue) ||
    strValue.includes('unknown')
  );
};

// Helper function to validate names (operators/technologies)
const isValidName = (name) => {
  if (!name || typeof name !== 'string') return false;
  const cleanName = name.toLowerCase().trim();
  return (
    cleanName !== '' &&
    cleanName !== 'unknown' &&
    cleanName !== 'null' &&
    cleanName !== 'undefined' &&
    cleanName !== 'n/a' &&
    cleanName !== 'na' &&
    cleanName !== '-' &&
    cleanName !== '000 000' &&
    cleanName !== '000000' &&
    cleanName !== '0 0 0' &&
    !/^0+[\s]*0*$/.test(cleanName) &&
    !/^[\s0\-]+$/.test(cleanName) &&
    !cleanName.includes('unknown') &&
    cleanName.length > 1
  );
};

// Check if value is valid for display
const isValidDataValue = (value) => {
  return typeof value === 'number' && !isNaN(value) && value > 0;
};

// Metric configuration
const METRICS = {
  samples: { 
    label: 'Sample Count', 
    unit: 'samples',
    yAxisLabel: 'Number of Samples',
    format: (val) => formatNumber(val),
    icon: Activity,
    reversed: false
  },
  rsrp: { 
    label: 'RSRP (Signal Strength)', 
    unit: 'dBm',
    yAxisLabel: 'RSRP (dBm)',
    format: (val) => `${val?.toFixed(1) || 0} dBm`,
    icon: Activity,
    reversed: true
  },
  rsrq: { 
    label: 'RSRQ (Signal Quality)', 
    unit: 'dB',
    yAxisLabel: 'RSRQ (dB)',
    format: (val) => `${val?.toFixed(1) || 0} dB`,
    icon: Activity,
    reversed: true
  },
  sinr: { 
    label: 'SINR (Signal to Noise)', 
    unit: 'dB',
    yAxisLabel: 'SINR (dB)',
    format: (val) => `${val?.toFixed(1) || 0} dB`,
    icon: Activity,
    reversed: false
  },
  mos: { 
    label: 'MOS (Mean Opinion Score)', 
    unit: '',
    yAxisLabel: 'MOS Score',
    format: (val) => val?.toFixed(2) || '0',
    icon: Activity,
    reversed: false
  },
  jitter: { 
    label: 'Jitter', 
    unit: 'ms',
    yAxisLabel: 'Jitter (ms)',
    format: (val) => `${val?.toFixed(1) || 0} ms`,
    icon: Activity,
    reversed: false
  },
  latency: { 
    label: 'Latency', 
    unit: 'ms',
    yAxisLabel: 'Latency (ms)',
    format: (val) => `${val?.toFixed(1) || 0} ms`,
    icon: Activity,
    reversed: false
  },
  packetLoss: { 
    label: 'Packet Loss', 
    unit: '%',
    yAxisLabel: 'Packet Loss (%)',
    format: (val) => `${val?.toFixed(2) || 0}%`,
    icon: Activity,
    reversed: false
  },
  dlTpt: { 
    label: 'Download Throughput', 
    unit: 'Mbps',
    yAxisLabel: 'Download Throughput (Mbps)',
    format: (val) => `${val?.toFixed(2) || 0} Mbps`,
    icon: TrendingUp,
    reversed: false
  },
  ulTpt: { 
    label: 'Upload Throughput', 
    unit: 'Mbps',
    yAxisLabel: 'Upload Throughput (Mbps)',
    format: (val) => `${val?.toFixed(2) || 0} Mbps`,
    icon: TrendingUp,
    reversed: false
  }
};

const OperatorNetworkChart = () => {
  const { operators: apiOperators, networks: apiNetworks, isLoading: metaLoading } = useOperatorsAndNetworks();

  const [selectedMetric, setSelectedMetric] = useState('samples');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);

  const { data: allData, isLoading } = useOperatorMetrics(selectedMetric, {});

  // Filter out invalid technologies (EDGE, unknown, 000 000, etc.)
  const availableTechnologies = useMemo(() => {
    if (!apiNetworks || !Array.isArray(apiNetworks)) {
      return [];
    }
    return apiNetworks.filter(tech => 
      isValidName(tech) &&
      !tech.toLowerCase().includes('edge') && 
      tech.toLowerCase() !== 'edge(2g)'
    );
  }, [apiNetworks]);

  // Filter out invalid operators (unknown, 000 000, etc.)
  const availableOperators = useMemo(() => {
    if (!apiOperators || !Array.isArray(apiOperators)) {
      return [];
    }
    return apiOperators.filter(operator => isValidName(operator));
  }, [apiOperators]);

  // Client-side filtering with invalid data removal
  const filteredData = useMemo(() => {
    if (!allData || allData.length === 0) return [];

    // Step 1: Filter out invalid operator names
    let filtered = allData.filter(item => isValidName(item.name));

    // Step 2: Clean each data item - remove invalid technology keys and values
    filtered = filtered.map(item => {
      const cleanItem = { name: item.name };
      
      Object.keys(item).forEach(key => {
        if (key === 'name' || key === 'total') return;
        if (!isValidName(key)) return;
        if (key.toLowerCase().includes('edge')) return;
        
        const value = item[key];
        // Only include valid numeric values > 0
        if (isValidDataValue(value)) {
          cleanItem[key] = value;
        }
      });
      
      return cleanItem;
    });

    // Step 3: Filter by selected operators
    if (selectedOperators.length > 0) {
      filtered = filtered.filter(item => selectedOperators.includes(item.name));
    }

    // Step 4: Filter by selected technologies
    if (selectedTechnologies.length > 0) {
      filtered = filtered.map(item => {
        const newItem = { name: item.name };
        selectedTechnologies.forEach(tech => {
          if (isValidDataValue(item[tech])) {
            newItem[tech] = item[tech];
          }
        });
        return newItem;
      }).filter(item => Object.keys(item).length > 1);
    }

    // Step 5: Calculate totals and filter out empty items
    filtered = filtered.map(item => {
      const techs = Object.keys(item).filter(k => k !== 'name' && k !== 'total');
      const validValues = techs.filter(tech => isValidDataValue(item[tech]));
      const total = validValues.length > 0 
        ? validValues.reduce((sum, tech) => sum + item[tech], 0) / validValues.length
        : 0;
      return { ...item, total };
    }).filter(item => {
      const techs = Object.keys(item).filter(k => k !== 'name' && k !== 'total');
      return techs.some(tech => isValidDataValue(item[tech]));
    });

    return filtered;
  }, [allData, selectedOperators, selectedTechnologies]);

 const technologyTypes = useMemo(() => {
  if (!filteredData?.length) return [];

  const techs = new Set();
  filteredData.forEach(item => {
    Object.entries(item).forEach(([key, value]) => {
      if (key !== "name" && value > 0) techs.add(key);   
    });
  });
  return [...techs];
}, [filteredData]);


  const handleMetricChange = (value) => {
    setSelectedMetric(value);
    setShowSettings(false);
  };

  const toggleOperator = (operator) => {
    setSelectedOperators(prev => 
      prev.includes(operator)
        ? prev.filter(op => op !== operator)
        : [...prev, operator]
    );
    setShowSettings(false);
  };

  const toggleTechnology = (tech) => {
    setSelectedTechnologies(prev => 
      prev.includes(tech)
        ? prev.filter(t => t !== tech)
        : [...prev, tech]
    );
    setShowSettings(false);
  };

  const clearAllFilters = () => {
    setSelectedOperators([]);
    setSelectedTechnologies([]);
    setSelectedMetric('samples');
  };

  const hasActiveFilters = selectedOperators.length > 0 || 
                          selectedTechnologies.length > 0 || 
                          selectedMetric !== 'samples';

  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;

    const metricConfig = METRICS[selectedMetric];
    const headers = ['Operator', ...technologyTypes, `Average ${metricConfig.label}`];
    const rows = filteredData.map(item => [
      item.name,
      ...technologyTypes.map(tech => item[tech] || ''),
      item.total || ''
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `operator_${selectedMetric}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const formatYAxis = (value) => {
    if (selectedMetric === 'samples') {
      return formatNumber(value);
    }
    return value?.toFixed(1) || '0';
  };

  // Enhanced Custom Tooltip with high z-index
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const metricConfig = METRICS[selectedMetric];
    // Filter out entries with no valid data
    const validPayload = payload.filter(p => isValidDataValue(p.value));

    if (validPayload.length === 0) return null;

    return (
      <div 
        className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 min-w-[240px] pointer-events-none"
        style={{ 
          zIndex: 99999,
          position: 'relative',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}
      >
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
          <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 animate-pulse" />
          <p className="font-bold text-gray-900 text-base">{label}</p>
        </div>
        <div className="space-y-2">
          {validPayload
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
            .map((entry, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between gap-4 py-1.5 px-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded shadow-sm"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-sm text-gray-700 font-medium">{entry.name}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {metricConfig.format(entry.value)}
                </span>
              </div>
            ))}
        </div>
        <div className="border-t border-gray-100 mt-3 pt-3">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg px-3 py-2.5">
            <span className="text-sm text-gray-600 font-semibold">
              {selectedMetric === 'samples' ? '📊 Total:' : '📈 Average:'}
            </span>
            <span className="text-lg font-bold text-blue-600">
              {metricConfig.format(
                selectedMetric === 'samples'
                  ? validPayload.reduce((sum, p) => sum + (p.value || 0), 0)
                  : validPayload.reduce((sum, p) => sum + (p.value || 0), 0) / validPayload.length
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  // Custom Legend
  const CustomLegend = ({ payload }) => {
    if (!payload || payload.length === 0) return null;
    
    // Filter legend to only show technologies with data
    const validLegendItems = payload.filter(entry => {
      return filteredData.some(item => isValidDataValue(item[entry.value]));
    });

    if (validLegendItems.length === 0) return null;
    
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4 pt-4 border-t border-gray-100">
        {validLegendItems.map((entry, index) => (
          <div 
            key={index}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 hover:bg-gray-100 transition-all cursor-default"
          >
            <div 
              className="w-4 h-4 rounded shadow-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm font-semibold text-gray-700">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  // Custom Bar Shape - returns null if no valid data
  const CustomBar = (props) => {
    const { x, y, width, height, fill, value } = props;
    
    // Don't render bar if value is invalid
    if (!isValidDataValue(value) || height <= 0) {
      return null;
    }

    return (
      <g>
        <defs>
          <linearGradient id={`gradient-${fill?.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fill} stopOpacity={1} />
            <stop offset="100%" stopColor={fill} stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={`url(#gradient-${fill?.replace('#', '')})`}
          rx={4}
          ry={4}
        />
      </g>
    );
  };

  const currentMetric = METRICS[selectedMetric];
  const isReversedAxis = currentMetric.reversed;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Enhanced Header */}
      <div className="bg-gradient-to-r from-slate-50 via-blue-50/50 to-indigo-50/50 p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-200">
              <BarChart3 className="text-white" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">
                Operator Distribution
              </h3>
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {currentMetric.label}
                {filteredData.length > 0 && (
                  <span className="text-gray-400">• {filteredData.length} operators</span>
                )}
              </p>
            </div>
            {hasActiveFilters && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full">
                <Filter size={14} className="text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">
                  {(selectedOperators.length > 0 ? 1 : 0) + 
                   (selectedTechnologies.length > 0 ? 1 : 0) + 
                   (selectedMetric !== 'samples' ? 1 : 0)} active
                </span>
                <button 
                  onClick={clearAllFilters}
                  className="ml-1 p-0.5 hover:bg-blue-100 rounded-full transition-colors"
                >
                  <X size={12} className="text-blue-600" />
                </button>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={!filteredData || filteredData.length === 0}
              className="p-2.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-emerald-200 hover:shadow-md"
              title="Export to CSV"
            >
              <Download size={20} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2.5 rounded-xl transition-all border ${
                showSettings 
                  ? 'text-blue-600 bg-blue-50 border-blue-200 shadow-md' 
                  : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50 border-transparent hover:border-blue-200 hover:shadow-md'
              }`}
              title="Filters & Settings"
            >
              <Settings size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-5 bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 rounded-xl border border-gray-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Filter size={16} className="text-blue-600" />
                Filters & Settings
              </h4>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-all"
                >
                  <X size={12} />
                  Clear All
                </button>
              )}
            </div>

            {/* Metric Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2.5">
                <Activity size={14} className="text-blue-600" />
                Select Metric
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => handleMetricChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white font-medium shadow-sm hover:border-gray-400 transition-colors"
              >
                {Object.entries(METRICS).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator Filter */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <TrendingUp size={14} className="text-green-600" />
                  Operators 
                  {selectedOperators.length > 0 && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                      {selectedOperators.length}
                    </span>
                  )}
                </label>
                {selectedOperators.length > 0 && (
                  <button
                    onClick={() => setSelectedOperators([])}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                {metaLoading ? (
                  <div className="w-full flex items-center justify-center py-2">
                    <Spinner />
                  </div>
                ) : availableOperators.length > 0 ? (
                  availableOperators.map(operator => (
                    <button
                      key={operator}
                      onClick={() => toggleOperator(operator)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        selectedOperators.length === 0 || selectedOperators.includes(operator)
                          ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md hover:shadow-lg'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {operator}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-gray-500 w-full text-center py-2">No operators available</span>
                )}
              </div>
            </div>

            {/* Technology Filter */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <Radio size={14} className="text-purple-600" />
                  Technology 
                  {selectedTechnologies.length > 0 && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-bold rounded-full">
                      {selectedTechnologies.length}
                    </span>
                  )}
                </label>
                {selectedTechnologies.length > 0 && (
                  <button
                    onClick={() => setSelectedTechnologies([])}
                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
                {metaLoading ? (
                  <div className="w-full flex items-center justify-center py-2">
                    <Spinner />
                  </div>
                ) : availableTechnologies.length > 0 ? (
                  availableTechnologies.map(tech => (
                    <button
                      key={tech}
                      onClick={() => toggleTechnology(tech)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                        selectedTechnologies.length === 0 || selectedTechnologies.includes(tech)
                          ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md hover:shadow-lg'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {tech}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-gray-500 w-full text-center py-2">No technologies available</span>
                )}
              </div>
            </div>

            {/* Active Filters Summary */}
            {hasActiveFilters && (
              <div className="pt-3 border-t border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                  Active Filters
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedMetric !== 'samples' && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-xs rounded-lg font-semibold border border-indigo-200">
                      <Activity size={12} />
                      {METRICS[selectedMetric].label}
                    </span>
                  )}
                  {selectedOperators.map(op => (
                    <span key={op} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 text-xs rounded-lg font-semibold border border-green-200">
                      {op}
                      <button onClick={() => toggleOperator(op)} className="hover:text-green-900">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  {selectedTechnologies.map(tech => (
                    <span key={tech} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-700 text-xs rounded-lg font-semibold border border-purple-200">
                      {tech}
                      <button onClick={() => toggleTechnology(tech)} className="hover:text-purple-900">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="h-[420px] flex items-center justify-center bg-gray-50 rounded-xl">
            <div className="text-center">
              <Spinner />
              <p className="text-sm text-gray-500 mt-3">Loading data...</p>
            </div>
          </div>
        )}

        {/* Chart */}
        {!isLoading && filteredData && filteredData.length > 0 && technologyTypes.length > 0 && (
          <div 
            className="bg-gradient-to-br from-gray-50/50 to-white rounded-xl p-4 border border-gray-100"
            style={{ position: 'relative', zIndex: 1 }}
          >
            <ResponsiveContainer width="100%" height={420}>
              <BarChart
                data={filteredData}
                margin={{ top: 20, right: 30, left: 60, bottom: 80 }}
                barGap={0}
                barCategoryGap="20%"
              >
                <CartesianGrid 
                  strokeDasharray="3 3" 
                  vertical={false} 
                  stroke="#e5e7eb" 
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#374151', fontSize: 12, fontWeight: 600 }}
                  angle={-30}
                  textAnchor="end"
                  height={90}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={{ stroke: '#d1d5db' }}
                />
                <YAxis
                  reversed={isReversedAxis}
                  tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                  tickFormatter={formatYAxis}
                  axisLine={{ stroke: '#d1d5db' }}
                  tickLine={{ stroke: '#d1d5db' }}
                  label={{ 
                    value: currentMetric.yAxisLabel + (isReversedAxis ? ' ↑' : ''), 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fill: '#374151', fontSize: 12, fontWeight: 600 },
                    offset: -5
                  }}
                />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                  wrapperStyle={{ zIndex: 99999, pointerEvents: 'none' }}
                  allowEscapeViewBox={{ x: true, y: true }}
                />
                <Legend content={<CustomLegend />} />
                {technologyTypes.map((tech, idx) => (
                  <Bar
                    key={tech}
                    dataKey={tech}
                    name={tech}
                    fill={getTechColor(tech, idx)}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={45}
                    // Hide bar segment if value is 0 or invalid
                    shape={(props) => {
                      const { value } = props;
                      if (!isValidDataValue(value)) return null;
                      return <CustomBar {...props} />;
                    }}
                  >
                    {/* Use Cell to conditionally hide bars */}
                    {filteredData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`}
                        fill={isValidDataValue(entry[tech]) ? getTechColor(tech, idx) : 'transparent'}
                        stroke="none"
                      />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!filteredData || filteredData.length === 0 || technologyTypes.length === 0) && (
          <div className="h-[420px] flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <div className="p-5 bg-gray-100 rounded-full mb-4">
              <Filter size={48} className="text-gray-400" />
            </div>
            <p className="text-xl font-bold text-gray-700">No data available</p>
            <p className="text-sm mt-2 text-gray-500">Try adjusting your filters or clear them to see all data</p>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="mt-5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all font-semibold flex items-center gap-2"
              >
                <X size={16} />
                Clear All Filters
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorNetworkChart;