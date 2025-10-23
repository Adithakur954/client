import React, { useEffect, useMemo, useState } from 'react';
import Spinner from '../common/Spinner';

// Lazy loaded chart component to improve initial page load
function PerformanceChart({ data, metric, loading }) {
  const [ChartComponents, setChartComponents] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const mod = await import('recharts');
        if (!cancelled) setChartComponents(mod);
      } catch (e) {
        console.error('Failed to load chart library:', e);
      }
    };
    // Use requestIdleCallback for non-critical resources
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(load);
    } else {
      setTimeout(load, 100); // Fallback for older browsers
    }
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Spinner /></div>;
  }
  if (!data?.length) {
    return <div className="text-center text-gray-500 pt-10">No chart data.</div>;
  }
  if (!ChartComponents) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading chart…</div>;
  }

  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } = ChartComponents;

  return (
    <ResponsiveContainer width="100%" height="90%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, width: 70 }} interval={0} />
        <Tooltip formatter={(value) => [`${Number(value)?.toFixed(1)}%`, 'Percentage']} />
        <Bar dataKey="value" background={{ fill: '#eee' }}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}


const PredictionDetailsPanel = ({ predictionData, metric, loading }) => {
  const {
    avgRsrp,
    avgRsrq,
    avgSinr,
    coveragePerfGraph,
  } = predictionData || {};

  const chartData = useMemo(() => {
    const series = coveragePerfGraph?.series?.[0]?.data || [];
    const cats = coveragePerfGraph?.Category || [];
    return series.map((item, idx) => ({
      name: cats[idx] || `Range ${idx + 1}`,
      value: item?.y,
      color: item?.color,
    }));
  }, [coveragePerfGraph]);

  return (
    <div className="space-y-4">
      {/* Averages Card */}
      <div className="p-4 bg-white rounded-lg shadow-md border">
        <h2 className="font-semibold mb-2">Averages</h2>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="text-gray-500">RSRP</div>
            <div className="font-bold text-lg">{avgRsrp != null ? Number(avgRsrp).toFixed(2) : 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">RSRQ</div>
            <div className="font-bold text-lg">{avgRsrq != null ? Number(avgRsrq).toFixed(2) : 'N/A'}</div>
          </div>
          <div>
            <div className="text-gray-500">SINR</div>
            <div className="font-bold text-lg">{avgSinr != null ? Number(avgSinr).toFixed(2) : 'N/A'}</div>
          </div>
        </div>
      </div>

      {/* Chart Card */}
      <div className="p-4 bg-white rounded-lg shadow-md border h-80">
        <h2 className="font-semibold mb-2">Performance Distribution ({metric})</h2>
        <PerformanceChart data={chartData} metric={metric} loading={loading} />
      </div>
    </div>
  );
};

export default PredictionDetailsPanel;
