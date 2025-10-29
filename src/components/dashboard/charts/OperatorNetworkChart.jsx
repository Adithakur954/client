import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { Settings, Download, X, Filter, Calendar, Network, TrendingUp, Activity } from 'lucide-react';
import { TOOLTIP_STYLE, NETWORK_COLORS, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useOperatorMetrics, useOperatorsAndNetworks } from '@/hooks/useDashboardData';
import { formatNumber } from '@/utils/chartUtils';
import Spinner from '@/components/common/Spinner';

// Metric configuration
const METRICS = {
  samples: { 
    label: 'Sample Count', 
    unit: 'samples',
    yAxisLabel: 'Number of Samples',
    format: (val) => formatNumber(val)
  },
  rsrp: { 
    label: 'RSRP (Signal Strength)', 
    unit: 'dBm',
    yAxisLabel: 'RSRP (dBm)',
    format: (val) => `${val.toFixed(1)} dBm`
  },
  rsrq: { 
    label: 'RSRQ (Signal Quality)', 
    unit: 'dB',
    yAxisLabel: 'RSRQ (dB)',
    format: (val) => `${val.toFixed(1)} dB`
  },
  sinr: { 
    label: 'SINR (Signal to Noise)', 
    unit: 'dB',
    yAxisLabel: 'SINR (dB)',
    format: (val) => `${val.toFixed(1)} dB`
  },
  mos: { 
    label: 'MOS (Mean Opinion Score)', 
    unit: '',
    yAxisLabel: 'MOS Score',
    format: (val) => val.toFixed(2)
  },
  jitter: { 
    label: 'Jitter', 
    unit: 'ms',
    yAxisLabel: 'Jitter (ms)',
    format: (val) => `${val.toFixed(1)} ms`
  },
  latency: { 
    label: 'Latency', 
    unit: 'ms',
    yAxisLabel: 'Latency (ms)',
    format: (val) => `${val.toFixed(1)} ms`
  },
  packetLoss: { 
    label: 'Packet Loss', 
    unit: '%',
    yAxisLabel: 'Packet Loss (%)',
    format: (val) => `${val.toFixed(2)}%`
  },
  dlTpt: { 
    label: 'Download Throughput', 
    unit: 'Mbps',
    yAxisLabel: 'Download Throughput (Mbps)',
    format: (val) => `${val.toFixed(2)} Mbps`
  },
  ulTpt: { 
    label: 'Upload Throughput', 
    unit: 'Mbps',
    yAxisLabel: 'Upload Throughput (Mbps)',
    format: (val) => `${val.toFixed(2)} Mbps`
  }
};

