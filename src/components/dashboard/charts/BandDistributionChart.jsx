// src/components/charts/BandDistributionChart.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
import ChartCard from '../ChartCard';
import { TOOLTIP_STYLE, CHART_COLORS } from '@/components/constants/dashboardConstants';
import { adminApi } from '@/api/apiEndpoints';
import { buildQueryString, canonicalOperatorName } from '@/utils/dashboardUtils';
import { formatNumber } from '@/utils/chartUtils';

const BandDistributionChart = ({ filters: globalFilters }) => {
  // ============================================
  // STATE MANAGEMENT
  // ============================================
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Independent Filter States
  const [selectedOperator, setSelectedOperator] = useState('all');
  const [selectedNetwork, setSelectedNetwork] = useState('all');
  const [topN, setTopN] = useState(15);
  const [sortBy, setSortBy] = useState('count'); // 'count' or 'band'

  // ============================================
  // DATA FETCHING
  // ============================================
  useEffect(() => {
    const fetchBandData = async () => {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 [BandChart] Fetching band distribution data...');
      console.log('📋 [BandChart] Global Filters:', globalFilters);
      
      try {
        const queryString = buildQueryString(globalFilters || {});
        const response = await adminApi.getBandDistributionV2(queryString);
        
        console.log('📥 [BandChart] Raw API Response:', response);
        
        const rawData = response?.Data || response?.data || response || [];
        
        console.log('📊 [BandChart] Extracted Data:', rawData);
        
        if (!Array.isArray(rawData)) {
          throw new Error('Invalid data structure: Expected array');
        }
        
        // Normalize data
        const processedData = rawData.map(item => ({
          operatorName: canonicalOperatorName(item?.operatorName || item?.operator),
          network: item?.network || 'Unknown',
          band: String(item?.band || ''),
          count: Number(item?.count || 0)
        }));
        
        console.log('✅ [BandChart] Processed Data:', processedData);
        
        setData(processedData);
      } catch (err) {
        console.error('❌ [BandChart] Fetch Error:', err);
        setError(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchBandData();
  }, [globalFilters]);

  // ============================================
  // DERIVED DATA
  // ============================================
  const { operators, networks } = useMemo(() => {
    if (!data || data.length === 0) return { operators: [], networks: [] };
    
    const ops = [...new Set(data.map(d => d.operatorName))].filter(Boolean).sort();
    const nets = [...new Set(data.map(d => d.network))].filter(Boolean).sort();
    
    return { operators: ops, networks: nets };
  }, [data]);

  // ============================================
  // CHART DATA PREPARATION
  // ============================================
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    console.log('🔧 [BandChart] Applying filters:', { selectedOperator, selectedNetwork, topN, sortBy });
    
    // Apply filters
    let filtered = data.filter(item => {
      if (selectedOperator !== 'all' && item.operatorName !== selectedOperator) return false;
      if (selectedNetwork !== 'all' && item.network !== selectedNetwork) return false;
      return true;
    });
    
    console.log('🔍 [BandChart] Filtered data:', filtered.length, 'items');
    
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
    
    console.log('📦 [BandChart] Aggregated data:', result.length, 'bands');
    
    // Sort
    if (sortBy === 'count') {
      result.sort((a, b) => b.value - a.value);
    } else {
      result.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    // Take top N
    const final = result.slice(0, topN);
    
    console.log('✅ [BandChart] Final chart data:', final);
    
    return final;
  }, [data, selectedOperator, selectedNetwork, topN, sortBy]);

  // ============================================
  // SETTINGS RENDER
  // ============================================
  const settingsRender = () => (
    <div className="space-y-4">
      {/* Operator Filter */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Operator
        </label>
        <select
          value={selectedOperator}
          onChange={(e) => setSelectedOperator(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Operators</option>
          {operators.map(op => (
            <option key={op} value={op}>{op}</option>
          ))}
        </select>
      </div>

      {/* Network Filter */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Network Type
        </label>
        <select
          value={selectedNetwork}
          onChange={(e) => setSelectedNetwork(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Networks</option>
          {networks.map(net => (
            <option key={net} value={net}>{net}</option>
          ))}
        </select>
      </div>

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
          <option value={10}>Top 10</option>
          <option value={15}>Top 15</option>
          <option value={20}>Top 20</option>
          <option value={25}>Top 25</option>
          <option value={50}>Top 50</option>
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
          <option value="band">Band Number</option>
        </select>
      </div>

      {/* Info */}
      <div className="pt-3 border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Showing:</span>
            <span className="font-semibold text-gray-900">{chartData.length} bands</span>
          </div>
          <div className="flex justify-between">
            <span>Total Samples:</span>
            <span className="font-semibold text-gray-900">
              {formatNumber(chartData.reduce((sum, item) => sum + item.value, 0))}
            </span>
          </div>
        </div>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => {
          setSelectedOperator('all');
          setSelectedNetwork('all');
          setTopN(15);
          setSortBy('count');
        }}
        className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 transition-colors"
      >
        Reset Filters
      </button>
    </div>
  );

  // ============================================
  // CUSTOM TOOLTIP
  // ============================================
  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;

    const item = payload[0]?.payload;
    if (!item) return null;

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
          
          {item.details && item.details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-1">Breakdown:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...item.details]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map((detail, idx) => (
                    <div key={idx} className="flex justify-between text-xs gap-2">
                      <span className="text-gray-600 truncate">
                        {detail.operatorName} ({detail.network})
                      </span>
                      <span className="font-medium text-gray-800 whitespace-nowrap">
                        {formatNumber(detail.count)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ============================================
  // RENDER CHART
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
        onApply: () => {
          console.log('✅ Settings applied');
        }
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 12, right: 40, left: 10, bottom: 8 }}
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
            width={130}
            tick={{ fill: '#111827', fontSize: 12, fontWeight: 600 }}
          />
          
          <Tooltip content={<CustomTooltip />} />
          
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            <LabelList
              dataKey="value"
              position="right"
              style={{ fill: '#111827', fontSize: '12px', fontWeight: 700 }}
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
    </ChartCard>
  );
};

export default BandDistributionChart;