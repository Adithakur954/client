// src/pages/UnifiedMapView.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useJsApiLoader, Polygon } from "@react-google-maps/api";
import { toast } from "react-toastify";
import { Filter } from "lucide-react";

import { mapViewApi, settingApi } from "../api/apiEndpoints";
import Spinner from "../components/common/Spinner";
import MapWithMultipleCircles from "../components/MapwithMultipleCircle";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";
import NetworkPlannerMap from "@/components/NetworkPlannerMap";
import UnifiedMapSidebar from "@/components/UnifiedMapSidebar";

// ================== CONSTANTS ==================
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

// ================== UTILITY FUNCTIONS ==================
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
  if (!wkt?.trim()) return [];
  
  try {
    const cleaned = wkt.trim();
    const isPolygon = cleaned.startsWith("POLYGON((");
    const isMultiPolygon = cleaned.startsWith("MULTIPOLYGON(((");
    
    if (!isPolygon && !isMultiPolygon) return [];
    
    const coordsMatches = cleaned.matchAll(/\(\(([\d\s,.-]+)\)\)/g);
    const polygons = [];
    
    for (const match of coordsMatches) {
      const coords = match[1];
      const points = coords.split(',').reduce((acc, coord) => {
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
      }
    }
    
    return polygons;
  } catch (error) {
    console.error("WKT parsing error:", error);
    return [];
  }
}

