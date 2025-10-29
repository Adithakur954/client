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
import UnifiedMapSidebar from "@/components/UnifiedMapSidebar";
import SiteMarkers from "@/components/SiteMarkers";
import NetworkSectors from "@/components/NetworkSectors";
import { useSiteData } from "@/hooks/useSiteData";

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
  const [selectedMetric, setSelectedMetric] = useState("rsrp");
  const [ui, setUi] = useState({ basemapStyle: "roadmap" });
  const [viewport, setViewport] = useState(null);
  
  const [enableDataToggle, setEnableDataToggle] = useState(true);
  const [dataToggle, setDataToggle] = useState("sample");
  
  const [enableSiteToggle, setEnableSiteToggle] = useState(false);
  const [siteToggle, setSiteToggle] = useState("NoML");
  
  const [showPolygons, setShowPolygons] = useState(false);
  const [onlyInsidePolygons, setOnlyInsidePolygons] = useState(false);
  
  const [showSiteMarkers, setShowSiteMarkers] = useState(true);
  const [showSiteSectors, setShowSiteSectors] = useState(true);

  const [showCoverageHoleOnly, setShowCoverageHoleOnly] = useState(false);
  const [coverageHoleThreshold, setCoverageHoleThreshold] = useState(-110);
  
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

  const { 
    siteData, 
    loading: siteLoading, 
    error: siteError, 
    refetch: refetchSites,
    isEmpty: siteDataIsEmpty
  } = useSiteData({
    enableSiteToggle,
    siteToggle,
    projectId,
    sessionIds,
    autoFetch: true,
  });

  const isLoading = loading || siteLoading;

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

  useEffect(() => {
    const loadThreshold = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        if (res?.Data?.coveragehole_json) {
          const threshold = parseFloat(res.Data.coveragehole_json);
          if (!isNaN(threshold)) {
            setCoverageHoleThreshold(threshold);
            console.log(`✅ Loaded coverage hole threshold: ${threshold} dBm`);
          }
        }
      } catch (error) {
        console.error("Failed to load coverage hole threshold:", error);
      }
    };
    loadThreshold();
  }, []);

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
        console.log(`✅ Loaded ${formatted.length} sample points`);
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
        console.log(`✅ Loaded ${formatted.length} prediction points`);
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

  useEffect(() => {
    if (!enableDataToggle && !enableSiteToggle) {
      setLocations([]);
      setLoading(false);
      return;
    }

    if (enableSiteToggle && siteToggle === "sites") {
      setLocations([]);
      setLoading(false);
    } else if (enableSiteToggle && siteToggle === "sites-prediction") {
      fetchPredictionData();
    } else if (enableDataToggle) {
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

  const handleUIChange = useCallback((changes) => {
    setUi((prev) => ({ ...prev, ...changes }));
  }, []);

  const reloadData = useCallback(() => {
    if (enableSiteToggle) {
      refetchSites();
    }
    
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
    fetchPolygons,
    refetchSites
  ]);

  const handleSiteClick = useCallback((site) => {
    console.log('Site clicked:', site);
  }, []);

  const handleSectorClick = useCallback((sector) => {
    console.log('Sector clicked:', sector);
  }, []);

  const effectiveThresholds = useMemo(() => {
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
      const pointsInside = locations.filter(point => isPointInPolygon(point, poly));
      
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
        fillOpacity: 0.7,
        strokeWeight: 2,
        pointCount: pointsInside.length,
        avgValue: avgValue,
      };
    });
  }, [onlyInsidePolygons, showPolygons, polygons, locations, selectedMetric, effectiveThresholds]);

  const filteredLocations = useMemo(() => {
    let result = locations;

    if (showCoverageHoleOnly && result.length > 0) {
      console.log(`🔴 Coverage hole filter active: RSRP < ${coverageHoleThreshold} dBm`);
      
      const beforeCount = result.length;
      result = result.filter(location => {
        const rsrp = parseFloat(location.rsrp);
        const isCoverageHole = !isNaN(rsrp) && rsrp < coverageHoleThreshold;
        return isCoverageHole;
      });
      
      console.log(`  Filtered to ${result.length} coverage holes (from ${beforeCount} total)`);
      
      if (result.length > 0) {
        toast.info(
          `🔴 ${result.length} coverage holes found (RSRP < ${coverageHoleThreshold} dBm)`,
          { autoClose: 3000 }
        );
      } else if (beforeCount > 0) {
        toast.warn(
          `No coverage holes found with RSRP < ${coverageHoleThreshold} dBm`,
          { autoClose: 3000 }
        );
      }
    }

    if (onlyInsidePolygons && showPolygons && polygons.length > 0) {
      console.log("🔇 Hiding individual points - showing polygon heatmap instead");
      return [];
    }
    
    return result;
  }, [
    locations, 
    showCoverageHoleOnly, 
    coverageHoleThreshold, 
    onlyInsidePolygons, 
    showPolygons, 
    polygons.length
  ]);

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

  const showDataCircles = 
    (enableDataToggle && !enableSiteToggle) || 
    (enableSiteToggle && siteToggle === "sites-prediction");

  const polygonsWithData = useMemo(() => {
    return polygonsWithColors.filter(p => p.pointCount > 0).length;
  }, [polygonsWithColors]);

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
    <div className="p-4 md:p-6 h-screen flex flex-col bg-gray-50 dark:bg-gray-800">
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
        showCoverageHoleOnly={showCoverageHoleOnly}
        setShowCoverageHoleOnly={setShowCoverageHoleOnly}
        coverageHoleThreshold={coverageHoleThreshold}
        setCoverageHoleThreshold={setCoverageHoleThreshold}
        ui={ui}
        onUIChange={handleUIChange}
        showPolygons={showPolygons}
        setShowPolygons={setShowPolygons}
        onlyInsidePolygons={onlyInsidePolygons}
        setOnlyInsidePolygons={setOnlyInsidePolygons}
        polygonCount={polygons.length}
        showSiteMarkers={showSiteMarkers}
        setShowSiteMarkers={setShowSiteMarkers}
        showSiteSectors={showSiteSectors}
        setShowSiteSectors={setShowSiteSectors}
        loading={isLoading}
        reloadData={reloadData}
      />

      <div className="flex-grow rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden relative">
        <div className="absolute bottom-2 left-2 z-10 bg-white/90 dark:bg-gray-800/90 p-2 px-3 rounded text-xs text-gray-700 dark:text-gray-300 shadow-lg space-y-1 max-w-xs">
          {enableDataToggle && (
            <div className="font-semibold">
              📊 {dataToggle === "sample" ? "Sample" : "Prediction"} Data
              {filteredLocations.length > 0 && (
                <span className="ml-1">({filteredLocations.length} points)</span>
              )}
            </div>
          )}
          
          {enableSiteToggle && (
            <div className="text-purple-600 dark:text-purple-400 font-semibold">
              🗼 Sites ({siteToggle})
              {!siteDataIsEmpty && (
                <span className="ml-1">({siteData.length} records)</span>
              )}
            </div>
          )}
          
          {showCoverageHoleOnly && (
            <div className="text-red-600 dark:text-red-400 font-semibold">
              🔴 Coverage Holes &lt; {coverageHoleThreshold} dBm
            </div>
          )}
          
          {showPolygons && polygons.length > 0 && (
            <div className="text-blue-600 dark:text-blue-400">
              📐 {onlyInsidePolygons ? 'Heatmap Mode' : `${visiblePolygons.length} Polygons`}
            </div>
          )}

          {isLoading && (
            <div className="text-yellow-600 dark:text-yellow-400 animate-pulse">
              ⏳ Loading...
            </div>
          )}
        </div>

        <div className="relative h-full w-full">
          {isLoading && locations.length === 0 && siteData.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <Spinner />
            </div>
          ) : error || siteError ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <div className="text-center space-y-2">
                {error && <p className="text-red-500">Data Error: {error}</p>}
                {siteError && <p className="text-red-500">Site Error: {siteError.message}</p>}
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
            >
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

              {enableSiteToggle && showSiteMarkers && (
                <SiteMarkers
                  sites={siteData}
                  showMarkers={showSiteMarkers}
                  circleRadius={50}
                  onSiteClick={handleSiteClick}
                  viewport={viewport}
                />
              )}

              {enableSiteToggle && showSiteSectors && (
                <NetworkSectors
                  sectors={siteData}
                  showSectors={showSiteSectors}
                  defaultRadius={220}
                  onSectorClick={handleSectorClick}
                  viewport={viewport}
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