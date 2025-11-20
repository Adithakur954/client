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

import { mapViewApi, settingApi } from "../api/apiEndpoints";
import Spinner from "../components/common/Spinner";
import MapWithMultipleCircles from "../components/MapwithMultipleCircle";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";
import UnifiedMapSidebar from "@/components/unifiedMap/UnifiedMapSideBar.jsx";
import SiteMarkers from "@/components/SiteMarkers";
import NetworkPlannerMap from "@/components/unifiedMap/NetworkPlannerMap";
import { useSiteData } from "@/hooks/useSiteData";
import UnifiedHeader from "@/components/unifiedMap/unifiedMapHeader";
import UnifiedDetailLogs from "@/components/unifiedMap/UnifiedDetailLogs";
import MapLegend from "@/components/MapLegend";
import { useNeighborCollisions } from '@/hooks/useNeighborCollisions';
import NeighborHeatmapLayer from '@/components/unifiedMap/NeighborCollisionLayer'; // ✅ Renamed import

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

// ✅ Default coverage hole filter values
const DEFAULT_COVERAGE_FILTERS = {
  rsrp: { enabled: false, threshold: -110 },
  rsrq: { enabled: false, threshold: -15 },
  sinr: { enabled: false, threshold: 0 }
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
    const isPolygon = cleaned.startsWith("POLYGON((");
    const isMultiPolygon = cleaned.startsWith("MULTIPOLYGON(((");

    if (!isPolygon && !isMultiPolygon) {
      console.warn("❌ Not a valid POLYGON or MULTIPOLYGON");
      return [];
    }

    const coordsMatches = cleaned.matchAll(/\(\(([\d\s,.-]+)\)\)/g);
    const polygons = [];

    for (const match of coordsMatches) {
      const coords = match[1];

      const points = coords.split(",").reduce((acc, coord) => {
        const [lng, lat] = coord.trim().split(/\s+/);
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);

        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          acc.push({ lat: parsedLat, lng: parsedLng });
        }
        return acc;
      }, []);

      if (points.length >= 3) {
        polygons.push({ paths: [points] });
      } else {
        console.warn(`   ❌ Insufficient points (${points.length})`);
      }
    }

    return polygons;
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

function canonicalOperatorName(raw) {
  if (!raw && raw !== 0) return "Unknown";
  let s = String(raw).trim();
  s = s.replace(/^IND[-\s]*/i, "");
  const lower = s.toLowerCase();
  if (lower === "//////" || lower === "404011") return "Unknown";
  if (lower.includes("jio")) return "JIO";
  if (lower.includes("airtel")) return "Airtel";
  if (lower.includes("vodafone") || lower.startsWith("vi"))
    return "Vi (Vodafone Idea)";
  return s;
}

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

