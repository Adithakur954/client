// src/components/MapwithMultipleCircle.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { GoogleMap, PolygonF, RectangleF } from "@react-google-maps/api";
import { getColorForMetric } from "../utils/metrics";
import { mapViewApi } from "../api/apiEndpoints";
import CanvasOverlay from "./maps/CanvasOverlay";
import { ArrowDown, X } from "lucide-react";

const DEFAULT_CENTER = { lat: 28.64453086, lng: 77.37324242 };

// Color schemes for categorical coloring
const COLOR_SCHEMES = {
  provider: {
    JIO: "#3B82F6", "Jio True5G": "#3B82F6", "JIO 4G": "#3B82F6",
    Airtel: "#EF4444", "IND Airtel": "#EF4444", "IND airtel": "#EF4444",
    "VI India": "#22C55E", "Vi India": "#22C55E",
    BSNL: "#F59E0B", Unknown: "#6B7280",
  },
  technology: {
    "5G": "#EC4899", "NR (5G)": "#EC4899", "4G": "#8B5CF6", "LTE (4G)": "#8B5CF6",
    "3G": "#10B981", "2G": "#6B7280", Unknown: "#F59E0B",
  },
  band: {
    "3": "#EF4444", "5": "#F59E0B", "8": "#10B981", "40": "#3B82F6",
    "41": "#8B5CF6", n28: "#EC4899", n78: "#F472B6", Unknown: "#6B7280",
  },
};

// Aggregation methods
const AGGREGATION_METHODS = {
  median: (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  mean: (values) => values.reduce((a, b) => a + b, 0) / values.length,
  min: (values) => Math.min(...values),
  max: (values) => Math.max(...values),
  sum: (values) => values.reduce((a, b) => a + b, 0),
  count: (values) => values.length,
};

// Utility functions
const getColorByScheme = (location, colorBy) => {
  if (!colorBy) return null;
  const scheme = COLOR_SCHEMES[colorBy];
  if (!scheme) return null;
  const value = location[colorBy];
  return scheme[value] || scheme["Unknown"] || "#6B7280";
};

const parseWKTToPolygons = (wkt) => {
  if (!wkt?.trim()) return [];
  try {
    const match = wkt.trim().match(/POLYGON\s*\(\(([^)]+)\)\)/i);
    if (!match) return [];
    const points = match[1].split(",").reduce((acc, coord) => {
      const [lng, lat] = coord.trim().split(/\s+/).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) acc.push({ lat, lng });
      return acc;
    }, []);
    return points.length >= 3 ? [points] : [];
  } catch {
    return [];
  }
};

const getPolygonBounds = (path) => {
  if (!path?.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const p of path) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { north: maxLat, south: minLat, east: maxLng, west: minLng };
};

