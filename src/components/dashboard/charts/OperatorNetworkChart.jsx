import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Settings, Download, Filter, Activity, TrendingUp, Radio } from 'lucide-react';
import { TOOLTIP_STYLE, NETWORK_COLORS, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useOperatorMetrics, useOperatorsAndNetworks } from '@/hooks/useDashboardData.js';
import { formatNumber } from '@/utils/chartUtils';
import Spinner from '@/components/common/Spinner';

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
    format: (val) => `${val.toFixed(1)} dBm`,
    icon: Activity,
    reversed: true
  },
  rsrq: { 
    label: 'RSRQ (Signal Quality)', 
    unit: 'dB',
    yAxisLabel: 'RSRQ (dB)',
    format: (val) => `${val.toFixed(1)} dB`,
    icon: Activity,
    reversed: true
  },
  sinr: { 
    label: 'SINR (Signal to Noise)', 
    unit: 'dB',
    yAxisLabel: 'SINR (dB)',
    format: (val) => `${val.toFixed(1)} dB`,
    icon: Activity,
    reversed: false
  },
  mos: { 
    label: 'MOS (Mean Opinion Score)', 
    unit: '',
    yAxisLabel: 'MOS Score',
    format: (val) => val.toFixed(2),
    icon: Activity,
    reversed: false
  },
  jitter: { 
    label: 'Jitter', 
    unit: 'ms',
    yAxisLabel: 'Jitter (ms)',
    format: (val) => `${val.toFixed(1)} ms`,
    icon: Activity,
    reversed: false
  },
  latency: { 
    label: 'Latency', 
    unit: 'ms',
    yAxisLabel: 'Latency (ms)',
    format: (val) => `${val.toFixed(1)} ms`,
    icon: Activity,
    reversed: false
  },
  packetLoss: { 
    label: 'Packet Loss', 
    unit: '%',
    yAxisLabel: 'Packet Loss (%)',
    format: (val) => `${val.toFixed(2)}%`,
    icon: Activity,
    reversed: false
  },
  dlTpt: { 
    label: 'Download Throughput', 
    unit: 'Mbps',
    yAxisLabel: 'Download Throughput (Mbps)',
    format: (val) => `${val.toFixed(2)} Mbps`,
    icon: TrendingUp,
    reversed: false
  },
  ulTpt: { 
    label: 'Upload Throughput', 
    unit: 'Mbps',
    yAxisLabel: 'Upload Throughput (Mbps)',
    format: (val) => `${val.toFixed(2)} Mbps`,
    icon: TrendingUp,
    reversed: false
  }
};

const OperatorNetworkChart = () => {
  // Fetch operators and networks from API
  const { operators: apiOperators, networks: apiNetworks, isLoading: metaLoading } = useOperatorsAndNetworks();

  const [selectedMetric, setSelectedMetric] = useState('samples');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [selectedTechnologies, setSelectedTechnologies] = useState([]);

  // Fetch ALL data (no filters sent to backend)
  const { data: allData, isLoading } = useOperatorMetrics(selectedMetric, {});

  // Filter out EDGE(2G) from technologies - FIXED with Array.isArray check
  const availableTechnologies = useMemo(() => {
    if (!apiNetworks || !Array.isArray(apiNetworks)) {
      console.warn('apiNetworks is not an array:', apiNetworks);
      return [];
    }
    return apiNetworks.filter(tech => 
      tech && 
      !tech.toLowerCase().includes('edge') && 
      tech.toLowerCase() !== 'edge(2g)'
    );
  }, [apiNetworks]);

  // Also add safety check for operators
  const availableOperators = useMemo(() => {
    if (!apiOperators || !Array.isArray(apiOperators)) {
      console.warn('apiOperators is not an array:', apiOperators);
      return [];
    }
    return apiOperators;
  }, [apiOperators]);

  // Client-side filtering
  const filteredData = useMemo(() => {
    if (!allData || allData.length === 0) return [];

    let filtered = [...allData];

    // Filter by selected operators
    if (selectedOperators.length > 0) {
      filtered = filtered.filter(item => 
        selectedOperators.includes(item.name)
      );
    }

    // Filter by selected technologies
    if (selectedTechnologies.length > 0) {
      filtered = filtered.map(item => {
        const newItem = { name: item.name };
        selectedTechnologies.forEach(tech => {
          if (item[tech] !== undefined) {
            newItem[tech] = item[tech];
          }
        });
        
        // Recalculate total
        const techs = Object.keys(newItem).filter(k => k !== 'name');
        const total = techs.length > 0 
          ? techs.reduce((sum, tech) => sum + (newItem[tech] || 0), 0) / techs.length
          : 0;
        newItem.total = total;
        
        return newItem;
      }).filter(item => Object.keys(item).length > 2); // Has at least name + 1 technology
    }

    return filtered;
  }, [allData, selectedOperators, selectedTechnologies]);

  // Extract technology types from filtered data
  const technologyTypes = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    const types = new Set();
    filteredData.forEach(op => {
      Object.keys(op).forEach(key => {
        if (key !== 'name' && key !== 'total' && !key.toLowerCase().includes('edge')) {
          types.add(key);
        }
      });
    });
    return Array.from(types).sort((a, b) => {
      const order = { '5G': 1, '4G': 2, '3G': 3, '2G': 4 };
      return (order[a] || 99) - (order[b] || 99);
    });
  }, [filteredData]);

  // Auto-close settings when any filter is selected
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

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedOperators([]);
    setSelectedTechnologies([]);
    setSelectedMetric('samples');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedOperators.length > 0 || 
                          selectedTechnologies.length > 0 || 
                          selectedMetric !== 'samples';

  // Export functionality
  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;

    const metricConfig = METRICS[selectedMetric];
    const headers = ['Operator', ...technologyTypes, `Average ${metricConfig.label}`];
    const rows = filteredData.map(item => [
      item.name,
      ...technologyTypes.map(tech => item[tech] || 0),
      item.total || 0
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

  // Custom Y-axis tick formatter
  const formatYAxis = (value) => {
    if (selectedMetric === 'samples') {
      return formatNumber(value);
    }
    return value.toFixed(1);
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;

    const metricConfig = METRICS[selectedMetric];

    return (
      <div style={TOOLTIP_STYLE}>
        <p className="font-semibold text-gray-900 mb-2 border-b pb-1">{label}</p>
        <div className="space-y-1">
          {payload
            .filter(p => p.value !== 0)
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
            .map((entry, index) => (
              <div key={index} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-xs text-gray-700 font-medium">{entry.name}:</span>
                </div>
                <span className="text-xs font-bold text-gray-900">
                  {metricConfig.format(entry.value)}
                </span>
              </div>
            ))}
        </div>
        <div className="border-t border-gray-200 mt-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 font-medium">
              {selectedMetric === 'samples' ? 'Total:' : 'Average:'}
            </span>
            <span className="text-sm font-bold text-blue-600">
              {metricConfig.format(
                selectedMetric === 'samples'
                  ? payload.reduce((sum, p) => sum + (p.value || 0), 0)
                  : payload.reduce((sum, p) => sum + (p.value || 0), 0) / payload.filter(p => p.value).length
              )}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const currentMetric = METRICS[selectedMetric];
  const isReversedAxis = currentMetric.reversed;

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
            <TrendingUp className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Operator Distribution
            </h3>
            <p className="text-sm text-gray-500">
              {currentMetric.label}
              
            </p>
          </div>
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold rounded-full">
                {(selectedOperators.length > 0 ? 1 : 0) + 
                 (selectedTechnologies.length > 0 ? 1 : 0) + 
                 (selectedMetric !== 'samples' ? 1 : 0)} active filters
              </span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!filteredData || filteredData.length === 0}
            className="p-2.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-transparent hover:border-green-200"
            title="Export to CSV"
          >
            <Download size={18} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2.5 rounded-lg transition-all border ${
              showSettings 
                ? 'text-blue-600 bg-blue-50 border-blue-200 shadow-sm' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50 border-transparent hover:border-blue-200'
            }`}
            title="Filters & Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-5 bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50 rounded-xl border border-gray-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-300">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Filter size={16} className="text-blue-600" />
              Filters & Settings
            </h4>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-red-600 hover:text-red-700 font-semibold hover:underline flex items-center gap-1"
              >
                <span>Clear All</span>
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
                  onClick={() => {
                    setSelectedOperators([]);
                    setShowSettings(false);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                >
                  Select All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              {metaLoading ? (
                <div className="w-full flex items-center justify-center py-2">
                  <Spinner />
                </div>
              ) : availableOperators && availableOperators.length > 0 ? (
                availableOperators.map(operator => (
                  <button
                    key={operator}
                    onClick={() => toggleOperator(operator)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      selectedOperators.length === 0 || selectedOperators.includes(operator)
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
                  onClick={() => {
                    setSelectedTechnologies([]);
                    setShowSettings(false);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                >
                  Select All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3 bg-white rounded-lg border border-gray-200 shadow-sm">
              {metaLoading ? (
                <div className="w-full flex items-center justify-center py-2">
                  <Spinner />
                </div>
              ) : availableTechnologies && availableTechnologies.length > 0 ? (
                availableTechnologies.map(tech => (
                  <button
                    key={tech}
                    onClick={() => toggleTechnology(tech)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      selectedTechnologies.length === 0 || selectedTechnologies.includes(tech)
                        ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md hover:shadow-lg transform hover:-translate-y-0.5'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
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
            <div className="pt-3 border-t border-gray-300">
              <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <Filter size={12} />
                Active Filters:
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedMetric !== 'samples' && (
                  <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-lg font-semibold border border-indigo-200">
                    📊 {METRICS[selectedMetric].label}
                  </span>
                )}
                {selectedOperators.length > 0 && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-lg font-semibold border border-green-200">
                    🏢 {selectedOperators.length} operator(s)
                  </span>
                )}
                {selectedTechnologies.length > 0 && (
                  <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg font-semibold border border-purple-200">
                    📡 {selectedTechnologies.length} technology(s)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="h-96 flex items-center justify-center bg-gray-50 rounded-lg">
          <div className="text-center">
            <Spinner />
            <p className="text-sm text-gray-500 mt-3">Loading data...</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {!isLoading && filteredData && filteredData.length > 0 && (
        <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-4 border border-gray-100">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart
              data={filteredData}
              margin={{ top: 20, right: 30, left: 70, bottom: 70 }}
              barGap={6}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
              <XAxis
                dataKey="name"
                tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
                angle={-25}
                textAnchor="end"
                height={90}
                axisLine={{ stroke: '#e5e7eb' }}
              />
              <YAxis
                reversed={isReversedAxis}
                tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
                tickFormatter={formatYAxis}
                axisLine={{ stroke: '#e5e7eb' }}
                label={{ 
                  value: currentMetric.yAxisLabel + (isReversedAxis ? ' ↑' : ''), 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { fill: '#374151', fontSize: 13, fontWeight: 700 }
                }}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} />
              <Legend
                wrapperStyle={{ paddingTop: '15px' }}
                iconType="rect"
                iconSize={14}
                formatter={(value) => <span className="text-sm font-semibold text-gray-700">{value}</span>}
              />
              {technologyTypes.map((tech, idx) => (
                <Bar
                  key={tech}
                  dataKey={tech}
                  name={tech}
                  fill={NETWORK_COLORS[tech] || CHART_COLORS[idx % CHART_COLORS.length]}
                 
                  barSize={26}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && (!filteredData || filteredData.length === 0) && (
        <div className="h-96 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <Filter size={56} className="mb-4 opacity-20" />
          <p className="text-xl font-bold text-gray-700">No data available</p>
          <p className="text-sm mt-2 text-gray-500">Try adjusting your filters or clear them to see all data</p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="mt-5 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-lg transition-all transform hover:-translate-y-0.5 font-semibold"
            >
              Clear All Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default OperatorNetworkChart;