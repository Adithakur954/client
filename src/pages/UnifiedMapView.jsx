// src/pages/UnifiedMapView.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useJsApiLoader, Polygon } from "@react-google-maps/api";
import { toast } from "react-toastify";

import { mapViewApi, settingApi, areaBreakdownApi } from "../api/apiEndpoints";
import Spinner from "../components/common/Spinner";
import MapWithMultipleCircles from "../components/MapwithMultipleCircle";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";
import UnifiedMapSidebar from "@/components/unifiedMap/UnifiedMapSideBar.jsx";
import SiteMarkers from "@/components/SiteMarkers";
import NetworkPlannerMap from "@/components/unifiedMap/NetworkPlannerMap";
import { useSiteData } from "@/hooks/useSiteData";
import UnifiedHeader from "@/components/unifiedMap/unifiedMapHeader";
import UnifiedDetailLogs from "@/components/unifiedMap/UnifiedDetailLogs";
import MapLegend from "@/components/map/MapLegend";
import { useNeighborCollisions } from "@/hooks/useNeighborCollisions";
import NeighborHeatmapLayer from "@/components/unifiedMap/NeighborCollisionLayer";

const defaultThresholds = {
  rsrp: [],
  rsrq: [],
  sinr: [],
  dl_thpt: [],
  ul_thpt: [],
  mos: [],
  lte_bler: [],
};

const DEFAULT_CENTER = { lat: 28.64453086, lng: 77.37324242 };

const DEFAULT_COVERAGE_FILTERS = {
  rsrp: { enabled: false, threshold: -110 },
  rsrq: { enabled: false, threshold: -15 },
  sinr: { enabled: false, threshold: 0 },
};

const DEFAULT_DATA_FILTERS = {
  providers: [],
  bands: [],
  technologies: [],
};

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function parseWKTToPolygons(wkt) {
  if (!wkt?.trim()) {
    console.warn("❌ Empty or null WKT");
    return [];
  }

  try {
    const cleaned = wkt.trim();
    console.log("🔍 Parsing WKT:", cleaned.substring(0, 50) + "..."); // ✅ Debug log

    // Extract coordinates from POLYGON ((...)) or POLYGON((...))
    // Match pattern: POLYGON followed by optional space, then ((...))
    const polygonMatch = cleaned.match(/POLYGON\s*\(\(([^)]+)\)\)/i);

    if (!polygonMatch) {
      console.warn("❌ No POLYGON match found in:", cleaned.substring(0, 100));
      return [];
    }

    const coordsString = polygonMatch[1];
    console.log(
      "🔍 Extracted coords string:",
      coordsString.substring(0, 100) + "..."
    ); // ✅ Debug

    // Split by comma to get individual coordinate pairs
    const coordPairs = coordsString.split(",");
    console.log(`🔍 Found ${coordPairs.length} coordinate pairs`); // ✅ Debug

    const points = coordPairs.reduce((acc, coord) => {
      const parts = coord.trim().split(/\s+/);

      if (parts.length >= 2) {
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);

        if (!isNaN(lat) && !isNaN(lng)) {
          acc.push({ lat, lng });
        } else {
          console.warn("❌ Invalid coordinate:", coord);
        }
      }
      return acc;
    }, []);

    console.log(`✅ Parsed ${points.length} valid points:`, points.slice(0, 3)); // ✅ Debug first 3 points

    if (points.length >= 3) {
      return [{ paths: [points] }];
    } else {
      console.warn(`❌ Insufficient points (${points.length})`);
      return [];
    }
  } catch (error) {
    console.error("❌ WKT parsing error:", error);
    return [];
  }
}
function computeBbox(points) {
  if (!points?.length) return null;

  let north = -90,
    south = 90,
    east = -180,
    west = 180;

  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    if (pt.lat > north) north = pt.lat;
    if (pt.lat < south) south = pt.lat;
    if (pt.lng > east) east = pt.lng;
    if (pt.lng < west) west = pt.lng;
  }

  return { north, south, east, west };
}

const isPointInPolygon = (point, polygon) => {
  const path = polygon?.paths?.[0];
  if (!path || !path.length) return false;

  const px = point.lng;
  const py = point.lat;

  let inside = false;
  const len = path.length;

  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = path[i].lng;
    const yi = path[i].lat;
    const xj = path[j].lng;
    const yj = path[j].lat;

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};

function getColorFromValue(value, thresholds) {
  if (!thresholds || thresholds.length === 0) return "#999999";

  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    if (value >= threshold.min && value <= threshold.max) {
      return threshold.color;
    }
  }

  return "#999999";
}

function calculateMedian(values) {
  if (!values || values.length === 0) return null;

  // Sort values in ascending order
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    // Even number: average of two middle values
    return (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    // Odd number: middle value
    return sorted[mid];
  }
}

// Color schemes for categorical data
const PROVIDER_COLORS = {
  JIO: "#3B82F6",
    "Jio True5G": "#3B82F6",
    "JIO 4G": "#3B82F6",
    "JIO4G": "#3B82F6",
    "IND-JIO": "#3B82F6",
    "IND airtel": "#EF4444",
    "IND Airtel": "#EF4444",
    "airtel": "#EF4444",
    "Airtel 5G": "#EF4444",
    "VI India": "#22C55E",
    "Vi India": "#22C55E",
    "Vodafone IN": "#22C55E",
    BSNL: "#F59E0B",
    Unknown: "#6B7280",
};

const BAND_COLORS = {
   "3": "#EF4444",
    "5": "#F59E0B",
    "8": "#10B981",
    "40": "#3B82F6",
    "41": "#8B5CF6",
    "n28": "#EC4899",
    "n78": "#F472B6",
    "1": "#EF4444",
    "2": "#F59E0B",
    "7": "#10B781",
    Unknown: "#6B7280",
};

const TECHNOLOGY_COLORS = {
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
};

function getCategoricalColor(category, type) {
  const colorMap = {
    'provider': PROVIDER_COLORS,
    'band': BAND_COLORS,
    'technology': TECHNOLOGY_COLORS
  };
  
  const colors = colorMap[type] || {};
  return colors[category] || colors['default'] || '#6C757D';
}

// Calculate statistics for points grouped by category
// Calculate statistics for points grouped by category with metric averages
function calculateCategoryStats(points, category, metric) {
  if (!points || points.length === 0) return null;
  
  const grouped = {};
  
  points.forEach(point => {
    const value = String(point[category] || 'Unknown').trim();
    if (!grouped[value]) {
      grouped[value] = {
        count: 0,
        name: value,
        metricValues: [] // Store all metric values for this category
      };
    }
    grouped[value].count++;
    
    // Collect metric value if valid
    const metricValue = point[metric];
    if (metricValue !== null && metricValue !== undefined && !isNaN(metricValue)) {
      grouped[value].metricValues.push(parseFloat(metricValue));
    }
  });
  
  // Convert to array and calculate averages
  const stats = Object.values(grouped).map(stat => {
    const validValues = stat.metricValues.filter(v => !isNaN(v));
    
    let avgValue = null;
    if (validValues.length > 0) {
      avgValue = validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    }
    
    return {
      name: stat.name,
      count: stat.count,
      avgValue: avgValue,
      validCount: validValues.length
    };
  }).sort((a, b) => b.count - a.count); // Sort by count
  
  const total = points.length;
  
  // Add percentage
  stats.forEach(stat => {
    stat.percentage = ((stat.count / total) * 100).toFixed(1);
  });
  
  return {
    stats,
    dominant: stats[0], // Category with most points
    total
  };
}

