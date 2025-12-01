import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts';
import { Settings, Download, TrendingUp, Network, Activity } from 'lucide-react';
import { TOOLTIP_STYLE, METRICS } from '@/components/constants/dashboardConstants';
import { useOperatorMetrics, useOperatorsAndNetworks } from '@/hooks/useDashboardData.js';
import { getMetricColorFunction } from '@/utils/chartUtils';
import Spinner from '@/components/common/Spinner';

const MetricChart = () => {
  const [selectedMetric, setSelectedMetric] = useState('rsrp');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [selectedNetworks, setSelectedNetworks] = useState([]);

  // Fetch operators and networks
  const { operators: apiOperators, networks: apiNetworks, isLoading: metaLoading } = useOperatorsAndNetworks();

  // Fetch ALL data for selected metric
  const { data: allData, isLoading } = useOperatorMetrics(selectedMetric, {});

  // Get metric configuration
  const metricConfig = useMemo(() => {
    return METRICS.find(m => m.value === selectedMetric) || METRICS[0];
  }, [selectedMetric]);

  // Client-side filtering and aggregation
  const filteredData = useMemo(() => {
    if (!allData || allData.length === 0) return [];

    let filtered = [...allData];

    // Filter by operators
    if (selectedOperators.length > 0) {
      filtered = filtered.filter(item => selectedOperators.includes(item.name));
    }

    // Filter/aggregate by networks
    if (selectedNetworks.length > 0) {
      filtered = filtered.map(item => {
        const networkValues = selectedNetworks
          .filter(net => item[net] !== undefined)
          .map(net => item[net]);

        if (networkValues.length === 0) return null;

        // Calculate average across selected networks
        const avgValue = networkValues.reduce((sum, val) => sum + val, 0) / networkValues.length;

        return {
          name: item.name,
          value: avgValue
        };
      }).filter(Boolean);
    } else {
      // Use total (average of all networks)
      filtered = filtered.map(item => ({
        name: item.name,
        value: item.total || 0
      }));
    }

    return filtered;
  }, [allData, selectedOperators, selectedNetworks]);

  // Color function
  const colorFunction = useMemo(() => {
    return getMetricColorFunction(selectedMetric);
  }, [selectedMetric]);

  // Toggle selections
  const toggleOperator = (operator) => {
    setSelectedOperators(prev =>
      prev.includes(operator)
        ? prev.filter(op => op !== operator)
        : [...prev, operator]
    );
  };

  const toggleNetwork = (network) => {
    setSelectedNetworks(prev =>
      prev.includes(network)
        ? prev.filter(n => n !== network)
        : [...prev, network]
    );
  };

  // Clear filters
  const clearAllFilters = () => {
    setSelectedOperators([]);
    setSelectedNetworks([]);
    setSelectedMetric('rsrp');
  };

  const hasActiveFilters = selectedOperators.length > 0 || 
                          selectedNetworks.length > 0 || 
                          selectedMetric !== 'rsrp';

  // Export functionality
  const handleExport = () => {
    if (!filteredData || filteredData.length === 0) return;

    const headers = ['Operator', metricConfig.label];
    const rows = filteredData.map(item => [item.name, item.value]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `avg_${selectedMetric}_per_operator_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900">
            {metricConfig.label} by Operator
          </h3>
          {hasActiveFilters && (
            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
              {selectedOperators.length + selectedNetworks.length + (selectedMetric !== 'rsrp' ? 1 : 0)} filters
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={!filteredData || filteredData.length === 0}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
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
            title="Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-6 p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-300">
            <h4 className="text-sm font-bold text-gray-900">Settings</h4>
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-red-600 hover:text-red-700 font-medium hover:underline"
              >
                Clear All
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
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white font-medium"
            >
              {METRICS.map((metric) => (
                <option key={metric.value} value={metric.value}>
                  {metric.label}
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

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="pt-3 border-t border-gray-300">
              <p className="text-xs font-semibold text-gray-600 mb-2">Active Filters:</p>
              <div className="flex flex-wrap gap-2">
                {selectedMetric !== 'rsrp' && (
                  <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-md font-medium">
                    {metricConfig.label}
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
            layout="vertical"
            margin={{ top: 12, right: 70, left: 10, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.08)" />
            <XAxis
              type="number"
              domain={metricConfig.domain}
              tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
            />
            <YAxis
              dataKey="name"
              type="category"
              width={140}
              tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v) => [
                `${Number(v).toFixed(2)} ${metricConfig.unit}`,
                metricConfig.label
              ]}
            />
            <Bar dataKey="value" name={metricConfig.label} radius={[0, 8, 8, 0]}>
              <LabelList
                dataKey="value"
                content={({ x = 0, y = 0, width = 0, height = 0, value }) => {
                  const midY = y + height / 2;
                  const barEndX = width >= 0 ? x + width : x;
                  const dx = width >= 0 ? 10 : -10;
                  const anchor = width >= 0 ? 'start' : 'end';
                  const val = Number.isFinite(Number(value)) ? Number(value).toFixed(1) : value;
                  return (
                    <text
                      x={barEndX + dx}
                      y={midY}
                      fill="#111827"
                      dominantBaseline="middle"
                      textAnchor={anchor}
                      fontSize={12}
                      fontWeight={700}
                    >
                      {`${val} ${metricConfig.unit}`}
                    </text>
                  );
                }}
              />
              {filteredData?.map((entry, index) => (
                <Cell
                  key={`cell-metric-${index}`}
                  fill={colorFunction(entry.value)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Empty State */}
      {!isLoading && (!filteredData || filteredData.length === 0) && (
        <div className="h-96 flex flex-col items-center justify-center text-gray-500">
          <Activity size={48} className="mb-4 opacity-20" />
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

export default MetricChart;