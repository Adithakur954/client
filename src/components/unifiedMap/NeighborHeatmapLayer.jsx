// src/components/unifiedMap/NeighborHeatmapLayer.jsx
import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { HeatmapLayer, Circle, InfoWindow } from '@react-google-maps/api';

// RSRP-based colors
const getRSRPColor = (rsrp) => {
  if (rsrp === null || rsrp === undefined) return '#999999';
  if (rsrp >= -80) return '#00C853';  // Excellent
  if (rsrp >= -90) return '#64DD17';  // Good
  if (rsrp >= -100) return '#FFD600'; // Fair
  if (rsrp >= -110) return '#FF9100'; // Poor
  return '#FF1744';                    // Very Poor
};

// PCI-based colors (for collision display)
const PCI_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
];

const getPCIColor = (pci) => PCI_COLORS[parseInt(pci || 0) % PCI_COLORS.length];

const NeighborHeatmapLayer = React.memo(({
  allNeighbors = [],
  showNeighbors = false,
  selectedMetric = 'rsrp',
  radius = 30,
  opacity = 0.6,
  useHeatmap = true,
  onNeighborClick,
}) => {
  const [isVisualizationReady, setIsVisualizationReady] = useState(false);
  const [selectedNeighbor, setSelectedNeighbor] = useState(null);

  // Check visualization library
  useEffect(() => {
    if (!showNeighbors) return;
    
    const check = () => {
      if (window.google?.maps?.visualization) {
        setIsVisualizationReady(true);
      } else {
        setTimeout(check, 300);
      }
    };
    check();
  }, [showNeighbors]);

  // All neighbors already have valid coords (filtered in hook)
  const neighbors = useMemo(() => {
    if (!showNeighbors || !allNeighbors?.length) return [];
    
    return allNeighbors.map((n) => ({
      ...n,
      color: n.rsrp !== null ? getRSRPColor(n.rsrp) : getPCIColor(n.pci),
    }));
  }, [allNeighbors, showNeighbors]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    if (!useHeatmap || !isVisualizationReady || !neighbors.length) return [];

    return neighbors.map((n) => {
      let weight = 0.5;
      const value = n[selectedMetric];
      
      if (value !== null && value !== undefined) {
        if (selectedMetric === 'rsrp') {
          weight = Math.max(0.1, Math.min(1, (value + 140) / 100));
        } else if (selectedMetric === 'rsrq') {
          weight = Math.max(0.1, Math.min(1, (value + 20) / 20));
        } else if (selectedMetric === 'sinr') {
          weight = Math.max(0.1, Math.min(1, (value + 10) / 40));
        }
      }

      return {
        location: new window.google.maps.LatLng(n.lat, n.lng),
        weight,
      };
    });
  }, [neighbors, useHeatmap, isVisualizationReady, selectedMetric]);

  const gradient = useMemo(() => [
    'rgba(0, 0, 0, 0)',
    'rgba(255, 0, 0, 0.6)',
    'rgba(255, 128, 0, 0.7)',
    'rgba(255, 200, 0, 0.8)',
    'rgba(128, 255, 0, 0.8)',
    'rgba(0, 255, 0, 0.9)',
  ], []);

  const handleClick = useCallback((neighbor) => {
    setSelectedNeighbor(neighbor);
    onNeighborClick?.(neighbor);
  }, [onNeighborClick]);

  // Don't render if disabled or no data
  if (!showNeighbors || neighbors.length === 0) {
    return null;
  }

  return (
    <>
      {/* Heatmap */}
      {useHeatmap && isVisualizationReady && heatmapData.length > 0 && (
        <HeatmapLayer
          data={heatmapData}
          options={{
            radius,
            opacity,
            gradient,
            maxIntensity: 10,
            dissipating: true,
          }}
        />
      )}

      {/* Circles (when heatmap off) */}
      {!useHeatmap && neighbors.map((n, idx) => (
        <Circle
          key={n.id || idx}
          center={{ lat: n.lat, lng: n.lng }}
          radius={n.isCollision ? 40 : 25}
          options={{
            fillColor: n.isCollision ? '#FF0000' : n.color,
            fillOpacity: n.isCollision ? 0.5 : 0.7,
            strokeColor: n.isCollision ? '#FF0000' : n.color,
            strokeWeight: n.isCollision ? 3 : 2,
            clickable: true,
            zIndex: n.isCollision ? 300 : 200,
          }}
          onClick={() => handleClick(n)}
        />
      ))}

      {/* Info Window */}
      {selectedNeighbor && (
        <InfoWindow
          position={{ lat: selectedNeighbor.lat, lng: selectedNeighbor.lng }}
          onCloseClick={() => setSelectedNeighbor(null)}
        >
          <div className="p-2 min-w-[160px]">
            <div className="font-bold text-sm mb-2 pb-1 border-b flex items-center gap-2">
              <span 
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: selectedNeighbor.color }}
              />
              PCI: {selectedNeighbor.pci}
              {selectedNeighbor.isCollision && (
                <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">
                  COLLISION
                </span>
              )}
            </div>
            
            <div className="text-xs space-y-1">
              {selectedNeighbor.cell_id && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Cell ID:</span>
                  <span>{selectedNeighbor.cell_id}</span>
                </div>
              )}
              {selectedNeighbor.rsrp !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">RSRP:</span>
                  <span style={{ color: getRSRPColor(selectedNeighbor.rsrp) }}>
                    {selectedNeighbor.rsrp} dBm
                  </span>
                </div>
              )}
              {selectedNeighbor.rsrq !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">RSRQ:</span>
                  <span>{selectedNeighbor.rsrq} dB</span>
                </div>
              )}
              {selectedNeighbor.sinr !== null && (
                <div className="flex justify-between">
                  <span className="text-gray-500">SINR:</span>
                  <span>{selectedNeighbor.sinr} dB</span>
                </div>
              )}
              {selectedNeighbor.band && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Band:</span>
                  <span>{selectedNeighbor.band}</span>
                </div>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
});

NeighborHeatmapLayer.displayName = 'NeighborHeatmapLayer';

export default NeighborHeatmapLayer;