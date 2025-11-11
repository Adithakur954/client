import React, { useEffect, useState, useMemo } from 'react';
import { adminApi } from '@/api/apiEndpoints';
import toast from 'react-hot-toast';
import { 
  BarChart3, 
  MapPin, 
  Layers, 
  Signal, 
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  PieChart as PieChartIcon,
  Download,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';

// ========================================
// UTILITY COMPONENTS
// ========================================

const StatCard = ({ icon: Icon, label, value, subValue, color = "blue", trend }) => {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  };

  return (
    <div className={`rounded-lg border p-3 ${colorClasses[color]} transition-all hover:scale-105`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs opacity-80 mb-1">{label}</p>
          <p className="text-2xl font-bold flex items-center gap-2">
            {value}
            {trend && (
              trend > 0 ? 
                <TrendingUp className="h-4 w-4 text-green-400" /> : 
                <TrendingDown className="h-4 w-4 text-red-400" />
            )}
          </p>
          {subValue && <p className="text-xs opacity-70 mt-1">{subValue}</p>}
        </div>
        {Icon && <Icon className="h-5 w-5 opacity-60" />}
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
      active
        ? 'bg-blue-600 text-white shadow-lg'
        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
    } rounded-lg`}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {children}
  </button>
);

// ========================================
// CHART COMPONENTS
// ========================================

const SignalDistributionChart = ({ locations, metric, thresholds }) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const currentThresholds = thresholds?.[metric] || [];
    if (currentThresholds.length === 0) return [];

    return currentThresholds.map(threshold => {
      const count = locations.filter(loc => {
        const val = loc[metric];
        return val != null && val >= threshold.min && val <= threshold.max;
      }).length;

      return {
        range: `${threshold.min} to ${threshold.max}`,
        count,
        color: threshold.color,
        percentage: ((count / locations.length) * 100).toFixed(1)
      };
    }).filter(item => item.count > 0);
  }, [locations, metric, thresholds]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No data available</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <BarChart3 className="h-4 w-4" />
        {metric.toUpperCase()} Distribution
      </h4>
      
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="range" 
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value, name) => [value, name === 'count' ? 'Points' : name]}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 bg-slate-800 p-2 rounded">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
            <span className="text-slate-300 flex-1">{item.range}</span>
            <span className="font-semibold text-white">{item.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const OperatorPieChart = ({ locations }) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const grouped = locations.reduce((acc, loc) => {
      const op = loc.operator || 'Unknown';
      acc[op] = (acc[op] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value,
      percentage: ((value / locations.length) * 100).toFixed(1)
    }));
  }, [locations]);

  const COLORS = {
    'JIO': '#0066cc',
    'Airtel': '#e60000',
    'Vi (Vodafone Idea)': '#c90000',
    'Unknown': '#666666'
  };

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        className="text-xs font-bold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No operator data</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <PieChartIcon className="h-4 w-4" />
        Operator Distribution
      </h4>

      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomizedLabel}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#999999'} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="space-y-1">
        {data.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between bg-slate-800 p-2 rounded text-xs">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: COLORS[item.name] || '#999999' }}
              />
              <span className="text-slate-300">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400">{item.value} points</span>
              <span className="font-semibold text-white">{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MetricComparisonRadar = ({ locations, selectedMetric }) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const metrics = ['rsrp', 'rsrq', 'sinr', 'mos'];
    
    return metrics.map(metric => {
      const values = locations
        .map(loc => loc[metric])
        .filter(val => val != null && !isNaN(val));

      if (values.length === 0) return null;

      const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
      
      // Normalize to 0-100 scale for radar chart
      let normalized;
      if (metric === 'rsrp') {
        normalized = ((avg + 140) / 40) * 100; // -140 to -100 → 0 to 100
      } else if (metric === 'rsrq') {
        normalized = ((avg + 20) / 10) * 100; // -20 to -10 → 0 to 100
      } else if (metric === 'sinr') {
        normalized = ((avg + 5) / 30) * 100; // -5 to 25 → 0 to 100
      } else if (metric === 'mos') {
        normalized = (avg / 5) * 100; // 0 to 5 → 0 to 100
      } else {
        normalized = Math.min((avg / 100) * 100, 100);
      }

      return {
        metric: metric.toUpperCase(),
        value: Math.max(0, Math.min(100, normalized)),
        actual: avg.toFixed(2)
      };
    }).filter(Boolean);
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No metrics available</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Activity className="h-4 w-4" />
        Multi-Metric Comparison
      </h4>

      <ResponsiveContainer width="100%" height={250}>
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid stroke="#475569" />
          <PolarAngleAxis 
            dataKey="metric" 
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <PolarRadiusAxis 
            angle={90} 
            domain={[0, 100]}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
          />
          <Radar 
            name="Quality Score" 
            dataKey="value" 
            stroke="#3b82f6" 
            fill="#3b82f6" 
            fillOpacity={0.6} 
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
            formatter={(value, name, props) => [
              `${value.toFixed(1)}% (${props.payload.actual})`,
              'Quality Score'
            ]}
          />
        </RadarChart>
      </ResponsiveContainer>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {data.map((item, idx) => (
          <div key={idx} className="bg-slate-800 p-2 rounded">
            <div className="text-slate-400">{item.metric}</div>
            <div className="text-white font-semibold">{item.actual}</div>
            <div className="text-blue-400 text-xs">{item.value.toFixed(1)}%</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CoverageQualityHeatmap = ({ locations, metric, thresholds }) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return null;

    const currentThresholds = thresholds?.[metric] || [];
    if (currentThresholds.length === 0) return null;

    const total = locations.length;
    const distribution = currentThresholds.map(threshold => {
      const count = locations.filter(loc => {
        const val = loc[metric];
        return val != null && val >= threshold.min && val <= threshold.max;
      }).length;

      return {
        label: `${threshold.min} to ${threshold.max}`,
        count,
        percentage: (count / total) * 100,
        color: threshold.color
      };
    });

    // Calculate quality score (weighted average based on threshold position)
    const qualityScore = distribution.reduce((score, item, idx) => {
      const weight = (idx + 1) / distribution.length;
      return score + (item.percentage * weight);
    }, 0);

    return { distribution, qualityScore: qualityScore.toFixed(1), total };
  }, [locations, metric, thresholds]);

  if (!data) {
    return <div className="text-center text-slate-400 py-8 text-sm">No threshold data</div>;
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Signal className="h-4 w-4" />
        Coverage Quality Breakdown
      </h4>

      <div className="bg-slate-800 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400">Overall Quality Score</span>
          <span className="text-2xl font-bold text-blue-400">{data.qualityScore}%</span>
        </div>
        
        <div className="w-full h-8 bg-slate-700 rounded-full overflow-hidden flex">
          {data.distribution.map((item, idx) => (
            <div
              key={idx}
              style={{
                width: `${item.percentage}%`,
                backgroundColor: item.color
              }}
              className="transition-all hover:opacity-80 cursor-pointer"
              title={`${item.label}: ${item.count} points (${item.percentage.toFixed(1)}%)`}
            />
          ))}
        </div>

        <div className="mt-3 space-y-1">
          {data.distribution.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-slate-300">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400">{item.count}</span>
                <span className="font-semibold text-white min-w-[45px] text-right">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const TechnologyBreakdown = ({ locations }) => {
  const data = useMemo(() => {
    if (!locations || locations.length === 0) return [];

    const grouped = locations.reduce((acc, loc) => {
      const tech = loc.technology || 'Unknown';
      if (!acc[tech]) {
        acc[tech] = { count: 0, avgRsrp: [], avgSinr: [] };
      }
      acc[tech].count++;
      if (loc.rsrp != null) acc[tech].avgRsrp.push(loc.rsrp);
      if (loc.sinr != null) acc[tech].avgSinr.push(loc.sinr);
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, data]) => ({
      name,
      count: data.count,
      avgRsrp: data.avgRsrp.length > 0 
        ? (data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1)
        : 'N/A',
      avgSinr: data.avgSinr.length > 0
        ? (data.avgSinr.reduce((a, b) => a + b, 0) / data.avgSinr.length).toFixed(1)
        : 'N/A'
    })).sort((a, b) => b.count - a.count);
  }, [locations]);

  if (data.length === 0) {
    return <div className="text-center text-slate-400 py-8 text-sm">No technology data</div>;
  }

  const TECH_COLORS = {
    'LTE': '#10b981',
    '5G': '#8b5cf6',
    '4G': '#3b82f6',
    '3G': '#f59e0b',
    'Unknown': '#6b7280'
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
        <Layers className="h-4 w-4" />
        Technology Distribution
      </h4>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis 
            dataKey="name" 
            angle={-45}
            textAnchor="end"
            height={60}
            tick={{ fill: '#9CA3AF', fontSize: 11 }}
          />
          <YAxis tick={{ fill: '#9CA3AF', fontSize: 12 }} />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#1e293b', 
              border: '1px solid #475569',
              borderRadius: '8px',
              color: '#fff'
            }}
          />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={TECH_COLORS[entry.name] || '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="space-y-1">
        {data.map((item, idx) => (
          <div key={idx} className="bg-slate-800 p-2 rounded text-xs">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: TECH_COLORS[item.name] || '#6b7280' }}
                />
                <span className="text-white font-semibold">{item.name}</span>
              </div>
              <span className="text-slate-300">{item.count} points</span>
            </div>
            <div className="grid grid-cols-2 gap-2 ml-5">
              <div className="text-slate-400">
                Avg RSRP: <span className="text-blue-400 font-semibold">{item.avgRsrp}</span>
              </div>
              <div className="text-slate-400">
                Avg SINR: <span className="text-green-400 font-semibold">{item.avgSinr}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ========================================
// MAIN COMPONENT
// ========================================

function UnifiedDetailLogs({
  locations = [],
  totalLocations = 0,
  filteredCount = 0,
  dataToggle,
  enableDataToggle,
  selectedMetric,
  siteData = [],
  siteToggle,
  enableSiteToggle,
  showSiteMarkers,
  showSiteSectors,
  polygons = [],
  visiblePolygons = [],
  polygonSource,
  showPolygons,
  onlyInsidePolygons,
  showCoverageHoleOnly,
  coverageHoleThreshold,
  viewport,
  mapCenter,
  projectId,
  sessionIds = [],
  isLoading,
  thresholds,
  onClose,
}) {
  const [duration, setDuration] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch duration data
  useEffect(() => {
    if (!sessionIds || sessionIds.length === 0) return;

    const fetchDuration = async () => {
      try {
        const payload = { session_ids: sessionIds };
        const resp = await adminApi.getNetworkDurations(payload);
        
        if (resp?.Data) {
          setDuration(resp.Data);
        }
      } catch (error) {
        console.error('Failed to fetch duration:', error);
      }
    };

    fetchDuration();
  }, [sessionIds]);

  // Calculate statistics
  const stats = useMemo(() => {
    if (!locations || locations.length === 0) return null;

    const values = locations
      .map(loc => loc[selectedMetric])
      .filter(val => val != null && !isNaN(val));

    if (values.length === 0) return null;

    const sum = values.reduce((acc, val) => acc + val, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    return { avg, min, max, median, count: values.length };
  }, [locations, selectedMetric]);

  const coverageHoleCount = useMemo(() => {
    if (!locations) return 0;
    return locations.filter(loc => {
      const rsrp = parseFloat(loc.rsrp);
      return !isNaN(rsrp) && rsrp < coverageHoleThreshold;
    }).length;
  }, [locations, coverageHoleThreshold]);

  const polygonStats = useMemo(() => {
    if (!polygons || polygons.length === 0) return null;

    const withPoints = polygons.filter(p => p.pointCount > 0);
    const totalPoints = polygons.reduce((sum, p) => sum + (p.pointCount || 0), 0);
    const avgPoints = withPoints.length > 0 ? totalPoints / withPoints.length : 0;

    return {
      total: polygons.length,
      withData: withPoints.length,
      totalPoints,
      avgPoints: avgPoints.toFixed(1)
    };
  }, [polygons]);

  // Export data handler
  const handleExport = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      projectId,
      sessionIds,
      summary: {
        totalPoints: totalLocations,
        filteredPoints: filteredCount,
        metric: selectedMetric,
        stats
      },
      locations: locations.map(loc => ({
        lat: loc.lat,
        lng: loc.lng,
        [selectedMetric]: loc[selectedMetric],
        operator: loc.operator,
        technology: loc.technology
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${projectId}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analytics exported successfully!');
  };

  // Collapsed state
  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-40 flex gap-2">
        <button
          onClick={() => setCollapsed(false)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Show Analytics
        </button>
        <button
          onClick={onClose}
          className="bg-red-900 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-red-800 transition-all"
          title="Close Analytics"
        >
          ✕
        </button>
      </div>
    );
  }

  const containerWidth = expanded ? 'w-[95vw] max-w-[1400px]' : 'w-[420px]';

  return (
    <div className={`fixed ${expanded ? 'top-20 left-1/2 -translate-x-1/2' : 'bottom-4 right-4'} z-40 ${containerWidth} bg-slate-950 text-white rounded-lg shadow-2xl border border-slate-700 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-900 rounded-t-lg">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold">Live Analytics Dashboard</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            className="text-slate-400 hover:text-green-400 transition-colors p-1 rounded hover:bg-slate-800"
            title="Export Data"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-800"
            title={expanded ? "Minimize" : "Expand"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-800 font-bold"
            title="Collapse"
          >
            −
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-slate-800"
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-3 bg-slate-900 border-b border-slate-700 overflow-x-auto">
        <TabButton 
          active={activeTab === 'overview'} 
          onClick={() => setActiveTab('overview')}
          icon={BarChart3}
        >
          Overview
        </TabButton>
        <TabButton 
          active={activeTab === 'distribution'} 
          onClick={() => setActiveTab('distribution')}
          icon={Signal}
        >
          Distribution
        </TabButton>
        <TabButton 
          active={activeTab === 'operators'} 
          onClick={() => setActiveTab('operators')}
          icon={PieChartIcon}
        >
          Operators
        </TabButton>
        <TabButton 
          active={activeTab === 'comparison'} 
          onClick={() => setActiveTab('comparison')}
          icon={Activity}
        >
          Comparison
        </TabButton>
      </div>

      {/* Content */}
      <div className={`${expanded ? 'max-h-[calc(100vh-200px)]' : 'max-h-[70vh]'} overflow-y-auto p-4 space-y-4`}>
        {isLoading && (
          <div className="text-center py-8 text-slate-400">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading analytics...
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className={`grid ${expanded ? 'grid-cols-4' : 'grid-cols-2'} gap-3`}>
              {enableDataToggle && (
                <>
                  <StatCard
                    icon={MapPin}
                    label="Total Points"
                    value={totalLocations.toLocaleString()}
                    color="blue"
                  />
                  <StatCard
                    icon={Activity}
                    label="Displayed"
                    value={filteredCount.toLocaleString()}
                    color="green"
                  />
                </>
              )}

              {enableSiteToggle && (
                <StatCard
                  icon={Layers}
                  label="Sites"
                  value={siteData.length}
                  subValue={siteToggle}
                  color="purple"
                />
              )}

              {showPolygons && polygonStats && (
                <StatCard
                  icon={Layers}
                  label="Polygons"
                  value={polygonStats.total}
                  subValue={`${polygonStats.withData} with data`}
                  color="orange"
                />
              )}

              {showCoverageHoleOnly && (
                <StatCard
                  icon={Signal}
                  label="Coverage Holes"
                  value={coverageHoleCount}
                  subValue={`< ${coverageHoleThreshold} dBm`}
                  color="red"
                />
              )}
            </div>

            {/* Metric Stats */}
            {stats && (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  {selectedMetric.toUpperCase()} Statistics
                </h4>
                
                <div className={`grid ${expanded ? 'grid-cols-5' : 'grid-cols-3'} gap-3`}>
                  <div className="bg-slate-800 rounded p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Average</div>
                    <div className="text-xl font-bold text-white">{stats.avg.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800 rounded p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Minimum</div>
                    <div className="text-xl font-bold text-blue-400">{stats.min.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800 rounded p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Maximum</div>
                    <div className="text-xl font-bold text-green-400">{stats.max.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800 rounded p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Median</div>
                    <div className="text-xl font-bold text-purple-400">{stats.median.toFixed(2)}</div>
                  </div>
                  <div className="bg-slate-800 rounded p-3 text-center">
                    <div className="text-xs text-slate-400 mb-1">Count</div>
                    <div className="text-xl font-bold text-yellow-400">{stats.count}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Coverage Quality */}
            {locations.length > 0 && (
              <CoverageQualityHeatmap
                locations={locations}
                metric={selectedMetric}
                thresholds={thresholds}
              />
            )}

            {/* Duration */}
            {duration && (
              <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Session Information
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-800 p-3 rounded">
                    <div className="text-slate-400 text-xs mb-1">Duration</div>
                    <div className="text-white font-semibold">{duration.total_duration || 'N/A'}</div>
                  </div>
                  <div className="bg-slate-800 p-3 rounded">
                    <div className="text-slate-400 text-xs mb-1">Start Time</div>
                    <div className="text-white font-semibold">
                      {duration.start_time ? new Date(duration.start_time).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Distribution Tab */}
        {activeTab === 'distribution' && (
          <div className={`grid ${expanded ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <SignalDistributionChart
              locations={locations}
              metric={selectedMetric}
              thresholds={thresholds}
            />
            <TechnologyBreakdown locations={locations} />
          </div>
        )}

        {/* Operators Tab */}
        {activeTab === 'operators' && (
          <div className={`grid ${expanded ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <OperatorPieChart locations={locations} />
            
            {/* Additional operator metrics */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-slate-200">Operator Performance</h4>
              {locations.length > 0 && (() => {
                const operatorMetrics = locations.reduce((acc, loc) => {
                  const op = loc.operator || 'Unknown';
                  if (!acc[op]) {
                    acc[op] = { rsrp: [], sinr: [], count: 0 };
                  }
                  acc[op].count++;
                  if (loc.rsrp != null) acc[op].rsrp.push(loc.rsrp);
                  if (loc.sinr != null) acc[op].sinr.push(loc.sinr);
                  return acc;
                }, {});

                return Object.entries(operatorMetrics).map(([op, data]) => (
                  <div key={op} className="bg-slate-800 rounded-lg p-3">
                    <div className="font-semibold text-white mb-2">{op}</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <div className="text-slate-400">Points</div>
                        <div className="text-white font-semibold">{data.count}</div>
                      </div>
                      <div>
                        <div className="text-slate-400">Avg RSRP</div>
                        <div className="text-blue-400 font-semibold">
                          {data.rsrp.length > 0
                            ? (data.rsrp.reduce((a, b) => a + b, 0) / data.rsrp.length).toFixed(1)
                            : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400">Avg SINR</div>
                        <div className="text-green-400 font-semibold">
                          {data.sinr.length > 0
                            ? (data.sinr.reduce((a, b) => a + b, 0) / data.sinr.length).toFixed(1)
                            : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        )}

        {/* Comparison Tab */}
        {activeTab === 'comparison' && (
          <div className="space-y-4">
            <MetricComparisonRadar
              locations={locations}
              selectedMetric={selectedMetric}
            />
          </div>
        )}

        {/* Map Info */}
        {viewport && (
          <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <h4 className="text-xs text-slate-400 mb-2">Current Viewport</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400">North:</span>
                <span className="ml-2 text-white font-mono">{viewport.north.toFixed(5)}</span>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400">South:</span>
                <span className="ml-2 text-white font-mono">{viewport.south.toFixed(5)}</span>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400">East:</span>
                <span className="ml-2 text-white font-mono">{viewport.east.toFixed(5)}</span>
              </div>
              <div className="bg-slate-800 p-2 rounded">
                <span className="text-slate-400">West:</span>
                <span className="ml-2 text-white font-mono">{viewport.west.toFixed(5)}</span>
              </div>
            </div>
          </div>
        )}

        {/* IDs */}
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 text-xs space-y-2">
          {projectId && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Project ID:</span>
              <span className="font-mono text-blue-400 font-semibold">{projectId}</span>
            </div>
          )}
          {sessionIds.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Session IDs:</span>
              <span className="font-mono text-green-400 font-semibold">{sessionIds.join(', ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UnifiedDetailLogs;