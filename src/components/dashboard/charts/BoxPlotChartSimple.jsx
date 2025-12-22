// components/charts/BoxPlotChartSimple.jsx
import React, { useMemo, useState } from 'react';
import { Settings, Download, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { useBoxData } from '@/hooks/useDashboardData';
import { METRICS } from '@/components/constants/dashboardConstants';
import Spinner from '@/components/common/Spinner';

// Operator colors
const OPERATOR_COLORS = {
  'Airtel': '#E40000',
  'Jio': '#0A2885',
  'Vi': '#FFD700',
  'BSNL': '#00A651',
  'Vodafone': '#E60000',
  'Idea': '#FFD700',
  'default': '#6366f1'
};

const getOperatorColor = (name) => {
  if (!name) return OPERATOR_COLORS.default;
  const cleanName = name.toLowerCase();
  
  if (cleanName.includes('airtel') || cleanName.includes('bharti')) return OPERATOR_COLORS['Airtel'];
  if (cleanName.includes('jio') || cleanName.includes('reliance')) return OPERATOR_COLORS['Jio'];
  if (cleanName.includes('vi') || cleanName.includes('vodafone') || cleanName.includes('idea')) return OPERATOR_COLORS['Vi'];
  if (cleanName.includes('bsnl')) return OPERATOR_COLORS['BSNL'];
  
  // Generate consistent color for unknown operators
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

const BoxPlotChartSimple = () => {
  const [selectedMetric, setSelectedMetric] = useState('rsrp');
  const [showSettings, setShowSettings] = useState(false);

  // Fetch data - pass string directly
  const { data: boxData, isLoading, error } = useBoxData(selectedMetric);

  // Get metric configuration
  const metricConfig = useMemo(() => {
    return METRICS?.find(m => m.value === selectedMetric) || {
      label: 'RSRP',
      unit: 'dBm',
      domain: [-120, -60]
    };
  }, [selectedMetric]);

  // Validate and filter data
  const validData = useMemo(() => {
    if (!boxData || !Array.isArray(boxData)) return [];
    
    return boxData.filter(d => 
      d &&
      d.provider &&
      Number.isFinite(d.min) &&
      Number.isFinite(d.max) &&
      Number.isFinite(d.Q1) &&
      Number.isFinite(d.Q3) &&
      Number.isFinite(d.Median) &&
      d.max > d.min // Ensure valid range
    );
  }, [boxData]);

  // Calculate Y-axis domain from VALID data
  const yDomain = useMemo(() => {
    if (validData.length === 0) {
      return metricConfig.domain || [-120, -60];
    }
    
    const allMin = Math.min(...validData.map(d => d.min));
    const allMax = Math.max(...validData.map(d => d.max));
    
    // Ensure we have a valid range
    if (!Number.isFinite(allMin) || !Number.isFinite(allMax) || allMin >= allMax) {
      return metricConfig.domain || [-120, -60];
    }
    
    const padding = Math.abs(allMax - allMin) * 0.15;
    return [Math.floor(allMin - padding), Math.ceil(allMax + padding)];
  }, [validData, metricConfig]);

  // Safe percentage calculation
  const calcPercent = (value, min, max) => {
    const range = max - min;
    if (range <= 0 || !Number.isFinite(value)) return 0;
    const percent = ((value - min) / range) * 100;
    return Math.max(0, Math.min(100, percent)); // Clamp between 0-100
  };

  // Export handler
  const handleExport = () => {
    if (validData.length === 0) return;

    const headers = ['Provider', 'Min', 'Q1', 'Median', 'Q3', 'Max', 'IQR', 'Samples'];
    const rows = validData.map(item => [
      item.provider,
      item.min?.toFixed(2),
      item.Q1?.toFixed(2),
      item.Median?.toFixed(2),
      item.Q3?.toFixed(2),
      item.max?.toFixed(2),
      (item.Q3 - item.Q1)?.toFixed(2),
      item.samples || 'N/A'
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `boxplot_${selectedMetric}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Check for data quality issues
  const dataWarnings = useMemo(() => {
    const warnings = [];
    if (boxData && boxData.length > validData.length) {
      warnings.push(`${boxData.length - validData.length} row(s) excluded due to invalid data`);
    }
    if (validData.some(d => d.provider.startsWith('Other') || d.provider.startsWith('Unknown'))) {
      warnings.push('Some operators could not be identified');
    }
    return warnings;
  }, [boxData, validData]);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-bold text-gray-900">
            {metricConfig.label} Distribution
          </h3>
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            Box Plot
          </span>
          {validData.length > 0 && (
            <span className="text-xs text-gray-500">
              ({validData.length} operator{validData.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={validData.length === 0}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export CSV"
          >
            <Download size={20} />
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings ? 'text-blue-600 bg-blue-50' : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Warnings */}
      {dataWarnings.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700">
              {dataWarnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
            <Activity size={14} />
            Select Metric
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="w-full max-w-xs px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {(METRICS || [
              { value: 'rsrp', label: 'RSRP' },
              { value: 'rsrq', label: 'RSRQ' },
              { value: 'sinr', label: 'SINR' },
              { value: 'dl_thpt', label: 'DL Throughput' },
              { value: 'ul_thpt', label: 'UL Throughput' },
            ]).map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="h-80 flex items-center justify-center">
          <Spinner />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="h-80 flex flex-col items-center justify-center text-red-500">
          <Activity size={48} className="mb-4 opacity-50" />
          <p className="font-medium">Error loading data</p>
          <p className="text-sm text-gray-500 mt-1">{error.message}</p>
        </div>
      )}

      {/* Chart */}
      {!isLoading && !error && validData.length > 0 && (
        <div className="space-y-6">
          

          {/* Visual Box Plot */}
          <div className="relative bg-gray-50 rounded-lg p-4 pt-6">
            {/* Y-Axis */}
            <div className="absolute left-2 top-6 bottom-12 w-12 flex flex-col justify-between text-xs text-gray-500 text-right pr-2">
              <span>{yDomain[1]} {metricConfig.unit}</span>
              <span>{Math.round((yDomain[0] + yDomain[1]) / 2)}</span>
              <span>{yDomain[0]}</span>
            </div>

            {/* Chart Area */}
            <div 
              className="ml-14 mr-4 flex items-end justify-around gap-2"
              style={{ height: '280px' }}
            >
              {validData.map((item, index) => {
                const color = getOperatorColor(item.provider);
                
                // Calculate percentages safely
                const minPercent = calcPercent(item.min, yDomain[0], yDomain[1]);
                const q1Percent = calcPercent(item.Q1, yDomain[0], yDomain[1]);
                const medianPercent = calcPercent(item.Median, yDomain[0], yDomain[1]);
                const q3Percent = calcPercent(item.Q3, yDomain[0], yDomain[1]);
                const maxPercent = calcPercent(item.max, yDomain[0], yDomain[1]);

                // Ensure minimum box height for visibility
                const boxHeight = Math.max(2, q3Percent - q1Percent);

                return (
                  <div
                    key={`box-${item.provider}-${index}`}
                    className="flex-1 relative max-w-[100px] min-w-[40px]"
                    style={{ height: '100%' }}
                  >
                    {/* Tooltip area */}
                    <div 
                      className="absolute inset-0 cursor-pointer group"
                      title={`${item.provider}\nMax: ${item.max?.toFixed(1)}\nQ3: ${item.Q3?.toFixed(1)}\nMedian: ${item.Median?.toFixed(1)}\nQ1: ${item.Q1?.toFixed(1)}\nMin: ${item.min?.toFixed(1)}\nSamples: ${item.samples?.toLocaleString()}`}
                    >
                      {/* Hover tooltip */}
                      {/* <div className="absolute z-20 left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block">
                        <div className="bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg whitespace-nowrap">
                          <div className="font-bold mb-1">{item.provider}</div>
                          <div className="space-y-0.5">
                            <div>Max: {item.max?.toFixed(1)} {metricConfig.unit}</div>
                            <div>Q3: {item.Q3?.toFixed(1)} {metricConfig.unit}</div>
                            <div className="text-blue-300 font-medium">
                              Median: {item.Median?.toFixed(1)} {metricConfig.unit}
                            </div>
                            <div>Q1: {item.Q1?.toFixed(1)} {metricConfig.unit}</div>
                            <div>Min: {item.min?.toFixed(1)} {metricConfig.unit}</div>
                            {item.samples > 0 && (
                              <div className="pt-1 border-t border-gray-700">
                                Samples: {item.samples?.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div> */}
                    </div>

                    {/* Whisker Line (Min to Max) */}
                    <div
                      className="absolute left-1/2 w-0.5 -translate-x-1/2 transition-all"
                      style={{
                        backgroundColor: color,
                        opacity: 0.6,
                        bottom: `${minPercent}%`,
                        height: `${Math.max(1, maxPercent - minPercent)}%`
                      }}
                    />

                    {/* Min Cap */}
                    <div
                      className="absolute left-1/2 h-0.5 w-4 -translate-x-1/2 transition-all"
                      style={{
                        backgroundColor: color,
                        bottom: `${minPercent}%`
                      }}
                    />

                    {/* Max Cap */}
                    <div
                      className="absolute left-1/2 h-0.5 w-4 -translate-x-1/2 transition-all"
                      style={{
                        backgroundColor: color,
                        bottom: `${maxPercent}%`
                      }}
                    />

                    {/* Box (Q1 to Q3) */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 w-10 rounded border-2 transition-all hover:shadow-lg"
                      style={{
                        borderColor: color,
                        backgroundColor: `${color}40`,
                        bottom: `${q1Percent}%`,
                        height: `${boxHeight}%`,
                        minHeight: '4px'
                      }}
                    />

                    {/* Median Line */}
                    <div
                      className="absolute left-1/2 h-1 w-10 -translate-x-1/2 rounded transition-all"
                      style={{
                        backgroundColor: color,
                        bottom: `${medianPercent}%`,
                        boxShadow: `0 0 4px ${color}`
                      }}
                    />

                    {/* Median Value Label */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap transition-all"
                      style={{
                        color: color,
                        bottom: `${medianPercent + 3}%`
                      }}
                    >
                      {item.Median?.toFixed(1)}
                    </div>

                    {/* Provider Label */}
                    <div 
                      className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs font-bold text-gray-700 whitespace-nowrap max-w-[80px] truncate text-center"
                      title={item.provider}
                    >
                      {item.provider}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Line */}
            <div className="ml-14 mr-4 h-px bg-gray-300 mt-8" />
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && validData.length === 0 && (
        <div className="h-80 flex flex-col items-center justify-center text-gray-500">
          <TrendingUp size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No valid data available</p>
          <p className="text-sm text-gray-400 mt-2">
            {boxData?.length > 0 
              ? 'Data exists but contains invalid values'
              : 'No data returned from API'}
          </p>
        </div>
      )}

      
      {validData.length > 0 && (
        <div className="mt-6 p-3 bg-gray-50 rounded-lg border">
          <h4 className="text-xs font-semibold text-gray-600 mb-2">How to read this chart:</h4>
          <div className="flex flex-wrap gap-6 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <div className="w-6 h-px bg-gray-500" style={{ borderTop: '2px dashed #666' }} />
              <span>Whiskers (Min – Max range)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-4 bg-blue-200 border-2 border-blue-500 rounded" />
              <span>IQR Box (Q1 – Q3, middle 50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-1 bg-blue-600 rounded" />
              <span>Median (50th percentile)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BoxPlotChartSimple;