// Hover tooltip component for area polygons
// Hover tooltip component for area polygons with metric averages
// Horizontal hover tooltip component for area polygons
// Compact horizontal hover tooltip with auto-expanding height
const AreaPolygonTooltip = ({ polygon, position, selectedMetric }) => {
  if (!polygon || !position) return null;

  const stats = polygon.categoryStats;
  
  // Helper to format metric values
  const formatMetricValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    return value.toFixed(1); // Reduced to 1 decimal for compactness
  };

  // Helper to get metric unit
  const getMetricUnit = (metric) => {
    const units = {
      'rsrp': 'dBm',
      'rsrq': 'dB',
      'sinr': 'dB',
      'dl_tpt': 'Mbps',
      'ul_tpt': 'Mbps',
      'mos': '',
      'lte_bler': '%',
      'pci': ''
    };
    return units[metric] || '';
  };

  const unit = getMetricUnit(selectedMetric);
  
  return (
    <div
      className="fixed z-[1000] bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg shadow-2xl border border-purple-400 dark:border-purple-600 p-2 w-[650px] max-w-[90vw]"
      style={{
        left: `${Math.min(position.x + 15, window.innerWidth - 670)}px`,
        top: `${Math.min(position.y - 10, window.innerHeight - 400)}px`,
        pointerEvents: 'none'
      }}
    >
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-1.5 pb-1.5 border-b border-purple-300 dark:border-purple-700">
        <div className="flex items-center gap-1.5">
          <div
            className="w-3 h-3 rounded border border-gray-400 shadow-sm flex-shrink-0"
            style={{ backgroundColor: polygon.fillColor }}
          />
          <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">
            {polygon.name}
          </span>
        </div>
        
        {/* Inline Summary */}
        <div className="flex items-center gap-2 text-[10px]">
          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded font-semibold text-blue-700 dark:text-blue-300">
            {polygon.pointCount} logs
          </span>
          {polygon.medianValue !== null && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 rounded font-semibold text-green-700 dark:text-green-300">
              {formatMetricValue(polygon.medianValue)} {unit}
            </span>
          )}
        </div>
      </div>

      {/* Horizontal Grid Layout */}
      <div className="grid grid-cols-3 gap-2">
        
        {stats?.provider && stats.provider.stats.length > 0 && (
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <span>📡</span>
              <span>Operators</span>
            </div>
            <div className="space-y-0.5">
              {stats.provider.stats.map((stat, idx) => (
                <div 
                  key={idx} 
                  className="bg-gray-50 dark:bg-gray-800/50 rounded px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getCategoricalColor(stat.name, 'provider') }}
                    />
                    <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
                      {stat.name}
                    </span>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                      {stat.percentage}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] pl-3.5">
                    <span className="text-gray-500 dark:text-gray-400">{stat.count}</span>
                    {stat.avgValue !== null && (
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {formatMetricValue(stat.avgValue)} {unit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bands Column */}
        {stats?.band && stats.band.stats.length > 0 && (
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <span>📶</span>
              <span>Bands</span>
            </div>
            <div className="space-y-0.5">
              {stats.band.stats.map((stat, idx) => (
                <div 
                  key={idx} 
                  className="bg-gray-50 dark:bg-gray-800/50 rounded px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getCategoricalColor(stat.name, 'band') }}
                    />
                    <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
                      B{stat.name}
                    </span>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                      {stat.percentage}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] pl-3.5">
                    <span className="text-gray-500 dark:text-gray-400">{stat.count}</span>
                    {stat.avgValue !== null && (
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {formatMetricValue(stat.avgValue)} {unit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Technology Column */}
        {stats?.technology && stats.technology.stats.length > 0 && (
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1 flex items-center gap-1">
              <span>🔧</span>
              <span>Tech</span>
            </div>
            <div className="space-y-0.5">
              {stats.technology.stats.map((stat, idx) => (
                <div 
                  key={idx} 
                  className="bg-gray-50 dark:bg-gray-800/50 rounded px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getCategoricalColor(stat.name, 'technology') }}
                    />
                    <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate flex-1">
                      {stat.name}
                    </span>
                    <span className="text-[9px] text-gray-500 dark:text-gray-400 font-medium">
                      {stat.percentage}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] pl-3.5">
                    <span className="text-gray-500 dark:text-gray-400">{stat.count}</span>
                    {stat.avgValue !== null && (
                      <span className="font-bold text-gray-700 dark:text-gray-300">
                        {formatMetricValue(stat.avgValue)} {unit}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const UnifiedMapView = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [locations, setLocations] = useState([]);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [predictionColorSettings, setPredictionColorSettings] = useState([]);
  const [polygons, setPolygons] = useState([]);

  const [isSideOpen, setIsSideOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("rsrp");
  const [ui, setUi] = useState({ basemapStyle: "roadmap" });
  const [viewport, setViewport] = useState(null);

  const [enableDataToggle, setEnableDataToggle] = useState(true);
  const [dataToggle, setDataToggle] = useState("sample");

  const [enableSiteToggle, setEnableSiteToggle] = useState(false);
  const [siteToggle, setSiteToggle] = useState("NoML");

  const [onlyInsidePolygons, setOnlyInsidePolygons] = useState(false);

  const [polygonSource, setPolygonSource] = useState("map");
  const [showPolygons, setShowPolygons] = useState(false);

  const [showSiteMarkers, setShowSiteMarkers] = useState(true);
  const [showSiteSectors, setShowSiteSectors] = useState(true);
  const [appSummary, setAppSummary] = useState({});
  const [logArea, setLogArea] = useState(null);
  const [colorBy, setColorBy] = useState(null);

  const [coverageHoleFilters, setCoverageHoleFilters] = useState(
    DEFAULT_COVERAGE_FILTERS
  );
  const [dataFilters, setDataFilters] = useState(DEFAULT_DATA_FILTERS);
  const [showNeighbors, setShowNeighbors] = useState(false);
  const [areaData, setAreaData] = useState([]);
  const [areaEnabled, setAreaEnabled] = useState(false);
  const [hoveredAreaPolygon, setHoveredAreaPolygon] = useState(null);
const [hoverPosition, setHoverPosition] = useState(null);

  const projectId = useMemo(() => {
    const param =
      searchParams.get("project_id") ?? searchParams.get("project") ?? "";
    return param ? Number(param) : null;
  }, [searchParams]);

  const sessionIds = useMemo(() => {
    const sessionParam =
      searchParams.get("sessionId") ?? searchParams.get("session");
    return sessionParam
      ? sessionParam
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id)
      : [];
  }, [searchParams]);

  const mapRef = useRef(null);
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const {
    siteData,
    loading: siteLoading,
    error: siteError,
    refetch: refetchSites,
    isEmpty: siteDataIsEmpty,
  } = useSiteData({
    enableSiteToggle,
    siteToggle,
    projectId,
    sessionIds,
    autoFetch: true,
  });

  const {
    allNeighbors,
    stats: neighborStats,
    loading: neighborLoading,
    refetch: refetchNeighbors,
  } = useNeighborCollisions({
    sessionIds,
    enabled: showNeighbors,
    selectedMetric,
  });

  const isLoading = loading || siteLoading;

  // Load thresholds
  useEffect(() => {
    const loadThresholds = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        const d = res?.Data;
        if (d) {
          setThresholds({
            rsrp: JSON.parse(d.rsrp_json || "[]"),
            rsrq: JSON.parse(d.rsrq_json || "[]"),
            sinr: JSON.parse(d.sinr_json || "[]"),
            dl_thpt: JSON.parse(d.dl_thpt_json || "[]"),
            ul_thpt: JSON.parse(d.ul_thpt_json || "[]"),
            mos: JSON.parse(d.mos_json || "[]"),
            lte_bler: JSON.parse(d.lte_bler_json || "[]"),
          });
        }
      } catch (e) {
        console.error("Failed to load thresholds:", e);
      }
    };
    loadThresholds();
  }, []);

  // Load coverage hole thresholds
  useEffect(() => {
    const loadCoverageThresholds = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        if (res?.Data?.coveragehole_json) {
          const rsrpThreshold = parseFloat(res.Data.coveragehole_json);
          if (!isNaN(rsrpThreshold)) {
            setCoverageHoleFilters((prev) => ({
              ...prev,
              rsrp: { ...prev.rsrp, threshold: rsrpThreshold },
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load coverage hole threshold:", error);
      }
    };
    loadCoverageThresholds();
  }, []);

  const fetchAreaPolygons = useCallback(async () => {
    if (!projectId) {
      console.warn("No project ID for area polygons");
      setAreaData([]); // ✅ Set to empty array, not return
      return;
    }

    try {
     
      const res = await areaBreakdownApi.getAreaPolygons(projectId);

      let aiZones = [];

      if (res?.data?.ai_zones) {
        aiZones = res.data.ai_zones;
      } else if (res?.ai_zones) {
        aiZones = res.ai_zones;
      } else {
        console.warn("❌ No ai_zones found in response:", res);
        setAreaData([]);
        toast.info("No area zones available for this project");
        return;
      }

      if (aiZones.length === 0) {
       
        setAreaData([]);
        toast.info("No area zones defined for this project");
        return;
      }

      const parsed = [];

      for (let i = 0; i < aiZones.length; i++) {
        const zone = aiZones[i];
        const wktField = zone.geometry;

        if (!wktField) {
          console.warn(`❌ Zone ${zone.zone_id} has no geometry`);
          continue;
        }

        const polygonData = parseWKTToPolygons(wktField);

        if (polygonData.length === 0) {
          console.warn(`❌ WKT parsing failed for zone ${zone.zone_id}`);
          continue;
        }

        // ✅ Process first polygon (single POLYGON format)
        const p = polygonData[0];
        const bbox = computeBbox(p.paths[0]);

        const polygon = {
          id: zone.id,
          zoneId: zone.zone_id,
          name: `Zone ${zone.zone_id}`,
          projectId: zone.project_id,
          projectName: zone.project_name,
          source: "area",
          uid: `area-${zone.id}`,
          paths: p.paths,
          bbox: bbox,
          createdAt: zone.created_at,
        };

        parsed.push(polygon);
      }

      setAreaData(parsed);
      console.log(`✅ Loaded ${parsed.length} area polygon(s):`, parsed);
      toast.success(`${parsed.length} area zone(s) loaded`);
    } catch (error) {
      console.error("❌ AREA POLYGON FETCH ERROR:", error);
      toast.error(`Failed to load area polygons: ${error.message}`);
      setAreaData([]);
    }
  }, [projectId]);

  // Fetch polygons
  const fetchPolygons = useCallback(async () => {
    if (!projectId) return;

    try {
      const res = await mapViewApi.getProjectPolygonsV2(
        projectId,
        polygonSource
      );

      let items;
      if (Array.isArray(res)) {
        items = res;
      } else if (res?.data?.Data) {
        items = res.data.Data;
      } else if (res?.Data) {
        items = res.Data;
      } else if (res?.data) {
        items = Array.isArray(res.data) ? res.data : [];
      } else {
        items = [];
      }

      if (items.length === 0) {
        setPolygons([]);
        return;
      }

      const parsed = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const wktField = item.Wkt || item.wkt || item.WKT;

        if (!wktField) {
          console.warn(`❌ Item ${item.Id || item.id} has no WKT data`);
          continue;
        }

        const polygonData = parseWKTToPolygons(wktField);

        if (polygonData.length === 0) {
          console.warn(`❌ WKT parsing failed for item ${item.Id || item.id}`);
          continue;
        }

        for (let k = 0; k < polygonData.length; k++) {
          const p = polygonData[k];
          const bbox = computeBbox(p.paths[0]);

          const polygon = {
            id: item.Id || item.id,
            name: item.Name || item.name || `Polygon ${item.Id || item.id}`,
            source: polygonSource,
            uid: `${polygonSource}-${item.Id || item.id}-${k}`,
            paths: p.paths,
            bbox: bbox,
          };

          parsed.push(polygon);
        }
      }

      setPolygons(parsed);
      toast.success(`${parsed.length} polygon(s) loaded from ${polygonSource}`);
    } catch (error) {
      console.error("❌ POLYGON FETCH ERROR:", error);
      toast.error(
        `Failed to load polygons from ${polygonSource}: ${error.message}`
      );
      setPolygons([]);
    }
  }, [projectId, polygonSource]);

  // Polygon loading effect
  useEffect(() => {
    if (projectId && showPolygons) {
      fetchPolygons();
    } else if (!showPolygons) {
      setPolygons([]);
    }
  }, [projectId, showPolygons, polygonSource, fetchPolygons]);

  useEffect(() => {
    if (projectId && areaEnabled) {
      fetchAreaPolygons();
    } else {
      setAreaData([]);
    }
  }, [projectId, areaEnabled, fetchAreaPolygons]);

  // Fetch sample data
  const fetchSampleData = useCallback(async () => {
    if (sessionIds.length === 0) {
      toast.warn("No session ID provided for sample data");
      setLocations([]);
      setAppSummary({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const promises = sessionIds.map((sessionId) =>
        mapViewApi
          .getNetworkLog({ session_id: sessionId })
          .then((resp) => ({ sessionId, success: true, data: resp }))
          .catch((error) => ({
            sessionId,
            success: false,
            error: error.message,
          }))
      );

      const results = await Promise.allSettled(promises);

      const successfulSessions = results
        .filter(
          (result) => result.status === "fulfilled" && result.value.success
        )
        .map((result) => result.value);

      const failedSessions = results
        .filter(
          (result) => result.status === "fulfilled" && !result.value.success
        )
        .map((result) => result.value);

      

      if (failedSessions.length > 0) {
        console.warn("❌ Failed sessions:", failedSessions);
        failedSessions.forEach(({ sessionId, error }) => {
          console.error(`  Session ${sessionId}: ${error}`);
        });
      }

      // Extract app_summary
      const allAppSummaries = {};

      successfulSessions.forEach(({ sessionId, data }) => {
        if (data?.app_summary) {
          allAppSummaries[sessionId] = data.app_summary;
        }
      });

      setAppSummary(allAppSummaries);

      const indoorMode = {};

      successfulSessions.forEach(({ sessionId, data }) => {
        if (data?.io_summary) {
          indoorMode[sessionId] = data.io_summary;
        }
      });

      setLogArea(indoorMode);

      // Extract location data
      const allLogs = successfulSessions.flatMap(({ data }) => {
        if (Array.isArray(data)) return data;
        if (data?.data && Array.isArray(data.data)) return data.data;
        if (data?.Data && Array.isArray(data.Data)) return data.Data;
        console.warn("⚠️ Unexpected response format:", data);
        return [];
      });

      if (allLogs.length === 0) {
        if (failedSessions.length === sessionIds.length) {
          toast.error("All sessions failed to load");
        } else {
          toast.warn("No sample data found in successful sessions");
        }
        setLocations([]);
      } else {
        const formatted = allLogs
          .map((log) => {
            const lat = parseFloat(log.lat ?? log.Lat ?? log.latitude);
            const lng = parseFloat(
              log.lon ?? log.lng ?? log.Lng ?? log.longitude
            );

            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }

            // ✅ Convert to strings and handle undefined/null values
            const provider = String(log.provider || "").trim();
            const technology = String(
              log.network || log.technology || ""
            ).trim();
            const band = String(log.band || "").trim();

            return {
              lat,
              lng,
              radius: 18,
              timestamp: log.timestamp ?? log.time ?? log.created_at,
              rsrp: log.rsrp ?? log.RSRP ?? log.rsrp_dbm,
              rsrq: log.rsrq ?? log.RSRQ,
              sinr: log.sinr ?? log.SINR,
              dl_thpt: log.dl_thpt ?? log.dl_tpt ?? log.DL,
              ul_thpt: log.ul_thpt ?? log.ul_tpt ?? log.UL,
              mos: log.mos ?? log.MOS,
              lte_bler: log.lte_bler ?? log.LTE_BLER,
              operator: provider,
              technology: technology,
              provider: provider,
              band: band,
              jitter: log.jitter,
              pci: log.pci,
              speed: log.speed,
              nodebid: log.nodeb_id ?? log.nodebid,
              nodeb_id: log.nodeb_id ?? log.nodebid,
              apps: log.apps ?? log.app_name ?? "",
              mode: log.mode,
              radio: log.radio,
              latency: log.latency,
            };
          })
          .filter(Boolean);

        setLocations(formatted);

        const message =
          failedSessions.length > 0
            ? `${formatted.length} points loaded (${failedSessions.length} session(s) failed)`
            : `${formatted.length} points loaded from ${successfulSessions.length} session(s)`;

        toast.success(message, { autoClose: 4000 });
      }
    } catch (err) {
      console.error("Critical error fetching sample data:", err);
      toast.error(`Failed to fetch sample data: ${err.message}`);
      setError("Failed to load sample data");
    } finally {
      setLoading(false);
    }
  }, [sessionIds]);

  // Fetch prediction data
  const fetchPredictionData = useCallback(async () => {
    if (!projectId) {
      toast.warn("Please provide a project ID for prediction data");
      setLocations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await mapViewApi.getPredictionLog({
        projectId: Number(projectId),
        metric: String(selectedMetric).toUpperCase(),
      });

      if (res?.Status === 1 && res?.Data) {
        const dataList = res.Data.dataList || [];
        const colorSettings = res.Data.colorSetting || [];

        const formatted = dataList
          .map((point) => {
            const lat = parseFloat(point.lat);
            const lng = parseFloat(point.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            return {
              lat,
              lng,
              radius: 10,
              [selectedMetric]: point.prm,
              isPrediction: true,
              rawData: point,
            };
          })
          .filter(Boolean);

        setLocations(formatted);
        setPredictionColorSettings(colorSettings);

        toast.success(`${formatted.length} prediction points loaded`);
      } else {
        (" Prediction data fetch failed:", projectId, res);console.log
        toast.error(res?.Message || "No prediction data available");
        setLocations([]);
      }
    } catch (err) {
      console.error("Error fetching prediction data:", err);
      toast.error(`Failed to fetch prediction data: ${err.message}`);
      setError("Failed to load prediction data");
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedMetric]);

  // Main data fetching effect
  useEffect(() => {
    if (!enableDataToggle && !enableSiteToggle) {
      setLocations([]);
      setLoading(false);
      return;
    }

    if (enableDataToggle) {
      if (dataToggle === "sample") {
        fetchSampleData();
      } else {
        fetchPredictionData();
      }
    } else if (enableSiteToggle && siteToggle === "sites-prediction") {
      fetchPredictionData();
    } else if (!enableDataToggle) {
      setLocations([]);
    }
  }, [
    enableDataToggle,
    enableSiteToggle,
    dataToggle,
    siteToggle,
    fetchSampleData,
    fetchPredictionData,
  ]);

  // Debounced viewport setter
  const debouncedSetViewport = useMemo(
    () => debounce((vp) => setViewport(vp), 150),
    []
  );

  // Map load handler
  const handleMapLoad = useCallback(
    (map) => {
      mapRef.current = map;

      const updateViewport = () => {
        const bounds = map.getBounds();
        if (!bounds) return;

        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();

        debouncedSetViewport({
          north: ne.lat(),
          south: sw.lat(),
          east: ne.lng(),
          west: sw.lng(),
        });
      };

      const idleListener = map.addListener("idle", updateViewport);
      updateViewport();

      return () => {
        if (idleListener) idleListener.remove();
      };
    },
    [debouncedSetViewport]
  );

  const handleUIChange = useCallback((changes) => {
    setUi((prev) => ({ ...prev, ...changes }));
  }, []);

  // Reload all data
  const reloadData = useCallback(() => {
    if (enableSiteToggle) {
      refetchSites();
    }

    if (enableDataToggle) {
      if (dataToggle === "sample") {
        fetchSampleData();
      } else {
        fetchPredictionData();
      }
    } else if (enableSiteToggle && siteToggle === "sites-prediction") {
      fetchPredictionData();
    }

    if (projectId && showPolygons) {
      fetchPolygons();
    }

    // Add area polygon reload
    if (projectId && areaEnabled) {
      fetchAreaPolygons();
    }

    if (showNeighbors) {
      refetchNeighbors();
    }
  }, [
    enableDataToggle,
    enableSiteToggle,
    dataToggle,
    siteToggle,
    projectId,
    showPolygons,
    areaEnabled, // Add this
    fetchSampleData,
    fetchPredictionData,
    fetchPolygons,
    fetchAreaPolygons, // Add this
    refetchSites,
    showNeighbors,
    refetchNeighbors,
  ]);

  const handleSiteClick = useCallback((site) => {
    toast.info(`Site: ${site.site_id || site.SiteId || "Unknown"}`, {
      autoClose: 2000,
    });
  }, []);

  const handleSectorClick = useCallback((sector) => {
    const cellId = sector.cell_id ?? sector.CellId ?? "Unknown";
    const operator = sector.operator ?? sector.Operator ?? "Unknown";
    const azimuth = sector.azimuth ?? sector.Azimuth ?? "N/A";

    toast.info(`Cell: ${cellId}\nOperator: ${operator}\nAzimuth: ${azimuth}°`, {
      autoClose: 3000,
    });
  }, []);

  const handleNeighborClick = useCallback(
    (neighbor) => {
      toast.info(
        `PCI ${neighbor.pci} - Cell: ${
          neighbor.id
        }\n${selectedMetric.toUpperCase()}: ${neighbor[selectedMetric]}`,
        { autoClose: 3000 }
      );
    },
    [selectedMetric]
  );

  const effectiveThresholds = useMemo(() => {
    const usePredictionColors =
      (enableSiteToggle && siteToggle === "sites-prediction") ||
      (enableDataToggle &&
        dataToggle === "prediction" &&
        predictionColorSettings.length > 0);

    if (!usePredictionColors) {
      return thresholds;
    }

    const predictionThresholds = predictionColorSettings.map((setting) => ({
      min: parseFloat(setting.min),
      max: parseFloat(setting.max),
      color: setting.color,
    }));

    return {
      ...thresholds,
      [selectedMetric]: predictionThresholds,
    };
  }, [
    enableSiteToggle,
    enableDataToggle,
    siteToggle,
    dataToggle,
    predictionColorSettings,
    thresholds,
    selectedMetric,
  ]);

  // ✅ Extract unique filter options from locations
  const availableFilterOptions = useMemo(() => {
    if (locations.length === 0) {
      return {
        providers: [],
        bands: [],
        technologies: [],
      };
    }

    const providersSet = new Set();
    const bandsSet = new Set();
    const technologiesSet = new Set();

    locations.forEach((loc) => {
      const provider = String(loc.provider || "").trim();
      const band = String(loc.band || "").trim();
      const technology = String(loc.technology || "").trim();

      if (provider) providersSet.add(provider);
      if (band) bandsSet.add(band);
      if (technology) technologiesSet.add(technology);
    });

    const result = {
      providers: Array.from(providersSet).sort(),
      bands: Array.from(bandsSet).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a).localeCompare(String(b));
      }),
      technologies: Array.from(technologiesSet).sort(),
    };

    console.log("📊 Available filter options:", result);
    return result;
  }, [locations]);

  const polygonsWithColors = useMemo(() => {
    if (
      !onlyInsidePolygons ||
      !showPolygons ||
      polygons.length === 0 ||
      locations.length === 0
    ) {
      return polygons.map((poly) => ({
        ...poly,
        fillColor: "#4285F4",
        fillOpacity: 0.35,
        pointCount: 0,
        avgValue: null,
      }));
    }

    const currentThresholds = effectiveThresholds[selectedMetric] || [];

    return polygons.map((poly) => {
      const pointsInside = locations.filter((point) =>
        isPointInPolygon(point, poly)
      );

      if (pointsInside.length === 0) {
        return {
          ...poly,
          fillColor: "#cccccc",
          fillOpacity: 0.3,
          pointCount: 0,
          avgValue: null,
        };
      }

      const values = pointsInside
        .map((point) => point[selectedMetric])
        .filter((val) => val !== null && val !== undefined && !isNaN(val));

      if (values.length === 0) {
        return {
          ...poly,
          fillColor: "#cccccc",
          fillOpacity: 0.3,
          pointCount: pointsInside.length,
          avgValue: null,
        };
      }

      const avgValue =
        values.reduce((sum, val) => sum + val, 0) / values.length;
      const color = getColorFromValue(avgValue, currentThresholds);

      return {
        ...poly,
        fillColor: color,
        fillOpacity: 0.7,
        strokeWeight: 2,
        pointCount: pointsInside.length,
        avgValue: avgValue,
      };
    });
  }, [
    onlyInsidePolygons,
    showPolygons,
    polygons,
    locations,
    selectedMetric,
    effectiveThresholds,
  ]);

  // Area polygons with colors based on median metric values
  // Area polygons with colors based on median metric values OR categorical data
// const areaPolygonsWithColors = useMemo(() => {
//   if (!areaEnabled || !areaData || areaData.length === 0) {
//     return [];
//   }

//   // If no location data, return default styled polygons
//   if (!locations || locations.length === 0) {
//     return areaData.map((poly) => ({
//       ...poly,
//       fillColor: "#9333ea",
//       fillOpacity: 0.25,
//       pointCount: 0,
//       medianValue: null,
//       categoryStats: null,
//     }));
//   }

//   // Determine if we're using categorical coloring
//   const useCategoricalColoring = colorBy && ['provider', 'band', 'technology'].includes(colorBy);
  
//   // Use DEFAULT thresholds for metric-based coloring
//   const currentThresholds = thresholds[selectedMetric] || [];

//   console.log(`🎨 Coloring area polygons by: ${useCategoricalColoring ? colorBy : selectedMetric}`);

//   return areaData.map((poly) => {
//     // Find all points inside this polygon
//     const pointsInside = locations.filter((point) =>
//       isPointInPolygon(point, poly)
//     );

//     if (pointsInside.length === 0) {
//       // No points - gray color
//       return {
//         ...poly,
//         fillColor: "#cccccc",
//         fillOpacity: 0.3,
//         pointCount: 0,
//         medianValue: null,
//         categoryStats: null,
//       };
//     }

//     // Calculate category statistics (always, for hover tooltip)
//     const providerStats = calculateCategoryStats(pointsInside, 'provider', selectedMetric);
// const bandStats = calculateCategoryStats(pointsInside, 'band', selectedMetric);
// const technologyStats = calculateCategoryStats(pointsInside, 'technology', selectedMetric);

//     let fillColor;
//     let coloringInfo;

//     if (useCategoricalColoring) {
//       // COLOR BY CATEGORY (provider/band/technology)
//       const stats = colorBy === 'provider' ? providerStats :
//                     colorBy === 'band' ? bandStats :
//                     technologyStats;
      
//       if (stats && stats.dominant) {
//         fillColor = getCategoricalColor(stats.dominant.name, colorBy);
//         coloringInfo = `${stats.dominant.name} (${stats.dominant.percentage}%)`;
//       } else {
//         fillColor = "#cccccc";
//         coloringInfo = "No data";
//       }

//       console.log(
//         `🎨 Zone ${poly.zoneId}: ${pointsInside.length} points, ` +
//         `dominant ${colorBy}=${coloringInfo}, color=${fillColor}`
//       );
//     } else {
//       // COLOR BY METRIC VALUE (RSRP, SINR, etc.)
//       const values = pointsInside
//         .map((point) => point[selectedMetric])
//         .filter((val) => val !== null && val !== undefined && !isNaN(val));

//       if (values.length === 0) {
//         fillColor = "#cccccc";
//         coloringInfo = "No metric data";
//       } else {
//         const medianValue = calculateMedian(values);
//         fillColor = getColorFromValue(medianValue, currentThresholds);
//         coloringInfo = `Median ${selectedMetric}=${medianValue?.toFixed(2)}`;

//         console.log(
//           `🎨 Zone ${poly.zoneId}: ${pointsInside.length} points, ` +
//           `${values.length} valid values, ${coloringInfo}, color=${fillColor}`
//         );
//       }
//     }

//     return {
//       ...poly,
//       fillColor: fillColor,
//       fillOpacity: 0.7,
//       strokeWeight: 2.5,
//       pointCount: pointsInside.length,
//       medianValue: useCategoricalColoring ? null : calculateMedian(
//         pointsInside
//           .map((point) => point[selectedMetric])
//           .filter((val) => val !== null && val !== undefined && !isNaN(val))
//       ),
//       categoryStats: {
//         provider: providerStats,
//         band: bandStats,
//         technology: technologyStats,
//       },
//       coloringInfo,
//     };
//   });
// }, [
//   areaEnabled,
//   areaData,
//   locations,
//   selectedMetric,
//   thresholds,
//   colorBy, // Add this dependency
// ]);

  // ✅ Filter locations with coverage and data filters
  const filteredLocations = useMemo(() => {
    let result = locations;

    // Apply coverage hole filters
    const activeFilters = Object.entries(coverageHoleFilters).filter(
      ([_, config]) => config.enabled
    );

    if (activeFilters.length > 0 && result.length > 0) {
      const beforeCount = result.length;

      result = result.filter((location) => {
        return activeFilters.every(([metric, config]) => {
          const value = parseFloat(location[metric]);

          if (isNaN(value) || value === null || value === undefined) {
            return false;
          }

          return value < config.threshold;
        });
      });

      if (result.length > 0 && beforeCount !== result.length) {
        const filterDescriptions = activeFilters.map(
          ([metric, config]) => `${metric.toUpperCase()} < ${config.threshold}`
        );

        console.log(
          `🔍 ${
            result.length
          } coverage hole(s) found: ${filterDescriptions.join(" AND ")}`
        );
      }
    }

    // ✅ Apply provider filter with string comparison
    if (dataFilters.providers && dataFilters.providers.length > 0) {
      const beforeCount = result.length;
      result = result.filter((loc) => {
        const provider = String(loc.provider || "").trim();
        const match = dataFilters.providers.includes(provider);
        return match;
      });
      console.log(
        `🔍 Provider filter: ${beforeCount} → ${
          result.length
        } (filter: ${dataFilters.providers.join(", ")})`
      );
    }

    // ✅ Apply band filter with string comparison
    if (dataFilters.bands && dataFilters.bands.length > 0) {
      const beforeCount = result.length;
      result = result.filter((loc) => {
        const band = String(loc.band || "").trim();
        const match = dataFilters.bands.includes(band);
        return match;
      });
      console.log(
        `🔍 Band filter: ${beforeCount} → ${
          result.length
        } (filter: ${dataFilters.bands.join(", ")})`
      );
    }

    // ✅ Apply technology filter with string comparison
    if (dataFilters.technologies && dataFilters.technologies.length > 0) {
      const beforeCount = result.length;
      result = result.filter((loc) => {
        const technology = String(loc.technology || "").trim();
        const match = dataFilters.technologies.includes(technology);
        return match;
      });
      console.log(
        `🔍 Technology filter: ${beforeCount} → ${
          result.length
        } (filter: ${dataFilters.technologies.join(", ")})`
      );
    }

    if (onlyInsidePolygons && showPolygons && polygons.length > 0) {
      result = result.filter((point) =>
        polygons.some((poly) => isPointInPolygon(point, poly))
      );
    }

    return result;
  }, [
    locations,
    coverageHoleFilters,
    dataFilters,
    onlyInsidePolygons,
    showPolygons,
    polygons,
  ]);

  // Area polygons with colors based on median metric values OR categorical data
const areaPolygonsWithColors = useMemo(() => {
  if (!areaEnabled || !areaData || areaData.length === 0) {
    return [];
  }

  // ✅ CHANGED: Use filteredLocations instead of locations
  if (!filteredLocations || filteredLocations.length === 0) {
    return areaData.map((poly) => ({
      ...poly,
      fillColor: "#9333ea",
      fillOpacity: 0.25,
      pointCount: 0,
      medianValue: null,
      categoryStats: null,
    }));
  }

  // Determine if we're using categorical coloring
  const useCategoricalColoring = colorBy && ['provider', 'band', 'technology'].includes(colorBy);
  
  // Use DEFAULT thresholds for metric-based coloring
  const currentThresholds = thresholds[selectedMetric] || [];

  console.log(`🎨 Coloring area polygons by: ${useCategoricalColoring ? colorBy : selectedMetric}`);
  console.log(`🔍 Using ${filteredLocations.length} filtered points (from ${locations.length} total)`);

  return areaData.map((poly) => {
    // ✅ CHANGED: Find all FILTERED points inside this polygon
    const pointsInside = filteredLocations.filter((point) =>
      isPointInPolygon(point, poly)
    );

    if (pointsInside.length === 0) {
      // No points - gray color
      return {
        ...poly,
        fillColor: "#cccccc",
        fillOpacity: 0.3,
        pointCount: 0,
        medianValue: null,
        categoryStats: null,
      };
    }

    // Calculate category statistics (always, for hover tooltip)
    const providerStats = calculateCategoryStats(pointsInside, 'provider', selectedMetric);
    const bandStats = calculateCategoryStats(pointsInside, 'band', selectedMetric);
    const technologyStats = calculateCategoryStats(pointsInside, 'technology', selectedMetric);

    let fillColor;
    let coloringInfo;

    if (useCategoricalColoring) {
      // COLOR BY CATEGORY (provider/band/technology)
      const stats = colorBy === 'provider' ? providerStats :
                    colorBy === 'band' ? bandStats :
                    technologyStats;
      
      if (stats && stats.dominant) {
        fillColor = getCategoricalColor(stats.dominant.name, colorBy);
        coloringInfo = `${stats.dominant.name} (${stats.dominant.percentage}%)`;
      } else {
        fillColor = "#cccccc";
        coloringInfo = "No data";
      }

      console.log(
        `🎨 Zone ${poly.zoneId}: ${pointsInside.length} filtered points, ` +
        `dominant ${colorBy}=${coloringInfo}, color=${fillColor}`
      );
    } else {
      // COLOR BY METRIC VALUE (RSRP, SINR, etc.)
      const values = pointsInside
        .map((point) => point[selectedMetric])
        .filter((val) => val !== null && val !== undefined && !isNaN(val));

      if (values.length === 0) {
        fillColor = "#cccccc";
        coloringInfo = "No metric data";
      } else {
        const medianValue = calculateMedian(values);
        fillColor = getColorFromValue(medianValue, currentThresholds);
        coloringInfo = `Median ${selectedMetric}=${medianValue?.toFixed(2)}`;

        console.log(
          `🎨 Zone ${poly.zoneId}: ${pointsInside.length} filtered points, ` +
          `${values.length} valid values, ${coloringInfo}, color=${fillColor}`
        );
      }
    }

    return {
      ...poly,
      fillColor: fillColor,
      fillOpacity: 0.7,
      strokeWeight: 2.5,
      pointCount: pointsInside.length,
      medianValue: useCategoricalColoring ? null : calculateMedian(
        pointsInside
          .map((point) => point[selectedMetric])
          .filter((val) => val !== null && val !== undefined && !isNaN(val))
      ),
      categoryStats: {
        provider: providerStats,
        band: bandStats,
        technology: technologyStats,
      },
      coloringInfo,
    };
  });
}, [
  areaEnabled,
  areaData,
  filteredLocations, // ✅ CHANGED: Use filteredLocations instead of locations
  locations.length,  // ✅ ADD: For logging comparison
  selectedMetric,
  thresholds,
  colorBy,
  dataFilters, // ✅ ADD: Ensure recalculation when filters change
]);

  // ✅ Debug effect to log filter state
  useEffect(() => {
    if (
      dataFilters.bands?.length > 0 ||
      dataFilters.technologies?.length > 0 ||
      dataFilters.providers?.length > 0
    ) {
      console.log("🔍 Active Data Filters:", dataFilters);
      console.log("📊 Sample location:", locations[0]);
      console.log("📊 Available options:", availableFilterOptions);
      console.log(
        "📊 Filtered count:",
        filteredLocations.length,
        "/",
        locations.length
      );
    }
  }, [
    dataFilters,
    filteredLocations.length,
    locations.length,
    availableFilterOptions,
  ]);

  const activeCoverageFiltersCount = useMemo(() => {
    return Object.values(coverageHoleFilters).filter((f) => f.enabled).length;
  }, [coverageHoleFilters]);

  const activeCoverageFilterDesc = useMemo(() => {
    const active = Object.entries(coverageHoleFilters)
      .filter(([_, config]) => config.enabled)
      .map(
        ([metric, config]) => `${metric.toUpperCase()} < ${config.threshold}`
      );

    return active.join(", ");
  }, [coverageHoleFilters]);

  const activeDataFiltersCount = useMemo(() => {
    return (
      (dataFilters.providers?.length > 0 ? 1 : 0) +
      (dataFilters.bands?.length > 0 ? 1 : 0) +
      (dataFilters.technologies?.length > 0 ? 1 : 0)
    );
  }, [dataFilters]);

  // Visible polygons calculation
  const visiblePolygons = useMemo(() => {
    if (!showPolygons || polygonsWithColors.length === 0) {
      return [];
    }

    if (viewport) {
      const visible = polygonsWithColors.filter((poly) => {
        if (!poly.bbox) {
          return true;
        }

        const isVisible = !(
          poly.bbox.west > viewport.east ||
          poly.bbox.east < viewport.west ||
          poly.bbox.south > viewport.north ||
          poly.bbox.north < viewport.south
        );

        return isVisible;
      });

      return visible;
    }

    return polygonsWithColors;
  }, [showPolygons, polygonsWithColors, viewport]);

  // Map center calculation
  const mapCenter = useMemo(() => {
    if (locations.length === 0) return DEFAULT_CENTER;
    const { lat, lng } = locations.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: lat / locations.length, lng: lng / locations.length };
  }, [locations]);

  // Map options
  const mapOptions = useMemo(() => {
    const style = ["satellite", "hybrid", "terrain"].includes(ui.basemapStyle)
      ? ui.basemapStyle
      : "roadmap";
    return { mapTypeId: style };
  }, [ui.basemapStyle]);

  // Show data circles
  const showDataCircles =
    enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction");

  // Determine if legend should show
  const shouldShowLegend = useMemo(() => {
    return (
      enableDataToggle ||
      (enableSiteToggle && siteToggle === "sites-prediction")
    );
  }, [enableDataToggle, enableSiteToggle, siteToggle]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen text-red-500">
        Error loading map library.
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-800">
      <UnifiedHeader
        onToggleControls={() => setIsSideOpen(!isSideOpen)}
        onLeftToggle={() => setShowAnalytics(!showAnalytics)}
        isLeftOpen={false}
        isControlsOpen={isSideOpen}
        showAnalytics={showAnalytics}
        projectId={projectId}
        sessionIds={sessionIds}
      />

      {showAnalytics && (
        <UnifiedDetailLogs
          locations={filteredLocations}
          totalLocations={locations.length}
          filteredCount={filteredLocations.length}
          dataToggle={dataToggle}
          enableDataToggle={enableDataToggle}
          selectedMetric={selectedMetric}
          siteData={siteData}
          siteToggle={siteToggle}
          enableSiteToggle={enableSiteToggle}
          showSiteMarkers={showSiteMarkers}
          showSiteSectors={showSiteSectors}
          polygons={polygonsWithColors}
          visiblePolygons={visiblePolygons}
          polygonSource={polygonSource}
          showPolygons={showPolygons}
          onlyInsidePolygons={onlyInsidePolygons}
          coverageHoleFilters={coverageHoleFilters}
          viewport={viewport}
          mapCenter={mapCenter}
          projectId={projectId}
          sessionIds={sessionIds}
          isLoading={isLoading}
          thresholds={effectiveThresholds}
          appSummary={appSummary}
          logArea={logArea}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      <UnifiedMapSidebar
        open={isSideOpen}
        onOpenChange={setIsSideOpen}
        enableDataToggle={enableDataToggle}
        setEnableDataToggle={setEnableDataToggle}
        dataToggle={dataToggle}
        setDataToggle={setDataToggle}
        enableSiteToggle={enableSiteToggle}
        setEnableSiteToggle={setEnableSiteToggle}
        siteToggle={siteToggle}
        setSiteToggle={setSiteToggle}
        projectId={projectId}
        sessionIds={sessionIds}
        metric={selectedMetric}
        setMetric={setSelectedMetric}
        coverageHoleFilters={coverageHoleFilters}
        setCoverageHoleFilters={setCoverageHoleFilters}
        dataFilters={dataFilters}
        setDataFilters={setDataFilters}
        availableFilterOptions={availableFilterOptions}
        colorBy={colorBy}
        setColorBy={setColorBy}
        ui={ui}
        onUIChange={handleUIChange}
        showPolygons={showPolygons}
        setShowPolygons={setShowPolygons}
        polygonSource={polygonSource}
        setPolygonSource={setPolygonSource}
        onlyInsidePolygons={onlyInsidePolygons}
        setOnlyInsidePolygons={setOnlyInsidePolygons}
        polygonCount={polygons.length}
        showSiteMarkers={showSiteMarkers}
        setShowSiteMarkers={setShowSiteMarkers}
        showSiteSectors={showSiteSectors}
        setShowSiteSectors={setShowSiteSectors}
        loading={isLoading}
        reloadData={reloadData}
        showNeighbors={showNeighbors}
        setShowNeighbors={setShowNeighbors}
        neighborStats={neighborStats}
        areaEnabled={areaEnabled}
        setAreaEnabled={setAreaEnabled}
      />

      <div className="flex-grow rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden relative">
        {/* Info Panel */}
        <div className="absolute bottom-2 left-2 z-10 bg-white/90 dark:bg-gray-800/90 p-2 px-3 rounded text-xs text-gray-700 dark:text-gray-300 shadow-lg space-y-1 max-w-xs">
          {enableDataToggle && (
            <div className="font-semibold">
              {dataToggle === "sample" ? "Sample" : "Prediction"} Data
              {filteredLocations.length > 0 && (
                <span className="ml-1">
                  ({filteredLocations.length} points)
                </span>
              )}
            </div>
          )}

          {enableSiteToggle && (
            <div className="text-purple-600 dark:text-purple-400 font-semibold">
              Sites ({siteToggle})
              {!siteDataIsEmpty && (
                <span className="ml-1">({siteData.length} records)</span>
              )}
            </div>
          )}

          {activeCoverageFiltersCount > 0 && (
            <div className="text-red-600 dark:text-red-400 font-semibold">
              🔴 Coverage Holes ({activeCoverageFiltersCount} filter
              {activeCoverageFiltersCount > 1 ? "s" : ""})
              <div className="text-xs text-red-500 dark:text-red-300 mt-0.5">
                {activeCoverageFilterDesc}
              </div>
            </div>
          )}

          {activeDataFiltersCount > 0 && (
            <div className="text-blue-600 dark:text-blue-400 font-semibold">
              🔍 Data Filters ({activeDataFiltersCount} active)
              <div className="text-xs text-blue-500 dark:text-blue-300 mt-0.5">
                {dataFilters.providers?.length > 0 && (
                  <div>Providers: {dataFilters.providers.join(", ")}</div>
                )}
                {dataFilters.bands?.length > 0 && (
                  <div>Bands: {dataFilters.bands.join(", ")}</div>
                )}
                {dataFilters.technologies?.length > 0 && (
                  <div>Tech: {dataFilters.technologies.join(", ")}</div>
                )}
              </div>
            </div>
          )}

          {showPolygons && polygons.length > 0 && (
            <div className="text-blue-600 dark:text-blue-400 font-semibold">
              📐 {polygons.length} Polygons ({polygonSource})
              {onlyInsidePolygons && " - Heatmap Mode"}
            </div>
          )}

          {isLoading && (
            <div className="text-yellow-600 dark:text-yellow-400 animate-pulse">
              ⏳ Loading...
            </div>
          )}

          {showNeighbors && neighborStats && neighborStats.total > 0 && (
            <div className="text-blue-600 dark:text-blue-400 font-semibold">
              📡 {neighborStats.total} Neighbor Cells
              <div className="text-xs text-blue-500 dark:text-blue-300">
                {neighborStats.uniquePCIs} unique PCIs
              </div>
            </div>
          )}
        </div>

        {/* MAP LEGEND */}
        {shouldShowLegend && (
          <div>
            <div className="pointer-events-auto">
              <MapLegend
                thresholds={effectiveThresholds}
                selectedMetric={selectedMetric}
                colorBy={colorBy}
                showOperators={colorBy === "provider"}
                showBands={colorBy === "band"}
                showTechnologies={colorBy === "technology"}
                showSignalQuality={!colorBy || colorBy === "metric"}
                availableFilterOptions={availableFilterOptions}
              />
            </div>
          </div>
        )}

        {/* Map Container */}
        <div className="relative h-full w-full">
          {isLoading && locations.length === 0 && siteData.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <Spinner />
            </div>
          ) : error || siteError ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <div className="text-center space-y-2">
                {error && <p className="text-red-500">Data Error: {error}</p>}
                {siteError && (
                  <p className="text-red-500">
                    Site Error: {siteError.message}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <MapWithMultipleCircles
              isLoaded={isLoaded}
              loadError={loadError}
               locations={showDataCircles && !areaEnabled ? filteredLocations : []}
              thresholds={effectiveThresholds}
              selectedMetric={selectedMetric}
              colorBy={colorBy}
              activeMarkerIndex={null}
              onMarkerClick={() => {}}
              options={mapOptions}
              center={mapCenter}
              defaultZoom={13}
              fitToLocations={showDataCircles && filteredLocations.length > 0}
              onLoad={handleMapLoad}
              radiusMeters={24}
            >
              {showPolygons &&
                visiblePolygons.length > 0 &&
                visiblePolygons.map((poly) => {
                  return (
                    <Polygon
                      key={poly.uid}
                      paths={poly.paths[0]}
                      options={{
                        fillColor: poly.fillColor || "#4285F4",
                        fillOpacity: poly.fillOpacity || 0.35,
                        strokeColor: onlyInsidePolygons
                          ? poly.fillColor
                          : "#2563eb",
                        strokeWeight: poly.strokeWeight || 2,
                        strokeOpacity: 0.9,
                        clickable: true,
                        zIndex: 50,
                        visible: true,
                      }}
                      onClick={() => {
                        if (poly.avgValue !== null) {
                          toast.info(
                            `Polygon ${poly.name || poly.uid}: ${
                              poly.pointCount
                            } points, Avg ${selectedMetric.toUpperCase()}: ${poly.avgValue.toFixed(
                              2
                            )}`,
                            { autoClose: 3000 }
                          );
                        } else {
                          toast.info(`Polygon: ${poly.name || poly.uid}`, {
                            autoClose: 2000,
                          });
                        }
                      }}
                    />
                  );
                })}

              {/* Area Polygons - Dynamic Colors Based on Median */}
              {/* Area Polygons - With Hover Tooltip */}
{areaEnabled && areaPolygonsWithColors.length > 0 && (
  <>
    {areaPolygonsWithColors.map((poly) => {
      // Viewport filtering
      let isVisible = true;
      if (viewport && poly.bbox) {
        isVisible = !(
          poly.bbox.west > viewport.east ||
          poly.bbox.east < viewport.west ||
          poly.bbox.south > viewport.north ||
          poly.bbox.north < viewport.south
        );
      }

      if (!isVisible) return null;

      return (
        <Polygon
          key={poly.uid}
          paths={poly.paths[0]}
          options={{
            fillColor: poly.fillColor || "#9333ea",
            fillOpacity: poly.fillOpacity || 0.25,
            strokeColor: poly.fillColor || "#7c3aed",
            strokeWeight: poly.strokeWeight || 2.5,
            strokeOpacity: 0.9,
            clickable: true,
            zIndex: 60,
            visible: true,
          }}
          onMouseOver={(e) => {
            setHoveredAreaPolygon(poly);
            setHoverPosition({
              x: e.domEvent.clientX,
              y: e.domEvent.clientY
            });
          }}
          onMouseMove={(e) => {
            setHoverPosition({
              x: e.domEvent.clientX,
              y: e.domEvent.clientY
            });
          }}
          onMouseOut={() => {
            setHoveredAreaPolygon(null);
            setHoverPosition(null);
          }}
         onClick={() => {
  const stats = poly.categoryStats;
  let message = `📍 ${poly.name}\n`;
  message += `━━━━━━━━━━━━━━━━\n`;
  message += `📊 Total: ${poly.pointCount} logs\n`;
  
  if (poly.medianValue !== null) {
    message += `📈 Median ${selectedMetric.toUpperCase()}: ${poly.medianValue.toFixed(2)}\n`;
  }
  
  message += `\n`;
  
  if (stats?.provider?.dominant) {
    message += `🏆 Top Operator: ${stats.provider.dominant.name}\n`;
    message += `   └─ ${stats.provider.dominant.count} logs (${stats.provider.dominant.percentage}%)\n`;
    if (stats.provider.dominant.avgValue !== null) {
      message += `   └─ Avg ${selectedMetric.toUpperCase()}: ${stats.provider.dominant.avgValue.toFixed(2)}\n`;
    }
  }
  
  if (stats?.band?.dominant) {
    message += `\n📶 Top Band: ${stats.band.dominant.name}\n`;
    message += `   └─ ${stats.band.dominant.count} logs (${stats.band.dominant.percentage}%)\n`;
    if (stats.band.dominant.avgValue !== null) {
      message += `   └─ Avg ${selectedMetric.toUpperCase()}: ${stats.band.dominant.avgValue.toFixed(2)}\n`;
    }
  }

  toast.info(message, { 
    autoClose: 5000,
    style: { whiteSpace: 'pre-line' }
  });
}}
        />
      );
    })}
  </>
)}

              {enableSiteToggle && showSiteMarkers && (
                <SiteMarkers
                  sites={siteData}
                  showMarkers={showSiteMarkers}
                  circleRadius={0}
                  onSiteClick={handleSiteClick}
                  viewport={viewport}
                />
              )}

              {showNeighbors && allNeighbors && allNeighbors.length > 0 && (
                <NeighborHeatmapLayer
                  allNeighbors={allNeighbors}
                  showNeighbors={showNeighbors}
                  selectedMetric={selectedMetric}
                  thresholds={effectiveThresholds[selectedMetric] || []}
                  onNeighborClick={handleNeighborClick}
                />
              )}

              {enableSiteToggle && showSiteSectors && (
                <NetworkPlannerMap
                  defaultRadius={10}
                  scale={0.2}
                  showSectors={showSiteSectors}
                  onSectorClick={handleSectorClick}
                  viewport={viewport}
                  options={{ zIndex: 100 }}
                  projectId={projectId}
                  minSectors={3}
                  legendPosition="bottom-right" 
         
                />
              )}
            </MapWithMultipleCircles>
          )}
        </div>
      </div>
      {hoveredAreaPolygon && hoverPosition && (
        <AreaPolygonTooltip
          polygon={hoveredAreaPolygon}
          position={hoverPosition}
          selectedMetric={selectedMetric}
        />
      )}
    </div>
    
  );
};

export default UnifiedMapView;
