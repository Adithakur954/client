// src/components/MapLegend.jsx
import React from 'react';

const OPERATOR_LEGEND = [
  { operator: 'Jio', color: '#3b82f6', description: '5G NR', sectors: 12 },
  { operator: 'Airtel', color: '#ef4444', description: '4G LTE', sectors: 9 },
  { operator: 'Vi', color: '#a855f7', description: '4G LTE', sectors: 9 },
  { operator: 'BSNL', color: '#22c55e', description: '4G LTE', sectors: 6 },
];

const SIGNAL_LEGEND = [
  { label: 'Excellent', color: '#22c55e', range: '-75 to -80 dBm' },
  { label: 'Good', color: '#86efac', range: '-82 to -85 dBm' },
  { label: 'Fair', color: '#fbbf24', range: '-90 to -95 dBm' },
  { label: 'Poor', color: '#fb923c', range: '-98 to -102 dBm' },
  { label: 'Very Poor', color: '#ef4444', range: '-105+ dBm' },
];

const MapLegend = ({ showOperators = true, showSignalQuality = false }) => {
  if (!showOperators && !showSignalQuality) return null;

  return (
    <div className="absolute top-2 right-2 z-10 bg-white/95 dark:bg-gray-900/95 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[220px] max-w-[280px]">
      <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
       
        <span>Legends</span>
      </h3>
      
      {showOperators && (
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
            
            <span>Cell Sectors</span>
          </div>
          
          <div className="space-y-1.5">
            {OPERATOR_LEGEND.map(({ operator, color, description, sectors }) => (
              <div key={operator} className="flex items-center gap-2">
                <div className="flex items-center gap-1 flex-shrink-0">
                  <div
                    className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent"
                    style={{ borderBottomColor: color, opacity: 0.7 }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    {operator}
                  </div>
                 
                </div>
              </div>
            ))}
          </div>
          
        </div>
      )}

      {showSignalQuality && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1">
           
            <span>Prediction Points (RSRP)</span>
          </div>
          <div className="space-y-1.5">
            {SIGNAL_LEGEND.map(({ label, color, range }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: color, opacity: 0.7 }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-gray-800 dark:text-gray-200">
                    {label}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {range}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MapLegend;