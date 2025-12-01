// src/components/MapwithMultipleCircle.jsx
import React, { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { GoogleMap, CircleF, PolygonF } from "@react-google-maps/api";
import { getColorForMetric } from "../utils/metrics";
import { mapViewApi } from "../api/apiEndpoints";

const DEFAULT_CENTER = { lat: 28.64453086, lng: 77.37324242 };

// Color schemes for provider, band, technology
const COLOR_SCHEMES = {
  provider: {
    JIO: "#3B82F6",
    "Jio True5G": "#3B82F6",
    "JIO 4G": "#3B82F6",
    "JIO4G": "#3B82F6",
    "IND-JIO": "#3B82F6",
    Airtel: "#EF4444",
    "IND Airtel": "#EF4444",
    "IND airtel": "#EF4444",
    "Airtel 5G": "#EF4444",
    "VI India": "#22C55E",
    "Vi India": "#22C55E",
    "Vodafone IN": "#22C55E",
    BSNL: "#F59E0B",
    Unknown: "#6B7280",
  },
  technology: {
    "5G": "#EC4899",
    "NR (5G)": "#EC4899",
    "NR (5G SA)": "#EC4899",
    "NR (5G NSA)": "#EC4899",
    "4G": "#8B5CF6",
    "LTE (4G)": "#8B5CF6",
    "3G": "#10B981",
    "2G": "#6B7280",
    "EDGE (2G)": "#6B7280",
    Unknown: "#F59E0B",
  },
  band: {
    "3": "#EF4444",
    "5": "#F59E0B",
    "8": "#10B981",
    "40": "#3B82F6",
    "41": "#8B5CF6",
    n28: "#EC4899",
    n78: "#F472B6",
    "1": "#EF4444",
    "2": "#F59E0B",
    "7": "#10B981",
    Unknown: "#6B7280",
  },
};

// Helper function to get color based on colorBy scheme
const getColorByScheme = (location, colorBy) => {
  if (!colorBy) return null;

  const scheme = COLOR_SCHEMES[colorBy];
  if (!scheme) return null;

  const value = location[colorBy];
  if (!value) return scheme["Unknown"] || "#6B7280";

  if (scheme[value]) return scheme[value];

  const lowerValue = String(value).toLowerCase();
  const matchKey = Object.keys(scheme).find(
    (key) => key.toLowerCase() === lowerValue
  );
  if (matchKey) return scheme[matchKey];

  return scheme["Unknown"] || "#6B7280";
};

// Parse WKT to polygon paths
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

// Ray casting algorithm to check if point is inside polygon
const isPointInPolygon = (point, polygonPath) => {
  if (!polygonPath?.length || polygonPath.length < 3) return false;

  let inside = false;
  const x = point.lng;
  const y = point.lat;

  for (let i = 0, j = polygonPath.length - 1; i < polygonPath.length; j = i++) {
    const xi = polygonPath[i].lng;
    const yi = polygonPath[i].lat;
    const xj = polygonPath[j].lng;
    const yj = polygonPath[j].lat;

    if (
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }

  return inside;
};

// Check if point is inside any polygon
const isPointInsideAnyPolygon = (point, allPolygonPaths) => {
  if (!allPolygonPaths?.length) return true; // No polygons = show all
  return allPolygonPaths.some((path) => isPointInPolygon(point, path));
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
  radiusMeters = 18,
  children,
  // Polygon props
  projectId = null,
  polygonSource = "map",
  enablePolygonFilter = true, // Enable/disable polygon filtering
  showPolygonBoundary = true, // Show polygon outline on map
}) => {
  const mapRef = useRef(null);
  const [opacity, setOpacity] = useState(1);
  const [showOpacityControl, setShowOpacityControl] = useState(false);

  // Polygon state
  const [polygonPaths, setPolygonPaths] = useState([]); // Array of polygon paths
  const [polygonLoading, setPolygonLoading] = useState(false);
  const [polygonError, setPolygonError] = useState(null);
  const [polygonsFetched, setPolygonsFetched] = useState(false);

  // Fetch polygons when component mounts or projectId changes
  useEffect(() => {
    const fetchPolygons = async () => {
      if (!projectId) {
        setPolygonPaths([]);
        setPolygonsFetched(true);
        return;
      }

      setPolygonLoading(true);
      setPolygonError(null);

      try {
        console.log(`🔄 Fetching polygons for project ${projectId}...`);
        const res = await mapViewApi.getProjectPolygonsV2(projectId, polygonSource);
        const items = res?.Data || res?.data?.Data || (Array.isArray(res) ? res : []);

        const allPaths = [];
        items.forEach((item) => {
          const wkt = item.Wkt || item.wkt;
          if (wkt) {
            const paths = parseWKTToPolygons(wkt);
            paths.forEach((path) => {
              if (path.length >= 3) {
                allPaths.push(path);
              }
            });
          }
        });

        setPolygonPaths(allPaths);
        setPolygonsFetched(true);
        console.log(`✅ Loaded ${allPaths.length} polygon(s) for filtering`);
      } catch (err) {
        console.error("❌ Failed to fetch polygons:", err);
        setPolygonError(err.message);
        setPolygonPaths([]);
        setPolygonsFetched(true);
      } finally {
        setPolygonLoading(false);
      }
    };

    fetchPolygons();
  }, [projectId, polygonSource]);

  // Filter locations - only show those inside polygon
  const locationsToRender = useMemo(() => {
    // If polygon filter is disabled, show all locations
    if (!enablePolygonFilter) {
      return locations;
    }

    // If no polygons loaded yet, don't render anything
    if (!polygonsFetched) {
      return [];
    }

    // If no polygons exist, show all locations
    if (polygonPaths.length === 0) {
      return locations;
    }

    // Filter: only keep locations inside any polygon
    const filtered = locations.filter((loc) => {
      const point = { lat: loc.lat, lng: loc.lng };
      return isPointInsideAnyPolygon(point, polygonPaths);
    });

    console.log(`📍 Rendering ${filtered.length}/${locations.length} locations inside polygon`);
    return filtered;
  }, [locations, polygonPaths, polygonsFetched, enablePolygonFilter]);

  // Compute center from filtered locations
  const computedCenter = useMemo(() => {
    const locs = locationsToRender.length > 0 ? locationsToRender : locations;
    if (!locs || locs.length === 0) return center;
    
    const sum = locs.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / locs.length, lng: sum.lng / locs.length };
  }, [locationsToRender, locations, center]);

  const handleMapLoad = useCallback(
    (map) => {
      mapRef.current = map;
      
      const locs = locationsToRender.length > 0 ? locationsToRender : locations;

      if (fitToLocations && locs && locs.length > 0 && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        locs.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, 50);
      } else {
        map.setCenter(computedCenter);
        map.setZoom(defaultZoom);
      }

      if (onLoadProp) {
        onLoadProp(map);
      }
    },
    [locationsToRender, locations, fitToLocations, computedCenter, defaultZoom, onLoadProp]
  );

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  const getLocationColor = useCallback(
    (loc) => {
      if (colorBy) {
        return getColorByScheme(loc, colorBy);
      }
      const value = loc?.[selectedMetric];
      return getColorForMetric(selectedMetric, value, thresholds);
    },
    [colorBy, selectedMetric, thresholds]
  );

  if (loadError) {
    return (
      <div className="flex items-center justify-center w-full h-full text-red-500">
        Failed to load Google Maps
      </div>
    );
  }

  if (!isLoaded) return null;

  // Calculate stats for display
  const outsideCount = locations.length - locationsToRender.length;
  const hasPolygonFilter = enablePolygonFilter && polygonPaths.length > 0;

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        onLoad={handleMapLoad}
        onUnmount={onUnmount}
        options={options}
        center={computedCenter}
        zoom={defaultZoom}
      >
        {/* Render polygon boundaries */}
        {showPolygonBoundary &&
          polygonPaths.map((path, idx) => (
            <PolygonF
              key={`polygon-boundary-${idx}`}
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

        {/* Render only locations that are INSIDE the polygon */}
        {locationsToRender.map((loc, idx) => {
          const color = getLocationColor(loc);
          const isActive = idx === activeMarkerIndex;
          const radius = loc.radius || radiusMeters;

          return (
            <CircleF
              key={`circle-${loc.lat}-${loc.lng}-${idx}`}
              center={{ lat: loc.lat, lng: loc.lng }}
              radius={radius}
              onClick={() => onMarkerClick?.(idx)}
              options={{
                fillColor: color,
                fillOpacity: opacity * 0.8,
                strokeColor: color,
                strokeOpacity: opacity,
                strokeWeight: isActive ? 2 : 1,
                zIndex: isActive ? 10 : 5,
                clickable: true,
              }}
            />
          );
        })}

        {children}
      </GoogleMap>

      {/* Polygon Filter Stats */}
      {enablePolygonFilter && (
        <div className="absolute top-4 left-4 bg-white/95 rounded-lg shadow-lg px-3 py-2 text-xs z-10 min-w-[200px]">
          {polygonLoading ? (
            <div className="flex items-center gap-2 text-yellow-600">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading polygons...
            </div>
          ) : polygonError ? (
            <div className="text-red-600">
              <span className="font-medium">Error:</span> {polygonError}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="font-semibold text-gray-800 flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                Polygon Filter
              </div>
              
              {polygonPaths.length > 0 ? (
                <>
                  <div className="text-gray-600">
                    <span className="text-green-600 font-medium">{polygonPaths.length}</span> polygon(s) active
                  </div>
                  <div className="border-t pt-1 mt-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Total logs:</span>
                      <span className="font-medium">{locations.length}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Inside polygon:</span>
                      <span className="font-medium">{locationsToRender.length}</span>
                    </div>
                    <div className="flex justify-between text-red-500">
                      <span>Outside (hidden):</span>
                      <span className="font-medium">{outsideCount}</span>
                    </div>
                  </div>
                  {outsideCount > 0 && (
                    <div className="text-[10px] text-gray-400 mt-1">
                      {((locationsToRender.length / locations.length) * 100).toFixed(1)}% of logs shown
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-500">
                  No polygons found - showing all {locations.length} logs
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Opacity Control */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg z-10">
        <button
          onClick={() => setShowOpacityControl(!showOpacityControl)}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
          title="Adjust circle opacity"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          Opacity
        </button>

        {showOpacityControl && (
          <div className="px-4 py-3 border-t border-gray-200 bg-white rounded-b-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Opacity Settings
              </span>
              <button
                onClick={() => setShowOpacityControl(false)}
                className="text-gray-500 hover:text-gray-700 transition"
                title="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={opacity * 100}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 min-w-[3rem]">
                {Math.round(opacity * 100)}%
              </span>
            </div>

            <div className="flex gap-1 mt-2">
              {[0.25, 0.5, 0.75, 1].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setOpacity(preset)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    opacity === preset
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset * 100}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapWithMultipleCircles;