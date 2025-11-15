import React, { useMemo, useState, useCallback } from 'react';
import { Circle, InfoWindow } from '@react-google-maps/api';
import { getColorFromThresholds } from '../../utils/pciCollisionUtils';

// Helper function to validate coordinates
const isValidCoordinate = (lat, lng) => {
  return (
    lat != null &&
    lng != null &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

// Calculate distance between two coordinates in meters (Haversine formula)
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
};

// Generate a color for a PCI value (consistent color per PCI)
const getPCIColor = (pci) => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
    '#DDA0DD', '#98D8C8', '#FFD93D', '#6BCB77', '#4D96FF',
    '#FF6B9D', '#C44569', '#F8B195', '#F67280', '#355C7D',
    '#6C5CE7', '#A8E6CF', '#FFD3B6', '#FF8B94', '#A1C181',
    '#FCBAD3', '#AA96DA', '#8FCACA', '#FFFFD2', '#C7CEEA'
  ];

  // Use PCI as seed for consistent color selection
  const index = parseInt(pci) % colors.length;
  return colors[index];
};

const NeighborCollisionLayer = ({
  allNeighbors = [],
  showNeighbors = true,
  showCollisionsOnly = true,
  showAllPCIs = false,
  selectedMetric = 'rsrp',
  thresholds = [],
  onNeighborClick,
  proximityThreshold = 500, // Distance threshold in meters (default 500m)
}) => {
  const [selectedNeighbor, setSelectedNeighbor] = useState(null);

  // Process and detect collisions based on proximity, same PCI, different cell ID
  const { displayNeighbors, pciGroups, collisionPCIs } = useMemo(() => {
    // First, validate coordinates
    const validNeighbors = allNeighbors.filter(n => {
      const lat = parseFloat(n.lat);
      const lng = parseFloat(n.lng || n.lon);

      if (!isValidCoordinate(lat, lng)) {
        console.warn('Invalid coordinates for neighbor:', n.id, { lat: n.lat, lng: n.lng || n.lon });
        return false;
      }
      
      n.validLat = lat;
      n.validLng = lng;
      return true;
    });

    // Detect collisions: nearby cells with same PCI but different cell IDs
    const collisionPCISet = new Set();
    const collisionCellIds = new Map(); // Track which cells are in collision

    // Compare each cell with every other cell
    for (let i = 0; i < validNeighbors.length; i++) {
      for (let j = i + 1; j < validNeighbors.length; j++) {
        const cell1 = validNeighbors[i];
        const cell2 = validNeighbors[j];

        // Check if they have the same PCI but different cell IDs
        if (cell1.pci === cell2.pci && cell1.id !== cell2.id) {
          // Calculate distance between them
          const distance = calculateDistance(
            cell1.validLat,
            cell1.validLng,
            cell2.validLat,
            cell2.validLng
          );

          // If they're within proximity threshold, it's a collision
          if (distance <= proximityThreshold) {
            collisionPCISet.add(cell1.pci);
            
            // Track collision info for both cells
            if (!collisionCellIds.has(cell1.id)) {
              collisionCellIds.set(cell1.id, {
                collidingWith: [],
                pci: cell1.pci
              });
            }
            if (!collisionCellIds.has(cell2.id)) {
              collisionCellIds.set(cell2.id, {
                collidingWith: [],
                pci: cell2.pci
              });
            }

            collisionCellIds.get(cell1.id).collidingWith.push({
              id: cell2.id,
              distance: Math.round(distance)
            });
            collisionCellIds.get(cell2.id).collidingWith.push({
              id: cell1.id,
              distance: Math.round(distance)
            });
          }
        }
      }
    }

    // Mark cells that are in collision
    validNeighbors.forEach(neighbor => {
      if (collisionCellIds.has(neighbor.id)) {
        neighbor.isCollision = true;
        const collisionInfo = collisionCellIds.get(neighbor.id);
        neighbor.collidingWith = collisionInfo.collidingWith;
        neighbor.collisionCount = collisionInfo.collidingWith.length;
      } else {
        neighbor.isCollision = false;
        neighbor.collidingWith = [];
        neighbor.collisionCount = 0;
      }
    });

    // Group by PCI for statistics
    const groups = new Map();
    validNeighbors.forEach(neighbor => {
      const pci = neighbor.pci;
      if (!groups.has(pci)) {
        groups.set(pci, []);
      }
      groups.get(pci).push(neighbor);
    });

    // Filter based on display preferences
    let filtered = validNeighbors;

    if (showCollisionsOnly && !showAllPCIs) {
      // Show only neighbors that are part of PCI collisions
      filtered = validNeighbors.filter(n => n.isCollision);
    } else if (!showAllPCIs) {
      // Show all neighbors
      filtered = validNeighbors;
    }

    return {
      displayNeighbors: filtered,
      pciGroups: groups,
      collisionPCIs: collisionPCISet
    };
  }, [allNeighbors, showCollisionsOnly, showAllPCIs, proximityThreshold]);

  // Stable click handler
  const handleCircleClick = useCallback(neighbor => {
    setSelectedNeighbor(neighbor);
    onNeighborClick?.(neighbor);
  }, [onNeighborClick]);

  // Build circles with PCI-based coloring
  const neighborCircles = useMemo(() => {
    if (!showNeighbors || displayNeighbors.length === 0) return null;

    return displayNeighbors.map((neighbor, idx) => {
      const position = { 
        lat: neighbor.validLat, 
        lng: neighbor.validLng 
      };

      // Determine circle styling based on collision status
      let fillColor, fillOpacity, zIndex;
      
      if (neighbor.isCollision) {
        // Collision points: BLACK only
        fillColor = '#000000';
        fillOpacity = 0.8;
        zIndex = 300 + (neighbor.collisionCount || 0); // Higher z-index for collisions
      } else {
        // Non-collision points: Use metric-based coloring or PCI color
        const metricValue = parseFloat(neighbor[selectedMetric]);
        fillColor = getColorFromThresholds(metricValue, thresholds) || getPCIColor(neighbor.pci);
        fillOpacity = 0.6;
        zIndex = 200;
      }

      // Size based on collision status
      const radius = neighbor.isCollision ? 35 : 25;

      return (
        <Circle
          key={`neighbor-${neighbor.id}-${idx}`}
          center={position}
          radius={radius}
          options={{
            fillColor,
            fillOpacity,
            strokeColor: 'transparent',
            strokeWeight: 0,
            strokeOpacity: 0,
            clickable: true,
            zIndex,
          }}
          onClick={() => handleCircleClick(neighbor)}
        />
      );
    });
  }, [
    displayNeighbors,
    showNeighbors,
    selectedMetric,
    thresholds,
    handleCircleClick,
  ]);

  // Summary info component
  const CollisionSummary = () => {
    if (collisionPCIs.size === 0) return null;

    return (
      <div className="absolute top-4 left-4 bg-white shadow-lg rounded-lg p-3 z-50 max-w-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 bg-black rounded-full animate-pulse" />
          <span className="font-semibold text-sm">
            PCI Collisions Detected: {collisionPCIs.size}
          </span>
        </div>
        <div className="text-xs text-gray-600 space-y-1">
          <div>Total collision cells: {displayNeighbors.filter(n => n.isCollision).length}</div>
          <div>Affected PCIs: {Array.from(collisionPCIs).join(', ')}</div>
          <div className="text-xs text-gray-500 mt-1">
            Detection range: {proximityThreshold}m
          </div>
        </div>
        {!showCollisionsOnly && (
          <div className="mt-2 text-xs text-blue-600">
            Showing all neighbors (collision + normal)
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Optional summary overlay */}
      {collisionPCIs.size > 0 && <CollisionSummary />}

      {/* Render circles */}
      {neighborCircles}

      {/* Info window for selected neighbor */}
      {selectedNeighbor && selectedNeighbor.validLat && selectedNeighbor.validLng && (
        <InfoWindow
          position={{ lat: selectedNeighbor.validLat, lng: selectedNeighbor.validLng }}
          onCloseClick={() => setSelectedNeighbor(null)}
        >
          <div className="p-2 max-w-xs">
            <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: selectedNeighbor.isCollision ? '#000000' : getPCIColor(selectedNeighbor.pci) }}
              />
              PCI: {selectedNeighbor.pci}
              {selectedNeighbor.isCollision && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded ml-2">
                  COLLISION
                </span>
              )}
            </h3>

            <div className="space-y-1 text-sm">
              <p><span className="font-semibold">Cell ID:</span> {selectedNeighbor.id}</p>
              <p><span className="font-semibold">Band:</span> {selectedNeighbor.band}</p>
              <p>
                <span className="font-semibold">Primary:</span> {selectedNeighbor.primary_id}
                {' '} (PCI: {selectedNeighbor.primary_pci})
              </p>
              <p>
                <span className="font-semibold">Location:</span> 
                {' '}{selectedNeighbor.validLat.toFixed(6)}, {selectedNeighbor.validLng.toFixed(6)}
              </p>

              <div className="border-t pt-2 mt-2 space-y-1">
                <p><span className="font-semibold">RSRP:</span> {selectedNeighbor.rsrp} dBm</p>
                <p><span className="font-semibold">RSRQ:</span> {selectedNeighbor.rsrq} dB</p>
                <p><span className="font-semibold">SINR:</span> {selectedNeighbor.sinr} dB</p>
              </div>

              {selectedNeighbor.isCollision && (
                <div className="bg-red-50 border border-red-200 p-2 rounded mt-2">
                  <p className="text-red-700 text-xs font-semibold mb-1">
                    ⚠️ PCI Collision Detected
                  </p>
                  <p className="text-xs text-gray-700">
                    Same PCI ({selectedNeighbor.pci}) used by {selectedNeighbor.collisionCount + 1} nearby cells:
                  </p>
                  <ul className="text-xs text-gray-600 mt-1 space-y-0.5">
                    {selectedNeighbor.collidingWith?.map((collision, idx) => (
                      <li key={idx}>
                        • Cell {collision.id} ({collision.distance}m away)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

export default React.memo(NeighborCollisionLayer);