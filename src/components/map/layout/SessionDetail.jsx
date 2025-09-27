import React, { useMemo } from 'react';
import { X } from 'lucide-react';
import Spinner from '@/components/common/Spinner';
import { resolveMetricConfig } from '@/utils/metrics';

const calculateAverage = (logs, key) => {
  const validLogs = logs
    .map(log => ({ ...log, [key]: parseFloat(log[key]) }))
    .filter(log => typeof log[key] === 'number' && !isNaN(log[key]));
  if (validLogs.length === 0) return 'N/A';
  const sum = validLogs.reduce((acc, log) => acc + log[key], 0);
  return (sum / validLogs.length).toFixed(2);
};

const formatOperatorName = (alphaLong) => {
  if (!alphaLong || alphaLong === '404011' || alphaLong === '//////') {
    return 'Unknown';
  }
  return alphaLong;
};

const SessionDetailPanel = ({ sessionData, isLoading, onClose, thresholds, selectedMetric }) => {
  const stats = useMemo(() => {
    if (!sessionData || !sessionData.logs || sessionData.logs.length === 0) {
      return { 
        avgRsrp: 'N/A', avgRsrq: 'N/A', avgSinr: 'N/A', 
        avgDlTpt: 'N/A', avgUlTpt: 'N/A',
        uniqueOperators: 'N/A', uniqueBands: 'N/A' 
      };
    }
    const { logs } = sessionData;

    const uniqueOperators = [...new Set(logs.map(log => formatOperatorName(log.m_alpha_long)).filter(Boolean))].join(', ');
    const uniqueBands = [...new Set(logs.map(log => log.band).filter(Boolean))].join(', ');

    return {
      avgRsrp: calculateAverage(logs, 'rsrp'),
      avgRsrq: calculateAverage(logs, 'rsrq'),
      avgSinr: calculateAverage(logs, 'sinr'),
      avgDlTpt: calculateAverage(logs, 'dl_tpt'),
      avgUlTpt: calculateAverage(logs, 'ul_tpt'),
      uniqueOperators: uniqueOperators || 'N/A',
      uniqueBands: uniqueBands || 'N/A',
    };
  }, [sessionData]);

  const metricSummary = useMemo(() => {
    if (!sessionData || !sessionData.logs) return [];
    const { field, thresholdKey } = resolveMetricConfig(selectedMetric);
    const ranges = thresholds?.[thresholdKey] || [];
    const summary = ranges.map((r) => ({ ...r, count: 0 }));

    sessionData.logs.forEach((log) => {
      const value = parseFloat(log[field]);
      if (!isNaN(value)) {
        for (const range of summary) {
          if (value >= range.min && value <= range.max) {
            range.count += 1;
            break;
          }
        }
      }
    });
    return summary;
  }, [sessionData, thresholds, selectedMetric]);

  if (!sessionData) return null;
  const { session, logs } = sessionData;

  return (
    <div className={`absolute top-0 right-0 w-96 text-white bg-slate-900 shadow-2xl z-20 transform transition-transform ${sessionData ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex flex-col h-full">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold">Session Details</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-full"><Spinner /></div>
          ) : (
            <>
              <div>
                <h4 className="font-semibold mb-2">Session Summary</h4>
                <div className="text-sm space-y-1 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p><strong>Session ID:</strong> {session.id}</p>
                  <p><strong>User:</strong> {session.CreatedBy || 'N/A'}</p>
                  <p><strong>Device:</strong> {`${session.make || ''} ${session.model || ''}`.trim() || 'N/A'}</p>
                  <p><strong>Started:</strong> {session.start_time ? new Date(session.start_time).toLocaleString() : 'N/A'}</p>
                  <p><strong>Ended:</strong> {session.end_time ? new Date(session.end_time).toLocaleString() : 'N/A'}</p>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Aggregated Statistics ({logs.length} logs)</h4>
                <div className="text-sm grid grid-cols-2 gap-2 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p><strong>Avg RSRP:</strong> {stats.avgRsrp} dBm</p>
                  <p><strong>Avg RSRQ:</strong> {stats.avgRsrq} dB</p>
                  <p><strong>Avg SINR:</strong> {stats.avgSinr} dB</p>
                  <p><strong>Avg DL Tpt:</strong> {stats.avgDlTpt} Mbps</p>
                  <p><strong>Avg UL Tpt:</strong> {stats.avgUlTpt} Mbps</p>
                  <p className="col-span-2"><strong>Operators:</strong> {stats.uniqueOperators}</p>
                  <p className="col-span-2"><strong>Bands:</strong> {stats.uniqueBands}</p>
                </div>
              </div>

              <h3 className="mt-4 font-medium">Metric: {String(selectedMetric).toUpperCase()}</h3>
              <div className="mt-2">
                {metricSummary.map((range, idx) => (
                  <div key={idx} className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded" style={{ backgroundColor: range.color }} />
                      <span className='text-xs'>{range.range} ({range.min} to {range.max})</span>
                    </div>
                    <span>{range.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SessionDetailPanel;