function computeBbox(points) {
  if (!points?.length) return null;
  
  let north = -90, south = 90, east = -180, west = 180;
  
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
    
    const intersect = ((yi > py) !== (yj > py)) &&
                     (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    
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

// Get color from threshold settings
function getColorFromValue(value, thresholds) {
  if (!thresholds || thresholds.length === 0) return "#999999";
  
  for (let i = 0; i < thresholds.length; i++) {
    const threshold = thresholds[i];
    if (value >= threshold.min && value <= threshold.max) {
      return threshold.color;
    }
  }
  
  return "#999999"; // Default gray if no match
}

// ================== MAIN COMPONENT ==================
const UnifiedMapView = () => {
  // ============ STATE MANAGEMENT ============
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Map data
  const [locations, setLocations] = useState([]);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [predictionColorSettings, setPredictionColorSettings] = useState([]);
  const [polygons, setPolygons] = useState([]);
  
  // UI Controls
  const [isSideOpen, setIsSideOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("rsrp");
  const [ui, setUi] = useState({ basemapStyle: "roadmap" });
  const [viewport, setViewport] = useState(null);
  
  // ============ TWO TOGGLES WITH ENABLE/DISABLE ============
  const [enableDataToggle, setEnableDataToggle] = useState(true);
  const [dataToggle, setDataToggle] = useState("sample"); // "sample" | "prediction"
  
  const [enableSiteToggle, setEnableSiteToggle] = useState(false);
  const [siteToggle, setSiteToggle] = useState("sites"); // "sites" | "sites-prediction"
  
  // Polygon controls
  const [showPolygons, setShowPolygons] = useState(false);
  const [onlyInsidePolygons, setOnlyInsidePolygons] = useState(false);
  
  // Site display options
  const [showSiteMarkers, setShowSiteMarkers] = useState(true);
  const [showSiteSectors, setShowSiteSectors] = useState(true);
  const [useGeneratedSites, setUseGeneratedSites] = useState(false);
  const [siteGridSize, setSiteGridSize] = useState(5);
  
  // ============ READ PROJECT & SESSION FROM URL ============
  const projectId = useMemo(() => {
    const param = searchParams.get("project_id") ?? searchParams.get("project") ?? "";
    return param ? Number(param) : null;
  }, [searchParams]);
  
  const sessionIds = useMemo(() => {
    const sessionParam = searchParams.get("sessionId") ?? searchParams.get("session");
    return sessionParam
      ? sessionParam.split(",").map((id) => id.trim()).filter((id) => id)
      : [];
  }, [searchParams]);

  const mapRef = useRef(null);
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  // ============ LOAD THRESHOLDS ============
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

  // ============ FETCH POLYGONS ============
  const fetchPolygons = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const res = await mapViewApi.getProjectPolygons(projectId);
      const items = Array.isArray(res) ? res : (Array.isArray(res?.Data) ? res.Data : []);
      
      if (items.length === 0) {
        setPolygons([]);
        return;
      }
      
      const parsed = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const polygonData = parseWKTToPolygons(item.wkt);
        
        for (let k = 0; k < polygonData.length; k++) {
          const p = polygonData[k];
          parsed.push({
            id: item.id,
            name: item.name,
            uid: `${item.id}-${k}`,
            paths: p.paths,
            bbox: computeBbox(p.paths[0]),
          });
        }
      }
      
      setPolygons(parsed);
      console.log(`📐 Loaded ${parsed.length} polygons for project ${projectId}`);
      
      if (parsed.length > 0) {
        toast.success(`${parsed.length} polygon(s) loaded`);
      }
    } catch (error) {
      console.error("Polygon fetch error:", error);
      toast.error("Failed to load polygons");
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId && showPolygons) {
      fetchPolygons();
    }
  }, [projectId, showPolygons, fetchPolygons]);

  // ============ FETCH SAMPLE DATA ============
  const fetchSampleData = useCallback(async () => {
    if (sessionIds.length === 0) {
      toast.warn("No session ID provided for sample data");
      setLocations([]);
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const promises = sessionIds.map((sessionId) =>
        mapViewApi.getNetworkLog({ session_id: sessionId })
      );
      const results = await Promise.all(promises);
      const allLogs = results.flatMap(
        (resp) => resp?.Data ?? resp?.data ?? resp ?? []
      );

      if (allLogs.length === 0) {
        toast.warn("No sample data found");
        setLocations([]);
      } else {
        const formatted = allLogs
          .map((log) => {
            const lat = parseFloat(log.lat ?? log.Lat ?? log.latitude);
            const lng = parseFloat(log.lon ?? log.lng ?? log.Lng ?? log.longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            
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
              technology: log.technology,
              band: log.band,
            };
          })
          .filter(Boolean);
        
        setLocations(formatted);
        toast.success(`${formatted.length} sample points loaded`);
      }
    } catch (err) {
      console.error("Error fetching sample data:", err);
      toast.error(`Failed to fetch sample data: ${err.message}`);
      setError("Failed to load sample data");
    } finally {
      setLoading(false);
    }
  }, [sessionIds]);

  // ============ FETCH PREDICTION DATA ============
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

  // ============ LOAD DATA BASED ON TOGGLES ============
  useEffect(() => {
    // Only fetch if toggle is enabled
    if (!enableDataToggle && !enableSiteToggle) {
      setLocations([]);
      setLoading(false);
      return;
    }

    if (enableSiteToggle && siteToggle === "sites") {
      // Sites only - no data circles
      setLocations([]);
      setLoading(false);
    } else if (enableSiteToggle && siteToggle === "sites-prediction") {
      // Sites + Prediction - always use prediction
      fetchPredictionData();
    } else if (enableDataToggle) {
      // Data toggle is active
      if (dataToggle === "sample") {
        fetchSampleData();
      } else {
        fetchPredictionData();
      }
    }
  }, [
    enableDataToggle, 
    enableSiteToggle, 
    dataToggle, 
    siteToggle, 
    fetchSampleData, 
    fetchPredictionData
  ]);

  // ============ MAP VIEWPORT TRACKING ============
  const debouncedSetViewport = useMemo(
    () => debounce((vp) => setViewport(vp), 150),
    []
  );

  const handleMapLoad = useCallback((map) => {
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
  }, [debouncedSetViewport]);

  // ============ UI HANDLERS ============
  const handleUIChange = useCallback((changes) => {
    setUi((prev) => ({ ...prev, ...changes }));
  }, []);

  const reloadData = useCallback(() => {
    if (enableSiteToggle && siteToggle === "sites-prediction") {
      fetchPredictionData();
    } else if (enableDataToggle) {
      if (dataToggle === "sample") {
        fetchSampleData();
      } else {
        fetchPredictionData();
      }
    }
    
    if (projectId && showPolygons) {
      fetchPolygons();
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
    fetchPolygons
  ]);

  // ============ CUSTOM THRESHOLDS ============
  const effectiveThresholds = useMemo(() => {
    // Use prediction color settings when:
    // 1. Toggle 2 is "sites-prediction", OR
    // 2. Toggle 1 is "prediction" and we have prediction colors
    const usePredictionColors = 
      (enableSiteToggle && siteToggle === "sites-prediction") || 
      (enableDataToggle && dataToggle === "prediction" && predictionColorSettings.length > 0);

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
    selectedMetric
  ]);

  // ============ POLYGON HEATMAP CALCULATION ============
  const polygonsWithColors = useMemo(() => {
    if (!onlyInsidePolygons || !showPolygons || polygons.length === 0 || locations.length === 0) {
      return polygons.map(poly => ({
        ...poly,
        fillColor: "#4285F4",
        fillOpacity: 0.15,
        pointCount: 0,
        avgValue: null,
      }));
    }

    console.log("🎨 Calculating polygon heatmap colors...");
    
    const currentThresholds = effectiveThresholds[selectedMetric] || [];
    
    return polygons.map(poly => {
      // Find all points inside this polygon
      const pointsInside = locations.filter(point => isPointInPolygon(point, poly));
      
      if (pointsInside.length === 0) {
        return {
          ...poly,
          fillColor: "#cccccc", // Gray for polygons with no data
          fillOpacity: 0.3,
          pointCount: 0,
          avgValue: null,
        };
      }

      // Calculate average metric value
      const values = pointsInside
        .map(point => point[selectedMetric])
        .filter(val => val !== null && val !== undefined && !isNaN(val));

      if (values.length === 0) {
        return {
          ...poly,
          fillColor: "#cccccc",
          fillOpacity: 0.3,
          pointCount: pointsInside.length,
          avgValue: null,
        };
      }

      const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
      const color = getColorFromValue(avgValue, currentThresholds);

      console.log(`  Polygon ${poly.uid}: ${pointsInside.length} points, avg ${selectedMetric}=${avgValue.toFixed(2)}, color=${color}`);

      return {
        ...poly,
        fillColor: color,
        fillOpacity: 0.7, // Higher opacity for heatmap effect
        strokeWeight: 2,
        pointCount: pointsInside.length,
        avgValue: avgValue,
      };
    });
  }, [onlyInsidePolygons, showPolygons, polygons, locations, selectedMetric, effectiveThresholds]);

  // ============ FILTERED LOCATIONS ============
  const filteredLocations = useMemo(() => {
    // When heatmap mode is active, hide the individual points
    if (onlyInsidePolygons && showPolygons && polygons.length > 0) {
      console.log("🔇 Hiding individual points - showing polygon heatmap instead");
      return [];
    }
    
    // Otherwise show all points
    return locations;
  }, [locations, onlyInsidePolygons, showPolygons, polygons]);

  // ============ VISIBLE POLYGONS (viewport filter) ============
  const visiblePolygons = useMemo(() => {
    if (!showPolygons || polygonsWithColors.length === 0) return [];
    
    if (viewport) {
      return polygonsWithColors.filter(poly => {
        if (!poly.bbox) return true;
        return !(poly.bbox.west > viewport.east || 
                 poly.bbox.east < viewport.west || 
                 poly.bbox.south > viewport.north || 
                 poly.bbox.north < viewport.south);
      });
    }
    
    return polygonsWithColors;
  }, [showPolygons, polygonsWithColors, viewport]);

  // ============ COMPUTE MAP CENTER ============
  const mapCenter = useMemo(() => {
    if (locations.length === 0) return DEFAULT_CENTER;
    const { lat, lng } = locations.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: lat / locations.length, lng: lng / locations.length };
  }, [locations]);

  const mapOptions = useMemo(() => {
    const style =
      ["satellite", "hybrid", "terrain"].includes(ui.basemapStyle)
        ? ui.basemapStyle
        : "roadmap";
    return { mapTypeId: style };
  }, [ui.basemapStyle]);

  // ============ DETERMINE WHAT TO SHOW ============
  const showDataCircles = 
    (enableDataToggle && !enableSiteToggle) || 
    (enableSiteToggle && siteToggle === "sites-prediction");
    
  const showSiteLayer = enableSiteToggle;

  // Count polygons with data
  const polygonsWithData = useMemo(() => {
    return polygonsWithColors.filter(p => p.pointCount > 0).length;
  }, [polygonsWithColors]);

  // ============ LOADING & ERROR STATES ============
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

  // ============ RENDER ============
  return (
    <div className="p-4 md:p-6 h-screen flex flex-col bg-gray-50 dark:bg-gray-800">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
        <h1 className="text-xl md:text-2xl font-semibold dark:text-white">
          Unified Map View
          <span className="text-base font-normal text-gray-600 dark:text-gray-400 block sm:inline sm:ml-2">
            {projectId && `(Project: ${projectId})`}
            {sessionIds.length > 0 && ` • Sessions: ${sessionIds.join(", ")}`}
          </span>
        </h1>
        <div className="flex gap-3 items-center">
          <button
            onClick={() => setIsSideOpen(!isSideOpen)}
            className="flex gap-1 items-center bg-blue-600 hover:bg-blue-500 text-white text-sm sm:text-base rounded-md px-3 py-1"
          >
            <Filter className="h-4" />
            {isSideOpen ? "Close" : "Open"} Controls
          </button>
          <Link
            to="/create-project"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm sm:text-base"
          >
            ← Back to Projects
          </Link>
        </div>
      </div>

      {/* Sidebar */}
      <UnifiedMapSidebar
        open={isSideOpen}
        onOpenChange={setIsSideOpen}
        // Toggle 1 with enable/disable
        enableDataToggle={enableDataToggle}
        setEnableDataToggle={setEnableDataToggle}
        dataToggle={dataToggle}
        setDataToggle={setDataToggle}
        // Toggle 2 with enable/disable
        enableSiteToggle={enableSiteToggle}
        setEnableSiteToggle={setEnableSiteToggle}
        siteToggle={siteToggle}
        setSiteToggle={setSiteToggle}
        // Read-only info
        projectId={projectId}
        sessionIds={sessionIds}
        // Metric
        metric={selectedMetric}
        setMetric={setSelectedMetric}
        // UI
        ui={ui}
        onUIChange={handleUIChange}
        // Polygon controls
        showPolygons={showPolygons}
        setShowPolygons={setShowPolygons}
        onlyInsidePolygons={onlyInsidePolygons}
        setOnlyInsidePolygons={setOnlyInsidePolygons}
        polygonCount={polygons.length}
        // Site controls
        showSiteMarkers={showSiteMarkers}
        setShowSiteMarkers={setShowSiteMarkers}
        showSiteSectors={showSiteSectors}
        setShowSiteSectors={setShowSiteSectors}
        useGeneratedSites={useGeneratedSites}
        setUseGeneratedSites={setUseGeneratedSites}
        siteGridSize={siteGridSize}
        setSiteGridSize={setSiteGridSize}
        // Actions
        loading={loading}
        reloadData={reloadData}
      />

      {/* Map Container */}
      <div className="flex-grow rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden relative">
        {/* Info Badge */}
        <div className="absolute bottom-2 left-2 z-10 bg-white/90 dark:bg-gray-800/90 p-2 px-3 rounded text-xs text-gray-700 dark:text-gray-300 shadow-lg space-y-1 max-w-xs">
          <div className="font-semibold">
            {!enableDataToggle && !enableSiteToggle && "⚠️ All Layers Disabled"}
            {enableDataToggle && !enableSiteToggle && (dataToggle === "sample" ? "📊 Sample Data" : "🔮 Prediction Data")}
            {!enableDataToggle && enableSiteToggle && (siteToggle === "sites" ? "🗼 Sites Only" : "🗼 Sites + Prediction")}
            {enableDataToggle && enableSiteToggle && "📊 Data + Sites"}
          </div>
          
          {onlyInsidePolygons && showPolygons && polygons.length > 0 ? (
            <>
              <div className="text-green-600 dark:text-green-400 font-semibold">
                🎨 Heatmap Mode Active
              </div>
              <div>{locations.length} total points</div>
              <div>{polygonsWithData}/{polygons.length} polygons with data</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 pt-1 border-t border-gray-300 dark:border-gray-600">
                Colors show avg {selectedMetric.toUpperCase()} values
              </div>
            </>
          ) : showDataCircles && filteredLocations.length > 0 ? (
            <div>{filteredLocations.length} points • {selectedMetric.toUpperCase()}</div>
          ) : null}
          
          {showSiteLayer && (
            <div className="text-purple-600 dark:text-purple-400">
              🗼 {useGeneratedSites ? `${siteGridSize}×${siteGridSize} grid` : "Hardcoded sites"}
            </div>
          )}
          
          {showPolygons && !onlyInsidePolygons && polygons.length > 0 && (
            <div className="text-blue-600 dark:text-blue-400">
              📐 {visiblePolygons.length} polygon(s) visible
            </div>
          )}
        </div>

        {/* Map */}
        <div className="relative h-full w-full">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <Spinner />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <p className="text-red-500">{error}</p>
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
            >
              {/* Polygons Layer with Heatmap Colors */}
              {showPolygons && visiblePolygons.length > 0 && visiblePolygons.map((poly) => (
                <Polygon
                  key={poly.uid}
                  paths={poly.paths[0]}
                  options={{
                    fillColor: poly.fillColor,
                    fillOpacity: poly.fillOpacity,
                    strokeColor: onlyInsidePolygons ? poly.fillColor : "#2563eb",
                    strokeWeight: poly.strokeWeight || 2,
                    strokeOpacity: 0.9,
                    clickable: true,
                    zIndex: 50,
                  }}
                  onClick={() => {
                    if (poly.avgValue !== null) {
                      toast.info(
                        `Polygon ${poly.name || poly.uid}: ${poly.pointCount} points, Avg ${selectedMetric.toUpperCase()}: ${poly.avgValue.toFixed(2)}`,
                        { autoClose: 3000 }
                      );
                    }
                  }}
                />
              ))}

              {/* Sites Layer */}
              {showSiteLayer && (
                <NetworkPlannerMap
                  showSectors={showSiteSectors}
                  showMarkers={showSiteMarkers}
                  viewport={viewport}
                  useGeneratedData={useGeneratedSites}
                  gridSize={siteGridSize}
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