// Optimized point-in-polygon check with bbox pre-filter
const isPointInPolygon = (point, path, bbox) => {
  // Quick bbox check first
  if (bbox) {
    if (point.lat < bbox.south || point.lat > bbox.north || 
        point.lng < bbox.west || point.lng > bbox.east) {
      return false;
    }
  }
  
  // Ray casting algorithm
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const xi = path[i].lng, yi = path[i].lat;
    const xj = path[j].lng, yj = path[j].lat;
    if (yi > point.lat !== yj > point.lat && 
        point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
};

// Check if point is inside ANY polygon
const isPointInsideAnyPolygon = (point, polygonData) => {
  if (!polygonData?.length) return true; // No polygons = all points valid
  return polygonData.some(({ path, bbox }) => isPointInPolygon(point, path, bbox));
};

// Batch filter locations for performance
const filterLocationsInsidePolygons = (locations, polygonData) => {
  if (!locations?.length) return [];
  if (!polygonData?.length) return locations; // No polygons = return all
  
  return locations.filter(loc => {
    // Validate coordinates
    if (typeof loc.lat !== 'number' || typeof loc.lng !== 'number') return false;
    if (isNaN(loc.lat) || isNaN(loc.lng)) return false;
    
    return isPointInsideAnyPolygon(loc, polygonData);
  });
};

// Grid generation
const generateGridCells = (
  polygonData, 
  gridSizeMeters, 
  locations, 
  metric, 
  thresholds,
  aggregationMethod = 'median'
) => {
  if (!polygonData?.length || !locations?.length) return [];

  let globalBounds = null;
  for (const { bbox } of polygonData) {
    if (!bbox) continue;
    if (!globalBounds) {
      globalBounds = { ...bbox };
    } else {
      globalBounds.north = Math.max(globalBounds.north, bbox.north);
      globalBounds.south = Math.min(globalBounds.south, bbox.south);
      globalBounds.east = Math.max(globalBounds.east, bbox.east);
      globalBounds.west = Math.min(globalBounds.west, bbox.west);
    }
  }
  if (!globalBounds) return [];

  const latDegPerMeter = 1 / 111320;
  const avgLat = (globalBounds.north + globalBounds.south) / 2;
  const lngDegPerMeter = 1 / (111320 * Math.cos((avgLat * Math.PI) / 180));
  const cellHeight = gridSizeMeters * latDegPerMeter;
  const cellWidth = gridSizeMeters * lngDegPerMeter;

  const cells = [];
  let cellId = 0;
  const aggregateFn = AGGREGATION_METHODS[aggregationMethod] || AGGREGATION_METHODS.median;

  for (let lat = globalBounds.south; lat < globalBounds.north; lat += cellHeight) {
    for (let lng = globalBounds.west; lng < globalBounds.east; lng += cellWidth) {
      const cellBounds = { 
        north: lat + cellHeight, 
        south: lat, 
        east: lng + cellWidth, 
        west: lng 
      };
      
      const centerLat = (cellBounds.north + cellBounds.south) / 2;
      const centerLng = (cellBounds.east + cellBounds.west) / 2;

      // Check if cell intersects with any polygon
      const intersects = polygonData.some(({ path, bbox }) => {
        if (bbox && (cellBounds.west > bbox.east || cellBounds.east < bbox.west ||
                     cellBounds.south > bbox.north || cellBounds.north < bbox.south)) {
          return false;
        }
        const points = [
          { lat: cellBounds.north, lng: cellBounds.west },
          { lat: cellBounds.north, lng: cellBounds.east },
          { lat: cellBounds.south, lng: cellBounds.west },
          { lat: cellBounds.south, lng: cellBounds.east },
          { lat: centerLat, lng: centerLng },
        ];
        return points.some(p => isPointInPolygon(p, path, bbox));
      });

      if (!intersects) continue;

      // Find locations in this cell
      const cellLocations = locations.filter(loc => 
        loc.lat >= cellBounds.south && 
        loc.lat < cellBounds.north &&
        loc.lng >= cellBounds.west && 
        loc.lng < cellBounds.east
      );

      const count = cellLocations.length;
      let aggregatedValue = null;
      let fillColor = "#E5E7EB";

      if (count > 0) {
        const values = cellLocations
          .map(l => l[metric])
          .filter(v => v != null && !isNaN(v));
        
        if (values.length > 0) {
          aggregatedValue = aggregateFn(values);
          
          const thresholdKey = { dl_tpt: "dl_thpt", ul_tpt: "ul_thpt" }[metric] || metric;
          const metricThresholds = thresholds?.[thresholdKey];
          
          if (metricThresholds?.length && aggregatedValue !== null) {
            for (const t of metricThresholds) {
              if (aggregatedValue >= parseFloat(t.min) && aggregatedValue <= parseFloat(t.max)) {
                fillColor = t.color;
                break;
              }
            }
          }
        }
      }

      cells.push({
        id: cellId++,
        bounds: cellBounds,
        count,
        aggregatedValue,
        fillColor,
      });
    }
  }

  return cells;
};

const containerStyle = { width: "100%", height: "100%" };

const MapWithMultipleCircles = ({
  isLoaded,
  loadError,
  locations = [],
  thresholds = {},
  selectedMetric = "rsrp",
  colorBy = null,
  activeMarkerIndex,
  onMarkerClick,
  options,
  center = DEFAULT_CENTER,
  defaultZoom = 14,
  fitToLocations = true,
  onLoad: onLoadProp,
  pointRadius = 5,
  children,
  projectId = null,
  polygonSource = "map",
  enablePolygonFilter = true,
  showPolygonBoundary = true,
  enableGrid = false,
  gridSizeMeters = 50,
  gridAggregationMethod = 'median',
  areaEnabled = false,
  showControls = true,
  showStats = true,
  enableOpacityControl = true,
}) => {
  const [map, setMap] = useState(null);
  const [opacity, setOpacity] = useState(0.8);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Polygon state
  const [polygonData, setPolygonData] = useState([]);
  const [polygonsFetched, setPolygonsFetched] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [dropButton, setDropButton] = useState(true);  

  // Fetch polygons
  useEffect(() => {
    const fetchPolygons = async () => {
      // If no project ID or polygon filter disabled, skip fetch
      if (!projectId) {
        console.log("📍 No projectId, skipping polygon fetch");
        setPolygonData([]);
        setPolygonsFetched(true);
        return;
      }

      if (!enablePolygonFilter) {
        console.log("📍 Polygon filter disabled, skipping fetch");
        setPolygonData([]);
        setPolygonsFetched(true);
        return;
      }

      try {
        console.log(`📍 Fetching polygons for project ${projectId}, source: ${polygonSource}`);
        const res = await mapViewApi.getProjectPolygonsV2(projectId, polygonSource);
        const items = res?.Data || res?.data?.Data || (Array.isArray(res) ? res : []);
        
        const allPaths = [];
        items.forEach(item => {
          const wkt = item.Wkt || item.wkt;
          if (wkt) {
            parseWKTToPolygons(wkt).forEach(path => {
              if (path.length >= 3) {
                allPaths.push({ 
                  path, 
                  bbox: getPolygonBounds(path),
                  id: item.Id || item.id 
                });
              }
            });
          }
        });
        
        console.log(`✅ Fetched ${allPaths.length} polygons`);
        setPolygonData(allPaths);
        setPolygonsFetched(true);
        setFetchError(null);
      } catch (err) {
        console.error("❌ Polygon fetch error:", err);
        setPolygonData([]);
        setPolygonsFetched(true);
        setFetchError(err.message);
      }
    };
    
    fetchPolygons();
  }, [projectId, polygonSource, enablePolygonFilter]);

  // Filter locations inside polygons
  const locationsToRender = useMemo(() => {
   

    // No locations
    if (!locations?.length) {
      console.log("⚠️ No locations to filter");
      console.groupEnd();
      return [];
    }

    // Polygon filter disabled - return all
    if (!enablePolygonFilter) {
      console.log("✅ Filter disabled, returning all locations");
      console.groupEnd();
      return locations;
    }

    // Polygons not yet fetched - wait (return empty to avoid showing points outside)
    if (!polygonsFetched) {
      console.log("⏳ Waiting for polygons to load...");
      console.groupEnd();
      return []; // Return empty while loading
    }

    // No polygons defined - return all locations
    if (polygonData.length === 0) {
      console.log("⚠️ No polygons found, returning all locations");
      console.groupEnd();
      return locations;
    }

    // Filter locations inside polygons
    const filtered = filterLocationsInsidePolygons(locations, polygonData);
    console.log(`✅ Filtered: ${filtered.length} inside / ${locations.length} total`);
    console.log(`📊 ${((filtered.length / locations.length) * 100).toFixed(1)}% of points inside polygon`);
    
    if (filtered.length === 0 && locations.length > 0) {
      console.warn("⚠️ All points filtered out! Check if polygon covers the data area.");
     
    }
    
    console.groupEnd();
    return filtered;
  }, [locations, polygonData, polygonsFetched, enablePolygonFilter]);

  // Generate grid cells (only for filtered locations)
  const gridCells = useMemo(() => {
    if (!enableGrid) return [];
    if (polygonData.length === 0) return [];
    if (locationsToRender.length === 0) return [];
    
    return generateGridCells(
      polygonData, 
      gridSizeMeters, 
      locationsToRender, 
      selectedMetric, 
      thresholds,
      gridAggregationMethod
    );
  }, [enableGrid, gridSizeMeters, polygonData, locationsToRender, selectedMetric, thresholds, gridAggregationMethod]);

  // Get color for a location point
  const getLocationColor = useCallback((loc) => {
    if (colorBy) return getColorByScheme(loc, colorBy);
    return getColorForMetric(selectedMetric, loc?.[selectedMetric], thresholds);
  }, [colorBy, selectedMetric, thresholds]);

  // Compute map center from filtered locations
  const computedCenter = useMemo(() => {
    // Use filtered locations if available, otherwise original
    const locs = locationsToRender.length > 0 ? locationsToRender : 
                 locations.length > 0 ? locations : null;
    
    if (!locs?.length) return center;
    
    const sum = locs.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), 
      { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / locs.length, lng: sum.lng / locs.length };
  }, [locationsToRender, locations, center]);

  // Map load handler
  const handleMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
    
    // Fit to filtered locations
    const locs = locationsToRender.length > 0 ? locationsToRender : locations;
    if (fitToLocations && locs?.length && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      locs.forEach(p => bounds.extend({ lat: p.lat, lng: p.lng }));
      mapInstance.fitBounds(bounds, 50);
    } else {
      mapInstance.setCenter(computedCenter);
      mapInstance.setZoom(defaultZoom);
    }
    
    onLoadProp?.(mapInstance);
  }, [locationsToRender, locations, fitToLocations, computedCenter, defaultZoom, onLoadProp]);

  const handleLocationClick = useCallback((index, loc) => {
    onMarkerClick?.(index, loc);
  }, [onMarkerClick]);

  if (loadError) {
    return (
      <div className="flex items-center justify-center w-full h-full text-red-500">
        Failed to load Google Maps
      </div>
    );
  }
  
  if (!isLoaded) return null;

  // Determine if we should show points
  const showPoints = !enableGrid && !areaEnabled;
  
  // Show loading state while fetching polygons (if filter is enabled)
  const isLoadingPolygons = enablePolygonFilter && !polygonsFetched && projectId;

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        onLoad={handleMapLoad}
        options={options}
        center={computedCenter}
        zoom={defaultZoom}
      >
        {/* Polygon boundaries */}
        {showPolygonBoundary && polygonData.map(({ path }, idx) => (
          <PolygonF
            key={`polygon-${idx}`}
            paths={path}
            options={{
              fillColor: "transparent",
              fillOpacity: 0,
              strokeColor: "#2563eb",
              strokeWeight: 2,
              strokeOpacity: 0.8,
              zIndex: 1,
            }}
          />
        ))}

        {/* Grid Cells */}
        {enableGrid && gridCells.map((cell) => (
          <RectangleF
            key={`grid-${cell.id}`}
            bounds={cell.bounds}
            options={{
              fillColor: cell.fillColor,
              fillOpacity: cell.count > 0 ? 0.7 : 0.2,
              strokeColor: "transparent",
              strokeWeight: 0,
              strokeOpacity: 0,
              zIndex: 2,
              clickable: true,
            }}
            onMouseOver={() => setHoveredCell(cell)}
            onMouseOut={() => setHoveredCell(null)}
          />
        ))}

        {/* Points - ONLY filtered locations inside polygon */}
        {showPoints && map && locationsToRender.length > 0 && (
          <CanvasOverlay
            map={map}
            locations={locationsToRender}
            getColor={getLocationColor}
            radius={pointRadius}
            opacity={opacity}
            selectedIndex={activeMarkerIndex}
            onClick={handleLocationClick}
          />
        )}

        {children}
      </GoogleMap>

      {/* Loading indicator for polygons */}
      {isLoadingPolygons && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-20 text-sm">
          <span className="animate-pulse">⏳ Loading polygon boundaries...</span>
        </div>
      )}

      {/* Grid Cell Tooltip */}
      {enableGrid && hoveredCell && (
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-20 min-w-[160px] text-xs">
          <div className="font-semibold text-gray-800 mb-2">Grid Cell</div>
          <div className="space-y-1">
            <div className="flex justify-between text-blue-600">
              <span>Logs:</span>
              <span className="font-bold">{hoveredCell.count}</span>
            </div>
            {hoveredCell.aggregatedValue !== null && (
              <div className="flex justify-between text-gray-600">
                <span>{gridAggregationMethod.charAt(0).toUpperCase() + gridAggregationMethod.slice(1)} {selectedMetric.toUpperCase()}:</span>
                <span className="font-medium">{hoveredCell.aggregatedValue.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats Badge */}
      {showStats && (
        <div className="absolute bottom-4 right-4 bg-white/90 px-3 py-1.5 rounded-lg shadow text-xs text-gray-600 z-10">
          {isLoadingPolygons ? (
            <span className="animate-pulse">⏳ Loading...</span>
          ) : enableGrid ? (
            <span>🔲 {gridCells.filter(c => c.count > 0).length} cells with data</span>
          ) : (
            <div className="flex flex-col">
              <span>📍 {locationsToRender.length.toLocaleString()} points inside polygon</span>
              {enablePolygonFilter && locations.length !== locationsToRender.length && (
                <span className="text-[10px] text-gray-400">
                  ({locations.length - locationsToRender.length} filtered out)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Controls Panel */}
      {showControls && !enableGrid && (
        <div className="absolute top-2 left-49 bg-white rounded-lg shadow-lg p-3 z-10 space-y-3">
          {!dropButton ? (<div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-600 font-medium">Opacity </span>
                <span className="text-xs font-semibold text-blue-600">{Math.round(opacity * 100)}%</span>
                <button onClick={() => setDropButton(!dropButton)}> <X /> </button>

              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={opacity * 100}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-24 h-2 bg-gray-200 rounded-lg cursor-pointer accent-blue-600"
              />
            </div>
            
          ):(<div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-600 font-medium">Opacity</span>
            <button onClick={() => setDropButton(!dropButton)}> <ArrowDown /> </button>
          </div>)}
          
          
        </div>
      )}

      {/* Grid Controls */}
      {showControls && enableGrid && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 z-10 space-y-2 min-w-[140px]">
          <div className="text-xs font-semibold text-gray-700 mb-2">Grid Info</div>
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-500">Size:</span>
              <span className="font-medium">{gridSizeMeters}m</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Method:</span>
              <span className="font-medium capitalize">{gridAggregationMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cells:</span>
              <span className="font-medium">{gridCells.length}</span>
            </div>
          </div>
        </div>
      )}

     
    </div>
  );
};

export default React.memo(MapWithMultipleCircles);