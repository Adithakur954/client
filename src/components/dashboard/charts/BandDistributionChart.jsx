// src/components/charts/BandDistributionChart.jsx
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  LabelList 
} from 'recharts';
import { Check, ChevronDown, X } from 'lucide-react';
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { useBandDistributionRaw } from '@/hooks/useDashboardData.js';
import { canonicalOperatorName } from '@/utils/dashboardUtils';
import { formatNumber } from '@/utils/chartUtils';

// ============================================
// MULTI-SELECT DROPDOWN COMPONENT
// ============================================
const MultiSelectDropdown = ({ 
  label, 
  options, 
  selected, 
  onChange, 
  placeholder = "Select...",
  allLabel = "All"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isAllSelected = selected.length === 0 || selected.length === options.length;
  
  const handleToggle = (option) => {
    if (selected.includes(option)) {
      onChange(selected.filter(item => item !== option));
    } else {
      onChange([...selected, option]);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const getDisplayText = () => {
    if (selected.length === 0) return allLabel;
    if (selected.length === 1) return selected[0];
    if (selected.length === options.length) return allLabel;
    return `${selected.length} selected`;
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative" ref={dropdownRef}>
        {/* Dropdown Trigger */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 text-sm text-left border border-gray-300 rounded-md bg-white hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 flex items-center justify-between"
        >
          <span className={selected.length === 0 ? 'text-gray-500' : 'text-gray-900'}>
            {getDisplayText()}
          </span>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {/* Select All / Clear All */}
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 p-2 flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="flex-1 px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="flex-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              >
                Clear All
              </button>
            </div>

            {/* Options */}
            <div className="py-1">
              {options.map((option) => {
                const isSelected = selected.length === 0 || selected.includes(option);
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => handleToggle(option)}
                    className={`w-full px-3 py-2 text-sm text-left flex items-center justify-between hover:bg-gray-50 ${
                      selected.includes(option) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                    }`}
                  >
                    <span className="truncate">{option}</span>
                    {selected.includes(option) && (
                      <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Selected Tags */}
      {selected.length > 0 && selected.length <= 3 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map(item => (
            <span
              key={item}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full"
            >
              {item}
              <button
                type="button"
                onClick={() => onChange(selected.filter(s => s !== item))}
                className="hover:text-blue-900"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const BandDistributionChart = ({ filters: globalFilters }) => {
  // ============================================
  // SWR HOOK - SINGLE SOURCE OF TRUTH
  // ============================================
  const { 
    data: rawData, 
    isLoading, 
    error,
    mutate 
  } = useBandDistributionRaw(globalFilters);

  // ============================================
  // LOCAL FILTER STATES - NOW ARRAYS FOR MULTI-SELECT
  // ============================================
  const [selectedOperators, setSelectedOperators] = useState([]); // Empty = All
  const [selectedNetworks, setSelectedNetworks] = useState([]);   // Empty = All
  const [topN, setTopN] = useState(15);
  const [sortBy, setSortBy] = useState('count');

  // ============================================
  // NORMALIZE DATA FROM HOOK
  // ============================================
  const data = useMemo(() => {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];
    
    return rawData.map(item => ({
      operatorName: canonicalOperatorName(item?.operatorName || item?.operator),
      network: item?.network || 'Unknown',
      band: String(item?.band || ''),
      count: Number(item?.count || 0)
    }));
  }, [rawData]);

  // ============================================
  // DERIVED DATA - OPERATORS & NETWORKS
  // ============================================
  const { operators, networks } = useMemo(() => {
    if (!data || data.length === 0) return { operators: [], networks: [] };
    
    const ops = [...new Set(data.map(d => d.operatorName))].filter(Boolean).sort();
    const nets = [...new Set(data.map(d => d.network))].filter(Boolean).sort();
    
    return { operators: ops, networks: nets };
  }, [data]);

  // ============================================
  // CHART DATA PREPARATION - UPDATED FOR MULTI-SELECT
  // ============================================
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    // Apply multi-select filters
    let filtered = data.filter(item => {
      // Operator filter: if empty array, show all; otherwise check if included
      const operatorMatch = selectedOperators.length === 0 || 
                           selectedOperators.includes(item.operatorName);
      
      // Network filter: if empty array, show all; otherwise check if included
      const networkMatch = selectedNetworks.length === 0 || 
                          selectedNetworks.includes(item.network);
      
      return operatorMatch && networkMatch;
    });
    
    // Aggregate by band
    const aggregated = filtered.reduce((acc, item) => {
      const key = `Band ${item.band}`;
      if (!acc[key]) {
        acc[key] = {
          name: key,
          value: 0,
          details: []
        };
      }
      acc[key].value += item.count;
      acc[key].details.push(item);
      return acc;
    }, {});
    
    let result = Object.values(aggregated);
    
    // Sort
    if (sortBy === 'count') {
      result.sort((a, b) => b.value - a.value);
    } else {
      // Sort by band number
      result.sort((a, b) => {
        const bandA = parseInt(a.name.replace('Band ', '')) || 0;
        const bandB = parseInt(b.name.replace('Band ', '')) || 0;
        return bandA - bandB;
      });
    }
    
    return result.slice(0, topN);
  }, [data, selectedOperators, selectedNetworks, topN, sortBy]);

  // ============================================
  // STATS FOR INFO PANEL
  // ============================================
  const stats = useMemo(() => {
    const totalSamples = chartData.reduce((sum, item) => sum + item.value, 0);
    const totalBands = chartData.length;
    const avgSamplesPerBand = totalBands > 0 ? Math.round(totalSamples / totalBands) : 0;
    
    return { totalSamples, totalBands, avgSamplesPerBand };
  }, [chartData]);

  // ============================================
  // RESET FILTERS
  // ============================================
  const handleReset = () => {
    setSelectedOperators([]);
    setSelectedNetworks([]);
    setTopN(15);
    setSortBy('count');
  };

  // ============================================
  // SETTINGS RENDER
  // ============================================
  const settingsRender = () => (
    <div className="space-y-4">
      {/* Multi-Select Operator Filter */}
      <MultiSelectDropdown
        label="Operators"
        options={operators}
        selected={selectedOperators}
        onChange={setSelectedOperators}
        placeholder="Select operators..."
        allLabel="All Operators"
      />

      {/* Multi-Select Network Filter */}
      <MultiSelectDropdown
        label="Network Types"
        options={networks}
        selected={selectedNetworks}
        onChange={setSelectedNetworks}
        placeholder="Select networks..."
        allLabel="All Networks"
      />

      {/* Top N */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Show Top Bands
        </label>
        <select
          value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={15}>Top 15</option>
          <option value={20}>Top 20</option>
          <option value={25}>Top 25</option>
          <option value={50}>Top 50</option>
          <option value={100}>All</option>
        </select>
      </div>

      {/* Sort By */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Sort By
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="count">Sample Count (High to Low)</option>
          <option value="band">Band Number (Low to High)</option>
        </select>
      </div>

      {/* Stats Info */}
      <div className="pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Bands Showing:</span>
            <span className="font-semibold text-gray-900">{stats.totalBands}</span>
          </div>
          <div className="flex justify-between">
            <span>Total Samples:</span>
            <span className="font-semibold text-gray-900">{formatNumber(stats.totalSamples)}</span>
          </div>
          <div className="flex justify-between">
            <span>Avg per Band:</span>
            <span className="font-semibold text-gray-900">{formatNumber(stats.avgSamplesPerBand)}</span>
          </div>
          {selectedOperators.length > 0 && (
            <div className="flex justify-between">
              <span>Operators:</span>
              <span className="font-semibold text-blue-600">{selectedOperators.length} selected</span>
            </div>
          )}
          {selectedNetworks.length > 0 && (
            <div className="flex justify-between">
              <span>Networks:</span>
              <span className="font-semibold text-blue-600">{selectedNetworks.length} selected</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleReset}
          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
        >
          Reset
        </button>
        <button
          onClick={() => mutate()}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );

  // ============================================
  // CUSTOM TOOLTIP
  // ============================================
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const item = payload[0]?.payload;
    if (!item) return null;

    // Group details by operator for better display
    const operatorBreakdown = useMemo(() => {
      if (!item.details || item.details.length === 0) return [];
      
      const grouped = item.details.reduce((acc, detail) => {
        const key = detail.operatorName;
        if (!acc[key]) {
          acc[key] = { operator: key, total: 0, networks: {} };
        }
        acc[key].total += detail.count;
        acc[key].networks[detail.network] = (acc[key].networks[detail.network] || 0) + detail.count;
        return acc;
      }, {});
      
      return Object.values(grouped).sort((a, b) => b.total - a.total);
    }, [item.details]);

    return (
      <div style={TOOLTIP_STYLE}>
        <p className="font-semibold text-gray-900 mb-2 border-b pb-1">
          {item.name}
        </p>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-gray-600">Total Samples:</span>
            <span className="text-sm font-bold text-blue-600">
              {formatNumber(item.value)}
            </span>
          </div>
          
          {operatorBreakdown.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-1">By Operator:</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {operatorBreakdown.slice(0, 5).map((op, idx) => (
                  <div key={idx} className="text-xs">
                    <div className="flex justify-between font-medium text-gray-800">
                      <span>{op.operator}</span>
                      <span>{formatNumber(op.total)}</span>
                    </div>
                    <div className="pl-2 text-gray-500">
                      {Object.entries(op.networks).map(([net, count]) => (
                        <div key={net} className="flex justify-between">
                          <span>{net}:</span>
                          <span>{formatNumber(count)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {operatorBreakdown.length > 5 && (
                  <p className="text-xs text-gray-400 italic">
                    +{operatorBreakdown.length - 5} more operators
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // ACTIVE FILTERS DISPLAY
  // ============================================
  const ActiveFiltersDisplay = () => {
    const hasFilters = selectedOperators.length > 0 || selectedNetworks.length > 0;
    
    if (!hasFilters) return null;
    
    return (
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        <span className="text-xs text-gray-500">Active Filters:</span>
        
        {selectedOperators.map(op => (
          <span 
            key={`op-${op}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full"
          >
            {op}
            <button onClick={() => setSelectedOperators(prev => prev.filter(o => o !== op))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        
        {selectedNetworks.map(net => (
          <span 
            key={`net-${net}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-teal-100 text-teal-700 rounded-full"
          >
            {net}
            <button onClick={() => setSelectedNetworks(prev => prev.filter(n => n !== net))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        
        <button
          onClick={handleReset}
          className="text-xs text-gray-500 hover:text-gray-700 underline"
        >
          Clear all
        </button>
      </div>
    );
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <ChartCard
      title="Frequency Band Distribution"
      dataset={data}
      exportFileName="band_distribution"
      isLoading={isLoading}
      error={error}
      showChartFilters={false}
      settings={{
        title: 'Band Distribution Settings',
        render: settingsRender,
        onApply: () => console.log('✅ Settings applied')
      }}
    >
      {/* Active Filters Display */}
      <ActiveFiltersDisplay />
      
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 12, right: 50, left: 10, bottom: 8 }}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              horizontal={false} 
              stroke="rgba(0,0,0,0.08)" 
            />
            
            <XAxis
              type="number"
              tick={{ fill: '#6b7280', fontSize: 11, fontWeight: 500 }}
              tickFormatter={formatNumber}
            />
            
            <YAxis
              dataKey="name"
              type="category"
              width={100}
              tick={{ fill: '#111827', fontSize: 11, fontWeight: 600 }}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Bar 
              dataKey="value" 
              radius={[0, 6, 6, 0]}
              animationDuration={500}
            >
              <LabelList
                dataKey="value"
                position="right"
                style={{ fill: '#111827', fontSize: '11px', fontWeight: 600 }}
                formatter={formatNumber}
              />
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-band-${index}`} 
                  fill={CHART_COLORS[index % CHART_COLORS.length]} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-sm">No data available</p>
            {(selectedOperators.length > 0 || selectedNetworks.length > 0) && (
              <button
                onClick={handleReset}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Try clearing filters
              </button>
            )}
          </div>
        </div>
      )}
    </ChartCard>
  );
};

export default BandDistributionChart;