const OperatorNetworkChart = () => {
  // Fetch operators and networks from API
  const { operators: apiOperators, networks: apiNetworks, isLoading: metaLoading } = useOperatorsAndNetworks();

  const [selectedMetric, setSelectedMetric] = useState('samples');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [selectedNetworks, setSelectedNetworks] = useState([]);
  const [dateRange, setDateRange] = useState({ from: null, to: null });

  // Fetch ALL data (no filters sent to backend)
  const { data: allData, isLoading } = useOperatorMetrics(selectedMetric, {});

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

    // Filter by selected networks
    if (selectedNetworks.length > 0) {
      filtered = filtered.map(item => {
        const newItem = { name: item.name };
        selectedNetworks.forEach(network => {
          if (item[network] !== undefined) {
            newItem[network] = item[network];
          }
        });
        
        // Recalculate total
        const networks = Object.keys(newItem).filter(k => k !== 'name');
        const total = networks.length > 0 
          ? networks.reduce((sum, net) => sum + (newItem[net] || 0), 0) / networks.length
          : 0;
        newItem.total = total;
        
        return newItem;
      }).filter(item => Object.keys(item).length > 2); // Has at least name + 1 network
    }

    return filtered;
  }, [allData, selectedOperators, selectedNetworks]);

  // Extract network types from filtered data
  const networkTypes = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return [];
    const types = new Set();
    filteredData.forEach(op => {
      Object.keys(op).forEach(key => {
        if (key !== 'name' && key !== 'total') {
          types.add(key);
        }
      });
    });
    return Array.from(types).sort((a, b) => {
      const order = { '5G': 1, '4G': 2, '3G': 3, '2G': 4 };
      return (order[a] || 99) - (order[b] || 99);
    });
  }, [filteredData]);

  // Toggle operator selection
  const toggleOperator = (operator) => {
    setSelectedOperators(prev => 
      prev.includes(operator)
        ? prev.filter(op => op !== operator)
        : [...prev, operator]
    );
  };

  // Toggle network selection
  const toggleNetwork = (network) => {
    setSelectedNetworks(prev => 
      prev.includes(network)
        ? prev.filter(n => n !== network)
        : [...prev, network]
    );
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedOperators([]);
    setSelectedNetworks([]);
    setDateRange({ from: null, to: null });
    setSelectedMetric('samples');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedOperators.length > 0 || 
                          selectedNetworks.length > 0 || 
                          dateRange.from || 
                          dateRange.to ||
                          selectedMetric !== 'samples';

  // Export functionality
  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;

    const metricConfig = METRICS[selectedMetric];
    const headers = ['Operator', ...networkTypes, `Average ${metricConfig.label}`];
    const rows = filteredData.map(item => [
      item.name,
      ...networkTypes.map(net => item[net] || 0),
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

  // Custom label renderer
  const renderCustomLabel = (props) => {
    const { x, y, width, value } = props;
    if (!value || value === 0) return null;

    const displayValue = selectedMetric === 'samples' 
      ? formatNumber(value)
      : value.toFixed(1);

    return (
      <text
        x={x + width / 2}
        y={y - 5}
        fill="#374151"
        fontSize={10}
        fontWeight={600}
        textAnchor="middle"
      >
        {displayValue}
      </text>
    );
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
        <p className="font-semibold text-gray-900 mb-2">{label}</p>
        {payload
          .filter(p => p.value !== 0)
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-4 py-1">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-700">{entry.name}:</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {metricConfig.format(entry.value)}
              </span>
            </div>
          ))}
        <div className="border-t border-gray-200 mt-2 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600">
              {selectedMetric === 'samples' ? 'Total:' : 'Average:'}
            </span>
            <span className="text-sm font-bold text-gray-900">
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

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900">
            Operator Wise Distribution - {currentMetric.label}
          </h3>
          {hasActiveFilters && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {selectedOperators.length + selectedNetworks.length + (dateRange.from ? 1 : 0) + (dateRange.to ? 1 : 0) + (selectedMetric !== 'samples' ? 1 : 0)} filters
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!filteredData || filteredData.length === 0}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export Data"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title="Settings & Filters"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-300">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Filter size={16} />
              Filters & Settings
            </h4>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
              >
                Clear All Filters
              </button>
            )}
          </div>

          {/* Metric Selection */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Activity size={14} />
              Select Metric
            </label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white font-medium"
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
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <TrendingUp size={14} />
                Operators {selectedOperators.length > 0 && (
                  <span className="text-blue-600">({selectedOperators.length} selected)</span>
                )}
              </label>
              {selectedOperators.length > 0 && (
                <button
                  onClick={() => setSelectedOperators([])}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  Select All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 bg-white rounded-lg border border-gray-200">
              {metaLoading ? (
                <span className="text-sm text-gray-500">Loading...</span>
              ) : apiOperators && apiOperators.length > 0 ? (
                apiOperators.map(operator => (
                  <button
                    key={operator}
                    onClick={() => toggleOperator(operator)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      selectedOperators.length === 0 || selectedOperators.includes(operator)
                        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                    }`}
                  >
                    {operator}
                  </button>
                ))
              ) : (
                <span className="text-sm text-gray-500">No operators available</span>
              )}
            </div>
          </div>

          {/* Network Type Filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Network size={14} />
                Network Types {selectedNetworks.length > 0 && (
                  <span className="text-blue-600">({selectedNetworks.length} selected)</span>
                )}
              </label>
              {selectedNetworks.length > 0 && (
                <button
                  onClick={() => setSelectedNetworks([])}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  Select All
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-2 bg-white rounded-lg border border-gray-200">
              {metaLoading ? (
                <span className="text-sm text-gray-500">Loading...</span>
              ) : apiNetworks && apiNetworks.length > 0 ? (
                apiNetworks.map(network => (
                  <button
                    key={network}
                    onClick={() => toggleNetwork(network)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      selectedNetworks.length === 0 || selectedNetworks.includes(network)
                        ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                    }`}
                  >
                    {network}
                  </button>
                ))
              ) : (
                <span className="text-sm text-gray-500">No networks available</span>
              )}
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-gray-300">
              <p className="text-xs font-semibold text-gray-600 mb-2">Active Filters:</p>
              <div className="flex flex-wrap gap-2">
                {selectedMetric !== 'samples' && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md font-medium">
                    Metric: {METRICS[selectedMetric].label}
                  </span>
                )}
                {selectedOperators.length > 0 && (
                  <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-md font-medium">
                    {selectedOperators.length} operator(s)
                  </span>
                )}
                {selectedNetworks.length > 0 && (
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-md font-medium">
                    {selectedNetworks.length} network(s)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="h-96 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      {/* Chart */}
      {!isLoading && filteredData && filteredData.length > 0 && (
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            data={filteredData}
            margin={{ top: 30, right: 24, left: 60, bottom: 60 }}
            barGap={4}
            barCategoryGap="20%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.08)" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
              angle={-20}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
              tickFormatter={formatYAxis}
              label={{ 
                value: currentMetric.yAxisLabel, 
                angle: -90, 
                position: 'insideLeft',
                style: { fill: '#374151', fontSize: 12, fontWeight: 600 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              iconType="rect"
              iconSize={12}
              formatter={(value) => <span className="text-sm font-medium">{value}</span>}
            />
            {networkTypes.map((network, idx) => (
              <Bar
                key={network}
                dataKey={network}
                name={network}
                fill={NETWORK_COLORS[network] || CHART_COLORS[idx % CHART_COLORS.length]}
                radius={[4, 4, 0, 0]}
                barSize={24}
              >
                <LabelList dataKey={network} content={renderCustomLabel} />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Empty State */}
      {!isLoading && (!filteredData || filteredData.length === 0) && (
        <div className="h-96 flex flex-col items-center justify-center text-gray-500">
          <Filter size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No data available</p>
          <p className="text-sm mt-1">Try adjusting your filters</p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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