const UnifiedMapView = () => {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [locations, setLocations] = useState([]);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [predictionColorSettings, setPredictionColorSettings] = useState([]);
  const [polygons, setPolygons] = useState([]);

  const [isSideOpen, setIsSideOpen] = useState(false);
  const [isLeftOpen, setIsLeftOpen] = useState(false);
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

  // ✅ Multi-metric coverage hole filters
  const [coverageHoleFilters, setCoverageHoleFilters] = useState(DEFAULT_COVERAGE_FILTERS);

  // ✅ Simplified: Only showNeighbors state (removed collision-related states)
  const [showNeighbors, setShowNeighbors] = useState(false);

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

  // ✅ Simplified hook usage - only extract what we need
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

  // ✅ Load coverage hole thresholds
  useEffect(() => {
    const loadCoverageThresholds = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        if (res?.Data?.coveragehole_json) {
          const rsrpThreshold = parseFloat(res.Data.coveragehole_json);
          if (!isNaN(rsrpThreshold)) {
            setCoverageHoleFilters(prev => ({
              ...prev,
              rsrp: { ...prev.rsrp, threshold: rsrpThreshold }
            }));
          }
        }
      } catch (error) {
        console.error("Failed to load coverage hole threshold:", error);
      }
    };
    loadCoverageThresholds();
  }, []);

  // Fetch polygons
  const fetchPolygons = useCallback(async () => {
    if (!projectId) {
      return;
    }

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
        mapViewApi.getNetworkLog({ session_id: sessionId })
          .then(resp => ({ sessionId, success: true, data: resp }))
          .catch(error => ({ sessionId, success: false, error: error.message }))
      );

      const results = await Promise.allSettled(promises);

      const successfulSessions = results
        .filter(result => result.status === 'fulfilled' && result.value.success)
        .map(result => result.value);

      const failedSessions = results
        .filter(result => result.status === 'fulfilled' && !result.value.success)
        .map(result => result.value);

      console.log(`✅ Successful sessions: ${successfulSessions.length}/${sessionIds.length}`);
      
      if (failedSessions.length > 0) {
        console.warn('❌ Failed sessions:', failedSessions);
        failedSessions.forEach(({ sessionId, error }) => {
          console.error(`  Session ${sessionId}: ${error}`);
        });
      }

      // ✅ Extract app_summary
      const allAppSummaries = {};
      
      successfulSessions.forEach(({ sessionId, data }) => {
        if (data?.app_summary) {
          console.log(data);
          allAppSummaries[sessionId] = data.app_summary;
        }
      });

      setAppSummary(allAppSummaries);

      const indoorMode = {};

      successfulSessions.forEach(({ sessionId, data }) => {
        if(data?.io_summary){
          console.log(data?.io_summary)
          indoorMode[sessionId] = data.io_summary;
        }
        })

        setLogArea(indoorMode);

      // ✅ Extract location data
      const allLogs = successfulSessions.flatMap(({ data }) => {
        if (Array.isArray(data)) return data;
        if (data?.data && Array.isArray(data.data)) return data.data;
        if (data?.Data && Array.isArray(data.Data)) return data.Data;
        console.warn(' Unexpected response format:', data);
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
            const lng = parseFloat(log.lon ?? log.lng ?? log.Lng ?? log.longitude);
            
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
              return null;
            }

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
              operator: canonicalOperatorName(log.operator_name),
              technology: log.network,
              provider: log.provider,
              band: log.band,
              jitter: log.jitter,
              pci: log.pci,
              speed: log.speed,
              nodebid: log.nodeb_id,
            };
          })
          .filter(Boolean);

        setLocations(formatted);
        
        const message = failedSessions.length > 0
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
        projectId,
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
    fetchSampleData,
    fetchPredictionData,
    fetchPolygons,
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

  // ✅ Simplified neighbor click handler (no collision info)
  const handleNeighborClick = useCallback((neighbor) => {
    toast.info(
      `PCI ${neighbor.pci} - Cell: ${neighbor.id}\n${selectedMetric.toUpperCase()}: ${neighbor[selectedMetric]}`,
      { autoClose: 3000 }
    );
  }, [selectedMetric]);

  
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

  const filteredLocations = useMemo(() => {
    let result = locations;

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

      if (result.length > 0) {
        const filterDescriptions = activeFilters.map(
          ([metric, config]) => `${metric.toUpperCase()} < ${config.threshold}`
        );
        
        toast.info(
          ` ${result.length} coverage hole(s) found:\n${filterDescriptions.join(' AND ')}`,
          { autoClose: 4000 }
        );
      } else if (beforeCount > 0) {
        toast.warn(
          `No coverage holes found matching all filter criteria`,
          { autoClose: 3000 }
        );
      }
    }

    if (onlyInsidePolygons && showPolygons && polygons.length > 0) {
      return [];
    }

    return result;
  }, [
    locations,
    coverageHoleFilters,
    onlyInsidePolygons,
    showPolygons,
    polygons.length,
  ]);

  const activeCoverageFiltersCount = useMemo(() => {
    return Object.values(coverageHoleFilters).filter(f => f.enabled).length;
  }, [coverageHoleFilters]);

  const activeCoverageFilterDesc = useMemo(() => {
    const active = Object.entries(coverageHoleFilters)
      .filter(([_, config]) => config.enabled)
      .map(([metric, config]) => `${metric.toUpperCase()} < ${config.threshold}`);
    
    return active.join(', ');
  }, [coverageHoleFilters]);

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
        isLeftOpen={isLeftOpen}
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
      />

      <div className="flex-grow rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden relative">
        {/* ✅ Updated Info Panel - removed collision info */}
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
              🔴 Coverage Holes ({activeCoverageFiltersCount} filter{activeCoverageFiltersCount > 1 ? 's' : ''})
              <div className="text-xs text-red-500 dark:text-red-300 mt-0.5">
                {activeCoverageFilterDesc}
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

          {/* ✅ Simplified neighbor stats - no collision info */}
          {showNeighbors && neighborStats && neighborStats.total > 0 && (
            <div className="text-blue-600 dark:text-blue-400 font-semibold">
              📡 {neighborStats.total} Neighbor Cells
              <div className="text-xs text-blue-500 dark:text-blue-300">
                {neighborStats.uniquePCIs} unique PCIs
              </div>
            </div>
          )}
        </div>

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
              locations={showDataCircles ? filteredLocations : []}
              thresholds={effectiveThresholds}
              selectedMetric={selectedMetric}
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

              {enableSiteToggle && showSiteMarkers && (
                <SiteMarkers
                  sites={siteData}
                  showMarkers={showSiteMarkers}
                  circleRadius={0}
                  onSiteClick={handleSiteClick}
                  viewport={viewport}
                />
              )}

              {enableSiteToggle && showSiteSectors && (
                <MapLegend showOperators={true} showSignalQuality={false} />
              )}

              {/* ✅ Simplified Neighbor Heatmap Layer */}
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
                />
              )}
            </MapWithMultipleCircles>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnifiedMapView;