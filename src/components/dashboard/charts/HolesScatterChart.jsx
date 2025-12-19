// src/components/dashboard/charts/HolesScatterChart.jsx
import React, { useMemo } from 'react';
import { 
  ScatterChart, 
  Scatter, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  ZAxis
} from 'recharts';
import { Activity, AlertTriangle, Signal } from 'lucide-react';
import ChartCard from '../ChartCard';
import { useHoles } from '@/hooks/useDashboardData';
import { 
  normalizeProviderName, 
  getLogColor, 
  COLOR_SCHEMES 
} from '@/utils/colorUtils'; 

// Memoized CustomTooltip component
const CustomTooltip = React.memo(({ active, payload }) => {
  if (!active || !payload?.length) return null;
  
  const data = payload[0].payload;
  
  return (
    <div className="bg-white p-4 border border-gray-200 shadow-xl rounded-lg min-w-[220px] z-50">
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-100">
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0" 
          style={{ backgroundColor: data.color }}
        />
        <span className="text-sm font-bold text-gray-900 truncate">
          {data.normalizedOperator}
        </span>
      </div>
      
      <div className="space-y-1.5 text-xs">
        <div className="grid grid-cols-2 gap-x-4">
          <p className="text-gray-500">ID:</p>
          <p className="font-medium text-gray-900">{data.id}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <p className="text-gray-500">Operator:</p>
          <p className="font-medium text-gray-900">{data.operator}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <p className="text-gray-500">Network:</p>
          <p className="font-medium text-gray-900">{data.network}</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <p className="text-gray-500">RSRP:</p>
          <p className="font-semibold text-blue-600">{data.x} dBm</p>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <p className="text-gray-500">RSRQ:</p>
          <p className="font-semibold text-green-600">{data.y} dB</p>
        </div>
        {data.lat != null && data.lon != null && (
          <div className="pt-1.5 mt-1.5 border-t border-gray-100">
            <p className="text-gray-500 flex items-center gap-1">
              <span>📍</span>
              <span>{Number(data.lat).toFixed(5)}, {Number(data.lon).toFixed(5)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

CustomTooltip.displayName = 'CustomTooltip';

// Operator Legend Component
const OperatorLegend = React.memo(({ operatorCounts }) => {
  if (!operatorCounts || Object.keys(operatorCounts).length === 0) return null;
  
  // Sort by count descending
  const sortedOperators = Object.entries(operatorCounts)
    .sort(([, a], [, b]) => b - a);
  
  return (
    <div className="flex flex-wrap justify-center gap-4 mt-3 pt-3 border-t border-gray-100">
      {sortedOperators.map(([operator, count]) => (
        <div key={operator} className="flex items-center gap-1.5 text-xs">
          <div 
            className="w-3 h-3 rounded-full flex-shrink-0" 
            style={{ backgroundColor: COLOR_SCHEMES.provider[operator] || '#6B7280' }}
          />
          <span className="font-medium text-gray-700">{operator}</span>
          <span className="text-gray-400">({count.toLocaleString()})</span>
        </div>
      ))}
    </div>
  );
});

OperatorLegend.displayName = 'OperatorLegend';

const HolesScatterChart = () => {
  const { data, isLoading, error } = useHoles();

  // Process chart data - color by OPERATOR
  const { chartData, stats, operatorCounts } = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { chartData: [], stats: null, operatorCounts: {} };
    }

    const processed = [];
    const opCounts = {};
    let totalRsrp = 0;
    let totalRsrq = 0;
    let minRsrp = Infinity;
    let maxRsrp = -Infinity;

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const rsrp = Number(item.rsrp);
      const rsrq = Number(item.rsrq);
      
      // Skip invalid data
      if (isNaN(rsrp) || isNaN(rsrq)) continue;

      // Normalize operator name for consistent coloring
      const normalizedOperator = normalizeProviderName(item.operator);
      
      // Get color based on OPERATOR
      const color = getLogColor('provider', item.operator);

      // Update statistics
      totalRsrp += rsrp;
      totalRsrq += rsrq;
      minRsrp = Math.min(minRsrp, rsrp);
      maxRsrp = Math.max(maxRsrp, rsrp);

      // Count operators
      opCounts[normalizedOperator] = (opCounts[normalizedOperator] || 0) + 1;

      processed.push({
        x: rsrp,
        y: rsrq,
        id: item.id,
        operator: item.operator || 'Unknown',
        normalizedOperator,
        network: item.network || 'Unknown',
        lat: item.lat,
        lon: item.lon,
        sessionId: item.sessionId,
        color, // Color based on operator
      });
    }

    const count = processed.length;
    
    const statistics = count > 0 ? {
      count,
      avgRsrp: (totalRsrp / count).toFixed(1),
      avgRsrq: (totalRsrq / count).toFixed(1),
      minRsrp: minRsrp === Infinity ? 0 : minRsrp,
      maxRsrp: maxRsrp === -Infinity ? 0 : maxRsrp,
    } : null;

    return { 
      chartData: processed, 
      stats: statistics, 
      operatorCounts: opCounts 
    };
  }, [data]);

  // Memoized cell renderer - each point colored by operator
  const renderCells = useMemo(() => {
    return chartData.map((entry, index) => (
      <Cell 
        key={`cell-${entry.id || index}`} 
        fill={entry.color}
        fillOpacity={0.8}
      />
    ));
  }, [chartData]);

  // Export data
  const exportData = useMemo(() => {
    return chartData.map(item => ({
      ID: item.id,
      Operator: item.normalizedOperator,
      RawOperator: item.operator,
      Network: item.network,
      RSRP_dBm: item.x,
      RSRQ_dB: item.y,
      Latitude: item.lat,
      Longitude: item.lon
    }));
  }, [chartData]);

  return (
    <ChartCard 
      title="Coverage Holes by Operator" 
      isLoading={isLoading}
      dataset={exportData}
      exportFileName="coverage_holes_by_operator"
      showChartFilters={false}
      headerActions={
        <div className="flex items-center gap-3 text-xs text-gray-500 mr-2">
          {stats && (
            <div className="flex items-center gap-1.5 bg-gray-50 px-2.5 py-1 rounded-md">
              <Activity size={14} className="text-blue-500" />
              <span className="font-semibold text-gray-700">{stats.count.toLocaleString()}</span>
              <span>holes</span>
            </div>
          )}
        </div>
      }
    >
      {error ? (
        <div className="flex flex-col items-center justify-center h-full text-red-400">
          <AlertTriangle className="h-12 w-12 mb-3" />
          <p className="font-medium">Failed to load coverage holes data</p>
          <p className="text-xs mt-1 text-red-300">{error.message}</p>
        </div>
      ) : chartData.length > 0 ? (
        <div className="h-full flex flex-col">
          {/* Stats Summary */}
          {stats && (
            <div className="flex flex-wrap items-center gap-3 mb-3 px-1">
              <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-blue-600">Avg RSRP:</span>
                <span className="font-bold text-blue-700">{stats.avgRsrp} dBm</span>
              </div>
              <div className="flex items-center gap-2 bg-green-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-green-600">Avg RSRQ:</span>
                <span className="font-bold text-green-700">{stats.avgRsrq} dB</span>
              </div>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                <span className="text-gray-500">Range:</span>
                <span className="font-semibold text-gray-700">
                  {stats.minRsrp} to {stats.maxRsrp} dBm
                </span>
              </div>
            </div>
          )}
          
          {/* Chart - ALL POINTS rendered */}
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 25, bottom: 45, left: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number" 
                  dataKey="x" 
                  name="RSRP" 
                  unit=" dBm"
                  domain={['dataMin - 5', 'dataMax + 5']}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={{ stroke: '#d1d5db' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  label={{ 
                    value: 'RSRP (dBm)', 
                    position: 'bottom', 
                    offset: 25, 
                    fontSize: 11,
                    fill: '#4b5563',
                    fontWeight: 500
                  }}
                />
                <YAxis 
                  type="number" 
                  dataKey="y" 
                  name="RSRQ" 
                  unit=" dB"
                  domain={['dataMin - 2', 'dataMax + 2']}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickLine={{ stroke: '#d1d5db' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  label={{ 
                    value: 'RSRQ (dB)', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fontSize: 11,
                    fill: '#4b5563',
                    fontWeight: 500,
                    offset: 5
                  }}
                />
                <ZAxis range={[20, 40]} />
                <Tooltip 
                  content={<CustomTooltip />} 
                  cursor={{ strokeDasharray: '3 3', stroke: '#9ca3af' }}
                  wrapperStyle={{ zIndex: 100 }}
                />
                <Scatter 
                  name="Coverage Holes" 
                  data={chartData}
                  isAnimationActive={false} // Disable animation for performance with many points
                >
                  {renderCells}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          
          {/* Operator Legend */}
          <OperatorLegend operatorCounts={operatorCounts} />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <Signal className="h-14 w-14 mb-3 opacity-20" />
          <p className="font-medium text-gray-500">No Coverage Holes Detected</p>
          <p className="text-xs mt-1.5 text-gray-400">All areas have adequate signal coverage</p>
        </div>
      )}
    </ChartCard>
  );
};

export default React.memo(HolesScatterChart);