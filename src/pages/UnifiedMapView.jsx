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
import NeighborHeatmapLayer from "@/components/unifiedMap/NeighborHeatmapLayer";

// ==================== CONSTANTS ====================
const DEFAULT_CENTER = { lat: 28.64453086, lng: 77.37324242 };

const DEFAULT_THRESHOLDS = {
  rsrp: [],
  rsrq: [],
  sinr: [],
  dl_thpt: [],
  ul_thpt: [],
  mos: [],
  lte_bler: [],
};

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

const PROVIDER_COLORS = {
  JIO: "#3B82F6",
  "Jio True5G": "#3B82F6",
  "JIO 4G": "#3B82F6",
  JIO4G: "#3B82F6",
  "IND-JIO": "#3B82F6",
  "IND airtel": "#EF4444",
  "IND Airtel": "#EF4444",
  airtel: "#EF4444",
  "Airtel 5G": "#EF4444",
  "VI India": "#22C55E",
  "Vi India": "#22C55E",
  "Vodafone IN": "#22C55E",
  BSNL: "#F59E0B",
  Unknown: "#6B7280",
};

const BAND_COLORS = {
  3: "#EF4444",
  5: "#F59E0B",
  8: "#10B981",
  40: "#3B82F6",
  41: "#8B5CF6",
  n28: "#EC4899",
  n78: "#F472B6",
  1: "#EF4444",
  2: "#F59E0B",
  7: "#10B981",
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

// ==================== UTILITY FUNCTIONS ====================

const getThresholdKey = (metric) => {
  const mapping = {
    dl_tpt: "dl_thpt",
    ul_tpt: "ul_thpt",
    rsrp: "rsrp",
    rsrq: "rsrq",
    sinr: "sinr",
    mos: "mos",
    lte_bler: "lte_bler",
    pci: "pci",
  };
  return mapping[metric?.toLowerCase()] || metric;
};

const debounce = (fn, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    return points.length >= 3 ? [{ paths: [points] }] : [];
  } catch {
    return [];
  }
};

const computeBbox = (points) => {
  if (!points?.length) return null;
  return points.reduce(
    (bbox, pt) => ({
      north: Math.max(bbox.north, pt.lat),
      south: Math.min(bbox.south, pt.lat),
      east: Math.max(bbox.east, pt.lng),
      west: Math.min(bbox.west, pt.lng),
    }),
    { north: -90, south: 90, east: -180, west: 180 }
  );
};

const isPointInPolygon = (point, polygon) => {
  const path = polygon?.paths?.[0];
  if (!path?.length) return false;

  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const { lng: xi, lat: yi } = path[i];
    const { lng: xj, lat: yj } = path[j];
    if (
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const getColorFromValue = (value, thresholds) => {
  if (!thresholds?.length) return "#999999";
  const threshold = thresholds.find((t) => value >= t.min && value <= t.max);
  return threshold?.color || "#999999";
};

const calculateMedian = (values) => {
  if (!values?.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const getCategoricalColor = (category, type) => {
  const maps = {
    provider: PROVIDER_COLORS,
    band: BAND_COLORS,
    technology: TECHNOLOGY_COLORS,
  };
  return maps[type]?.[category] || "#6C757D";
};

const calculateCategoryStats = (points, category, metric) => {
  if (!points?.length) return null;

  const grouped = {};
  points.forEach((pt) => {
    const key = String(pt[category] || "Unknown").trim();
    if (!grouped[key]) grouped[key] = { count: 0, values: [] };
    grouped[key].count++;
    const val = parseFloat(pt[metric]);
    if (!isNaN(val)) grouped[key].values.push(val);
  });

  const stats = Object.entries(grouped)
    .map(([name, { count, values }]) => ({
      name,
      count,
      percentage: ((count / points.length) * 100).toFixed(1),
      avgValue: values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : null,
    }))
    .sort((a, b) => b.count - a.count);

  return { stats, dominant: stats[0], total: points.length };
};

// ==================== PARSE LOG FUNCTION ====================
const parseLogEntry = (log, sessionId) => {
  const latValue =
    log.lat ?? log.Lat ?? log.latitude ?? log.Latitude ?? log.LAT;
  const lngValue =
    log.lon ??
    log.lng ??
    log.Lng ??
    log.longitude ??
    log.Longitude ??
    log.LON ??
    log.long ??
    log.Long;

  const lat = parseFloat(latValue);
  const lng = parseFloat(lngValue);

  if (isNaN(lat) || isNaN(lng)) return null;
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    lat,
    lng,
    radius: 18,
    timestamp:
      log.timestamp ?? log.time ?? log.created_at ?? log.Timestamp ?? log.Time,
    rsrp: parseFloat(log.rsrp ?? log.RSRP ?? log.rsrp_dbm ?? log.Rsrp) || null,
    rsrq: parseFloat(log.rsrq ?? log.RSRQ ?? log.Rsrq) || null,
    sinr: parseFloat(log.sinr ?? log.SINR ?? log.Sinr) || null,
    dl_tpt:
      parseFloat(
        log.dl_tpt ?? log.dl_thpt ?? log.DL ?? log.dl_throughput ?? log.DlThpt
      ) || null,
    ul_tpt:
      parseFloat(
        log.ul_tpt ?? log.ul_thpt ?? log.UL ?? log.ul_throughput ?? log.UlThpt
      ) || null,
    mos: parseFloat(log.mos ?? log.MOS ?? log.Mos) || null,
    lte_bler: parseFloat(log.lte_bler ?? log.LTE_BLER ?? log.LteBler) || null,
    provider: String(
      log.provider ?? log.Provider ?? log.operator ?? log.Operator ?? ""
    ).trim(),
    technology: String(
      log.network ?? log.technology ?? log.Network ?? log.Technology ?? ""
    ).trim(),
    band: String(log.band ?? log.Band ?? "").trim(),
    pci: parseInt(log.pci ?? log.PCI ?? log.Pci) || null,
    jitter: parseFloat(log.jitter ?? log.Jitter) || null,
    speed: parseFloat(log.speed ?? log.Speed) || null,
    latency: parseFloat(log.latency ?? log.Latency) || null,
    nodeb_id: log.nodeb_id ?? log.nodebid ?? log.NodeBId ?? log.nodebId,
    apps: log.apps ?? log.app_name ?? log.Apps ?? "",
    mode: log.mode ?? log.Mode,
    radio: log.radio ?? log.Radio,
    session_id: sessionId,
  };
};

const extractLogsFromResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.Data && Array.isArray(data.Data)) return data.Data;
  if (data?.logs && Array.isArray(data.logs)) return data.logs;
  if (data?.networkLogs && Array.isArray(data.networkLogs))
    return data.networkLogs;
  if (data?.result && Array.isArray(data.result)) return data.result;

  console.warn("⚠️ Unknown response structure:", Object.keys(data || {}));
  return [];
};

// ==================== TOOLTIP COMPONENT ====================
const AreaPolygonTooltip = React.memo(
  ({ polygon, position, selectedMetric }) => {
    if (!polygon || !position) return null;

    const {
      categoryStats: stats,
      pointCount,
      medianValue,
      fillColor,
      name,
    } = polygon;

    const units = {
      rsrp: "dBm",
      rsrq: "dB",
      sinr: "dB",
      dl_tpt: "Mbps",
      ul_tpt: "Mbps",
    };
    const unit = units[selectedMetric] || "";

    return (
      <div
        className="fixed z-[1000] bg-white/95 backdrop-blur-sm rounded-lg shadow-2xl border border-purple-400 p-2 max-w-[800px]"
        style={{
          left: Math.min(position.x + 15, window.innerWidth - 620),
          top: Math.min(position.y - 10, window.innerHeight - 300),
          pointerEvents: "none",
        }}
      >
        <div className="flex items-center justify-between mb-2 pb-2 border-b border-purple-300">
          <div className="flex items-center gap-4">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: fillColor }}
            />
            <span className="font-bold text-sm">{name}</span>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="px-2 py-0.5 bg-blue-100 rounded font-semibold">
              {pointCount} logs
            </span>
            {medianValue !== null && (
              <span className="px-2 py-0.5 bg-green-100 rounded font-semibold">
                {medianValue.toFixed(1)} {unit}
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs">
          {["provider", "band", "technology"].map(
            (type) =>
              stats?.[type]?.stats?.length > 0 && (
                <div key={type}>
                  <div className="font-bold text-gray-500 mb-1 capitalize">
                    {type}s
                  </div>
                  {stats[type].stats.slice(0, 3).map((s, i) => (
                    <div key={i} className="flex justify-between text-[10px]">
                      <span
                        style={{ color: getCategoricalColor(s.name, type) }}
                      >
                        {s.name}
                      </span>
                      <span>{s.percentage}%</span>
                    </div>
                  ))}
                </div>
              )
          )}
        </div>
      </div>
    );
  }
);

AreaPolygonTooltip.displayName = "AreaPolygonTooltip";

// ==================== MAIN COMPONENT ====================
const UnifiedMapView = () => {
  const [searchParams] = useSearchParams();

  // Core state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [predictionColorSettings, setPredictionColorSettings] = useState([]);

  // UI state
  const [isSideOpen, setIsSideOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("rsrp");
  const [ui, setUi] = useState({ basemapStyle: "roadmap" });
  const [viewport, setViewport] = useState(null);
  const [colorBy, setColorBy] = useState(null);

  // Toggle states
  const [enableDataToggle, setEnableDataToggle] = useState(true);
  const [dataToggle, setDataToggle] = useState("sample");
  const [enableSiteToggle, setEnableSiteToggle] = useState(false);
  const [siteToggle, setSiteToggle] = useState("NoML");
  const [showSiteMarkers, setShowSiteMarkers] = useState(true);
  const [showSiteSectors, setShowSiteSectors] = useState(true);
  const [showNeighbors, setShowNeighbors] = useState(false);

  // Polygon state
  const [polygons, setPolygons] = useState([]);
  const [showPolygons, setShowPolygons] = useState(false);
  const [polygonSource, setPolygonSource] = useState("map");
  const [onlyInsidePolygons, setOnlyInsidePolygons] = useState(false);

  // Area state
  const [areaData, setAreaData] = useState([]);
  const [areaEnabled, setAreaEnabled] = useState(false);
  const [hoveredAreaPolygon, setHoveredAreaPolygon] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);

  // Filters
  const [coverageHoleFilters, setCoverageHoleFilters] = useState(
    DEFAULT_COVERAGE_FILTERS
  );
  const [dataFilters, setDataFilters] = useState(DEFAULT_DATA_FILTERS);
  const [enableGrid, setEnableGrid] = useState(false);
const [gridSizeMeters, setGridSizeMeters] = useState(20);

  // Additional data
  const [appSummary, setAppSummary] = useState({});
  const [logArea, setLogArea] = useState(null);
  const [fetchStats, setFetchStats] = useState({
    total: 0,
    valid: 0,
    invalid: 0,
    progress: null,
    sessionsComplete: 0,
    sessionsFailed: 0,
    complete: false,
    time: null,
    currentSession: null,
  });

  const mapRef = useRef(null);

  // Derived values
  const projectId = useMemo(() => {
    const param = searchParams.get("project_id") ?? searchParams.get("project");
    return param ? Number(param) : null;
  }, [searchParams]);

  const sessionIds = useMemo(() => {
    const param = searchParams.get("sessionId") ?? searchParams.get("session");
    if (!param) return [];
    return param
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }, [searchParams]);

  // Hooks
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
  });

  const isLoading = loading || siteLoading || neighborLoading;

  // ==================== DATA FETCHING ====================

  useEffect(() => {
    const load = async () => {
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

          if (d.coveragehole_json) {
            const threshold = parseFloat(d.coveragehole_json);
            if (!isNaN(threshold)) {
              setCoverageHoleFilters((prev) => ({
                ...prev,
                rsrp: { ...prev.rsrp, threshold },
              }));
            }
          }
        }
      } catch (e) {
        console.error("Failed to load thresholds:", e);
      }
    };
    load();
  }, []);

  const fetchSampleData = useCallback(async () => {
    if (!sessionIds.length) {
      toast.warn("No session IDs provided");
      setLocations([]);
      setAppSummary({});
      return;
    }

    setLoading(true);
    setError(null);
    setLocations([]);
    setAppSummary({});
    setLogArea({});

    const stats = {
      total: 0,
      valid: 0,
      invalid: 0,
      sessionsComplete: 0,
      sessionsFailed: 0,
    };

    const accumulatedLogs = [];
    const accumulatedAppSummaries = {};
    const accumulatedIoModes = {};

    try {
      const startTime = performance.now();

      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i];

        setFetchStats({
          ...stats,
          progress: `${i + 1}/${sessionIds.length}`,
          currentSession: sessionId,
        });

        try {
          const response = await mapViewApi.getNetworkLog({
            session_id: sessionId,
          });

          if (response?.app_summary) {
            accumulatedAppSummaries[sessionId] = response.app_summary;
          }
          if (response?.io_summary) {
            accumulatedIoModes[sessionId] = response.io_summary;
          }

          const sessionLogs = extractLogsFromResponse(response);
          let sessionValid = 0;
          let sessionInvalid = 0;

          const parsedLogs = [];
          sessionLogs.forEach((log) => {
            stats.total++;
            const parsed = parseLogEntry(log, sessionId);

            if (parsed) {
              parsedLogs.push(parsed);
              sessionValid++;
              stats.valid++;
            } else {
              sessionInvalid++;
              stats.invalid++;
            }
          });

          accumulatedLogs.push(...parsedLogs);
          stats.sessionsComplete++;

          setLocations([...accumulatedLogs]);
          setAppSummary({ ...accumulatedAppSummaries });
          setLogArea({ ...accumulatedIoModes });

          setFetchStats({
            total: stats.total,
            valid: stats.valid,
            invalid: stats.invalid,
            progress: `${i + 1}/${sessionIds.length}`,
            sessionsComplete: stats.sessionsComplete,
            sessionsFailed: stats.sessionsFailed,
          });
        } catch (err) {
          console.error(`Session ${sessionId} failed:`, err.message);
          stats.sessionsFailed++;
        }

        if (i < sessionIds.length - 1) {
          await delay(100);
        }
      }

      const fetchTime = ((performance.now() - startTime) / 1000).toFixed(2);

      setFetchStats({
        total: stats.total,
        valid: stats.valid,
        invalid: stats.invalid,
        sessionsComplete: stats.sessionsComplete,
        sessionsFailed: stats.sessionsFailed,
        complete: true,
        time: fetchTime,
      });

      if (accumulatedLogs.length > 0) {
        toast.success(
          `✅ ${accumulatedLogs.length} points from ${stats.sessionsComplete} sessions in ${fetchTime}s`,
          { autoClose: 3000 }
        );
      } else {
        toast.warn("No valid log data found");
      }

      if (stats.sessionsFailed > 0) {
        toast.warning(`${stats.sessionsFailed} session(s) failed`);
      }
    } catch (err) {
      console.error("Critical error:", err);
      toast.error(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionIds]);

  const fetchPredictionData = useCallback(async () => {
    if (!projectId) {
      toast.warn("No project ID for predictions");
      setLocations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await mapViewApi.getPredictionLog({
        projectId: Number(projectId),
        metric: selectedMetric.toUpperCase(),
      });

      if (res?.Status === 1 && res?.Data) {
        const { dataList = [], colorSetting = [] } = res.Data;

        const formatted = dataList
          .map((pt) => {
            const lat = parseFloat(pt.lat);
            const lng = parseFloat(pt.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return {
              lat,
              lng,
              radius: 10,
              [selectedMetric]: pt.prm,
              isPrediction: true,
            };
          })
          .filter(Boolean);

        setLocations(formatted);
        setPredictionColorSettings(colorSetting);
        toast.success(`${formatted.length} prediction points`);
      } else {
        toast.error(res?.Message || "No prediction data");
        setLocations([]);
      }
    } catch (err) {
      console.error("Prediction error:", err);
      toast.error(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedMetric]);

  const fetchPolygons = useCallback(async () => {
    if (!projectId || !showPolygons) {
      setPolygons([]);
      return;
    }

    try {
      const res = await mapViewApi.getProjectPolygonsV2(
        projectId,
        polygonSource
      );
      const items =
        res?.Data || res?.data?.Data || (Array.isArray(res) ? res : []);

      const parsed = items.flatMap((item) => {
        const wkt = item.Wkt || item.wkt;
        if (!wkt) return [];
        return parseWKTToPolygons(wkt).map((p, k) => ({
          id: item.Id || item.id,
          name: item.Name || item.name || `Polygon ${item.Id}`,
          source: polygonSource,
          uid: `${polygonSource}-${item.Id}-${k}`,
          paths: p.paths,
          bbox: computeBbox(p.paths[0]),
        }));
      });

      setPolygons(parsed);
      if (parsed.length) toast.success(`${parsed.length} polygon(s) loaded`);
    } catch (err) {
      console.error("Polygon error:", err);
      setPolygons([]);
    }
  }, [projectId, showPolygons, polygonSource]);

  const fetchAreaPolygons = useCallback(async () => {
  if (!projectId || !areaEnabled) {
    setAreaData([]);
    return;
  }

  console.log("📡 Fetching area polygons for project:", projectId);

  try {
    const res = await areaBreakdownApi.getAreaPolygons(projectId);
    
    console.log("📦 Area API Response:", res);

    // Your API structure: res.data.grid_blocks
    let zones = [];
    
    // Check all possible locations for zone data
    if (res?.data?.grid_blocks?.length > 0) {
      zones = res.data.grid_blocks;
      console.log("✅ Found zones in grid_blocks");
    } else if (res?.data?.ai_zones?.length > 0) {
      zones = res.data.ai_zones;
      console.log("✅ Found zones in ai_zones");
    } else if (res?.data?.building_clusters?.length > 0) {
      zones = res.data.building_clusters;
      console.log("✅ Found zones in building_clusters");
    } else if (Array.isArray(res?.data)) {
      zones = res.data;
    } else if (Array.isArray(res)) {
      zones = res;
    }

    console.log("📍 Extracted zones:", zones.length, zones);

    if (!zones || !zones.length) {
      console.warn("⚠️ No zones found in response");
      toast.warning("No area zones found for this project");
      setAreaData([]);
      return;
    }

    const parsed = zones
      .map((zone, index) => {
        const geometry = zone.geometry || zone.Geometry || zone.wkt || zone.Wkt;

        if (!geometry) {
          console.warn(`Zone ${index} has no geometry:`, zone);
          return null;
        }

        const poly = parseWKTToPolygons(geometry)[0];
        
        if (!poly || !poly.paths?.[0]?.length) {
          console.warn(`Failed to parse geometry for zone ${index}`);
          return null;
        }

        return {
          id: zone.id || zone.Id || index,
          blockId: zone.block_id || zone.blockId,
          name: zone.project_name || zone.name || `Block ${zone.block_id || index}`,
          source: "area",
          uid: `area-${zone.id || zone.Id || index}`,
          paths: poly.paths,
          bbox: computeBbox(poly.paths[0]),
        };
      })
      .filter(Boolean);

    console.log(`✅ Parsed ${parsed.length} area polygons`);
    
    setAreaData(parsed);
    
    if (parsed.length > 0) {
      toast.success(`${parsed.length} area zone(s) loaded`);
    }
  } catch (err) {
    console.error("❌ Area polygon error:", err);
    toast.error(`Failed to load area zones: ${err.message}`);
    setAreaData([]);
  }
}, [projectId, areaEnabled]);

  // ==================== EFFECTS ====================

  useEffect(() => {
    if (!enableDataToggle && !enableSiteToggle) {
      setLocations([]);
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
    }
  }, [
    enableDataToggle,
    enableSiteToggle,
    dataToggle,
    siteToggle,
    fetchSampleData,
    fetchPredictionData,
  ]);

  useEffect(() => {
    fetchPolygons();
  }, [fetchPolygons]);

  useEffect(() => {
    fetchAreaPolygons();
  }, [fetchAreaPolygons]);

  // ==================== MEMOIZED VALUES ====================

  const effectiveThresholds = useMemo(() => {
    if (predictionColorSettings.length && dataToggle === "prediction") {
      return {
        ...thresholds,
        [selectedMetric]: predictionColorSettings.map((s) => ({
          min: parseFloat(s.min),
          max: parseFloat(s.max),
          color: s.color,
        })),
      };
    }
    return thresholds;
  }, [thresholds, predictionColorSettings, selectedMetric, dataToggle]);

  const availableFilterOptions = useMemo(() => {
    const providers = new Set();
    const bands = new Set();
    const technologies = new Set();

    locations.forEach((loc) => {
      if (loc.provider) providers.add(loc.provider);
      if (loc.band) bands.add(loc.band);
      if (loc.technology) technologies.add(loc.technology);
    });

    return {
      providers: [...providers].sort(),
      bands: [...bands].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)),
      technologies: [...technologies].sort(),
    };
  }, [locations]);

  const filteredLocations = useMemo(() => {
    let result = [...locations];

    const activeCoverageFilters = Object.entries(coverageHoleFilters).filter(
      ([, config]) => config.enabled
    );

    if (activeCoverageFilters.length > 0) {
      result = result.filter((loc) =>
        activeCoverageFilters.every(([metric, { threshold }]) => {
          const val = parseFloat(loc[metric]);
          return !isNaN(val) && val < threshold;
        })
      );
    }

    const { providers, bands, technologies } = dataFilters;
    if (providers.length) {
      result = result.filter((l) => providers.includes(l.provider));
    }
    if (bands.length) {
      result = result.filter((l) => bands.includes(l.band));
    }
    if (technologies.length) {
      result = result.filter((l) => technologies.includes(l.technology));
    }

    // Filter by polygon if enabled
    if (onlyInsidePolygons && showPolygons && polygons.length) {
      result = result.filter((pt) =>
        polygons.some((poly) => isPointInPolygon(pt, poly))
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

  const polygonsWithColors = useMemo(() => {
    if (!showPolygons || !polygons.length) return [];

    if (!onlyInsidePolygons || !locations.length) {
      return polygons.map((p) => ({
        ...p,
        fillColor: "#4285F4",
        fillOpacity: 0.35,
        pointCount: 0,
        avgValue: null,
      }));
    }

    const thresholdKey = getThresholdKey(selectedMetric);
    const currentThresholds = effectiveThresholds[thresholdKey] || [];

    return polygons.map((poly) => {
      const pointsInside = locations.filter((pt) => isPointInPolygon(pt, poly));
      const values = pointsInside
        .map((p) => parseFloat(p[selectedMetric]))
        .filter((v) => !isNaN(v));

      if (!values.length) {
        return {
          ...poly,
          fillColor: "#ccc",
          fillOpacity: 0.3,
          pointCount: pointsInside.length,
          avgValue: null,
        };
      }

      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      return {
        ...poly,
        fillColor: getColorFromValue(avg, currentThresholds),
        fillOpacity: 0.7,
        pointCount: pointsInside.length,
        avgValue: avg,
      };
    });
  }, [
    showPolygons,
    polygons,
    onlyInsidePolygons,
    locations,
    selectedMetric,
    effectiveThresholds,
  ]);

  const areaPolygonsWithColors = useMemo(() => {
    if (!areaEnabled || !areaData.length) return [];

    if (!filteredLocations.length) {
      return areaData.map((p) => ({
        ...p,
        fillColor: "#9333ea",
        fillOpacity: 0.25,
        pointCount: 0,
        medianValue: null,
        categoryStats: null,
      }));
    }

    const thresholdKey = getThresholdKey(selectedMetric);
    const currentThresholds = thresholds[thresholdKey] || [];

    const useCategorical =
      colorBy && ["provider", "band", "technology"].includes(colorBy);

    return areaData.map((poly) => {
      const pointsInside = filteredLocations.filter((pt) =>
        isPointInPolygon(pt, poly)
      );

      if (!pointsInside.length) {
        return {
          ...poly,
          fillColor: "#ccc",
          fillOpacity: 0.3,
          pointCount: 0,
          medianValue: null,
          categoryStats: null,
        };
      }

      const providerStats = calculateCategoryStats(
        pointsInside,
        "provider",
        selectedMetric
      );
      const bandStats = calculateCategoryStats(
        pointsInside,
        "band",
        selectedMetric
      );
      const technologyStats = calculateCategoryStats(
        pointsInside,
        "technology",
        selectedMetric
      );

      let fillColor;
      if (useCategorical) {
        const stats =
          colorBy === "provider"
            ? providerStats
            : colorBy === "band"
            ? bandStats
            : technologyStats;
        fillColor = stats?.dominant
          ? getCategoricalColor(stats.dominant.name, colorBy)
          : "#ccc";
      } else {
        const values = pointsInside
          .map((p) => parseFloat(p[selectedMetric]))
          .filter((v) => !isNaN(v));

        const median = calculateMedian(values);
        fillColor =
          median !== null
            ? getColorFromValue(median, currentThresholds)
            : "#ccc";
      }

      const medianValue = calculateMedian(
        pointsInside
          .map((p) => parseFloat(p[selectedMetric]))
          .filter((v) => !isNaN(v))
      );

      return {
        ...poly,
        fillColor,
        fillOpacity: 0.7,
        strokeWeight: 2.5,
        pointCount: pointsInside.length,
        medianValue,
        categoryStats: {
          provider: providerStats,
          band: bandStats,
          technology: technologyStats,
        },
      };
    });
  }, [
    areaEnabled,
    areaData,
    filteredLocations,
    selectedMetric,
    thresholds,
    colorBy,
  ]);

  const visiblePolygons = useMemo(() => {
    if (!showPolygons || !polygonsWithColors.length) return [];
    if (!viewport) return polygonsWithColors;

    return polygonsWithColors.filter((poly) => {
      if (!poly.bbox) return true;
      return !(
        poly.bbox.west > viewport.east ||
        poly.bbox.east < viewport.west ||
        poly.bbox.south > viewport.north ||
        poly.bbox.north < viewport.south
      );
    });
  }, [showPolygons, polygonsWithColors, viewport]);

  const mapCenter = useMemo(() => {
    if (!locations.length) return DEFAULT_CENTER;
    const sum = locations.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: sum.lat / locations.length, lng: sum.lng / locations.length };
  }, [locations]);

  const showDataCircles =
    enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction");
  const shouldShowLegend =
    enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction");

  const locationsToDisplay = useMemo(() => {
    if (!showDataCircles) return [];

    const hasCoverageFilters = Object.values(coverageHoleFilters).some(
      (f) => f.enabled
    );
    const hasDataFilters =
      dataFilters.providers.length > 0 ||
      dataFilters.bands.length > 0 ||
      dataFilters.technologies.length > 0;

    if (hasCoverageFilters || hasDataFilters || onlyInsidePolygons) {
      return filteredLocations;
    }

    return locations;
  }, [
    showDataCircles,
    coverageHoleFilters,
    dataFilters,
    filteredLocations,
    locations,
    onlyInsidePolygons,
  ]);

  // ==================== HANDLERS ====================
  const debouncedSetViewport = useMemo(() => debounce(setViewport, 150), []);

  const handleMapLoad = useCallback(
    (map) => {
      mapRef.current = map;
      const updateViewport = () => {
        const bounds = map.getBounds();
        if (!bounds) return;
        debouncedSetViewport({
          north: bounds.getNorthEast().lat(),
          south: bounds.getSouthWest().lat(),
          east: bounds.getNorthEast().lng(),
          west: bounds.getSouthWest().lng(),
        });
      };
      map.addListener("idle", updateViewport);
      updateViewport();
    },
    [debouncedSetViewport]
  );

  const reloadData = useCallback(() => {
    if (enableSiteToggle) refetchSites();
    if (enableDataToggle) {
      dataToggle === "sample" ? fetchSampleData() : fetchPredictionData();
    }
    if (showPolygons) fetchPolygons();
    if (areaEnabled) fetchAreaPolygons();
    if (showNeighbors) refetchNeighbors();
  }, [
    enableDataToggle,
    enableSiteToggle,
    dataToggle,
    showPolygons,
    areaEnabled,
    showNeighbors,
    fetchSampleData,
    fetchPredictionData,
    fetchPolygons,
    fetchAreaPolygons,
    refetchSites,
    refetchNeighbors,
  ]);

  const activeCoverageFiltersCount = useMemo(() => {
    return Object.values(coverageHoleFilters).filter((f) => f.enabled).length;
  }, [coverageHoleFilters]);

  const activeDataFiltersCount = useMemo(() => {
    return (
      (dataFilters.providers.length > 0 ? 1 : 0) +
      (dataFilters.bands.length > 0 ? 1 : 0) +
      (dataFilters.technologies.length > 0 ? 1 : 0)
    );
  }, [dataFilters]);

  // ==================== RENDER ====================
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
        Map loading error: {loadError.message}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-800">
      <UnifiedHeader
        onToggleControls={() => setIsSideOpen(!isSideOpen)}
        onLeftToggle={() => setShowAnalytics(!showAnalytics)}
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
        onUIChange={setUi}
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
        enableGrid={enableGrid}
  setEnableGrid={setEnableGrid}
  gridSizeMeters={gridSizeMeters}
  setGridSizeMeters={setGridSizeMeters}
      />

      <div className="flex-grow relative overflow-hidden">
        <div className="absolute bottom-2 left-2 z-10 bg-white/90 p-2 px-3 rounded text-xs shadow-lg space-y-1 max-w-xs">
          {enableDataToggle && (
            <div className="font-semibold">
              {dataToggle === "sample" ? "Sample" : "Prediction"} Data
              <div className="text-[10px] text-gray-500">
                Total: {locations.length} | Displayed:{" "}
                {locationsToDisplay.length}
                {onlyInsidePolygons && showPolygons && polygons.length > 0 && (
                  <span className="text-green-600"> (filtered by polygon)</span>
                )}
              </div>
            </div>
          )}

          {enableSiteToggle && !siteDataIsEmpty && (
            <div className="text-purple-600 dark:text-purple-400">
              Sites ({siteToggle}): {siteData.length}
            </div>
          )}

          {activeCoverageFiltersCount > 0 && (
            <div className="text-red-600">
              🔴 Coverage Filter: {filteredLocations.length} holes
            </div>
          )}

          {activeDataFiltersCount > 0 && (
            <div className="text-blue-600">
              🔍 Filters active ({activeDataFiltersCount})
            </div>
          )}

          {onlyInsidePolygons && showPolygons && polygons.length > 0 && (
            <div className="text-green-600">
              📍 Polygon Filter: {polygons.length} polygon(s)
            </div>
          )}

          {showNeighbors && neighborStats?.total > 0 && (
            <div className="text-orange-600">
              📡 {neighborStats.total} neighbors ({neighborStats.uniquePCIs}{" "}
              PCIs)
            </div>
          )}

          {isLoading && (
            <div className="text-yellow-600 animate-pulse">⏳ Loading...</div>
          )}

          {fetchStats.total > 0 && (
            <div className="text-[9px] text-gray-400 border-t pt-1 mt-1">
              Fetched: {fetchStats.total} | Valid: {fetchStats.valid} | Invalid:{" "}
              {fetchStats.invalid}
            </div>
          )}
        </div>

        {shouldShowLegend && (
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
        )}

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
              locations={locationsToDisplay}
              thresholds={effectiveThresholds}
              selectedMetric={selectedMetric}
              colorBy={colorBy}
              activeMarkerIndex={null}
              onMarkerClick={() => {}}
              options={{ mapTypeId: ui.basemapStyle }}
              center={mapCenter}
              defaultZoom={13}
              fitToLocations={locationsToDisplay.length > 0}
              onLoad={handleMapLoad}
              radiusMeters={24}
              projectId={projectId}
              polygonSource={polygonSource}
              enablePolygonFilter={true} 
              showPolygonBoundary={true}
              enableGrid={enableGrid}
  gridSizeMeters={gridSizeMeters}
   areaEnabled={areaEnabled}
            >
              {/* Render polygons */}
              {showPolygons &&
                visiblePolygons.map((poly) => (
                  <Polygon
                    key={poly.uid}
                    paths={poly.paths[0]}
                    options={{
                      fillColor: poly.fillColor || "#4285F4",
                      fillOpacity: poly.fillOpacity || 0.35,
                      strokeColor: onlyInsidePolygons
                        ? poly.fillColor
                        : "#2563eb",
                      strokeWeight: 2,
                      strokeOpacity: 0.9,
                      clickable: true,
                      zIndex: 50,
                    }}
                    onClick={() => {
                      toast.info(
                        `${poly.name}: ${poly.pointCount || 0} points${
                          poly.avgValue
                            ? `, Avg: ${poly.avgValue.toFixed(1)}`
                            : ""
                        }`
                      );
                    }}
                  />
                ))}

              {/* Area polygons */}
              {areaEnabled &&
                areaPolygonsWithColors.map((poly) => (
                  <Polygon
                    key={poly.uid}
                    paths={poly.paths[0]}
                    options={{
                      fillColor: poly.fillColor || "#9333ea",
                      fillOpacity: poly.fillOpacity || 0.7,
                      strokeColor: poly.fillColor || "#7c3aed",
                      strokeWeight: 2.5,
                      strokeOpacity: 0.9,
                      clickable: true,
                      zIndex: 60,
                    }}
                    onMouseOver={(e) => {
                      setHoveredAreaPolygon(poly);
                      setHoverPosition({
                        x: e.domEvent.clientX,
                        y: e.domEvent.clientY,
                      });
                    }}
                    onMouseMove={(e) => {
                      setHoverPosition({
                        x: e.domEvent.clientX,
                        y: e.domEvent.clientY,
                      });
                    }}
                    onMouseOut={() => {
                      setHoveredAreaPolygon(null);
                      setHoverPosition(null);
                    }}
                    onClick={() => {
                      toast.info(
                        `${poly.name}: ${poly.pointCount} points, Median: ${
                          poly.medianValue?.toFixed(1) || "N/A"
                        }`
                      );
                    }}
                  />
                ))}

              {/* Site markers */}
              {enableSiteToggle && showSiteMarkers && (
                <SiteMarkers
                  sites={siteData}
                  showMarkers={showSiteMarkers}
                  circleRadius={0}
                  viewport={viewport}
                />
              )}

              {/* Neighbor heatmap */}
              {showNeighbors && allNeighbors.length > 0 && (
                <NeighborHeatmapLayer
                  allNeighbors={allNeighbors}
                  showNeighbors={showNeighbors}
                  selectedMetric={selectedMetric}
                  useHeatmap={true}
                  radius={35}
                  opacity={0.7}
                  onNeighborClick={(neighbor) => {
                    toast.info(
                      `PCI ${neighbor.pci}${
                        neighbor.rsrp !== null
                          ? ` | RSRP: ${neighbor.rsrp} dBm`
                          : ""
                      }`,
                      { autoClose: 3000 }
                    );
                  }}
                />
              )}

              {/* Network planner sectors */}
              {enableSiteToggle && showSiteSectors && (
                <NetworkPlannerMap
                  defaultRadius={10}
                  scale={0.2}
                  showSectors={showSiteSectors}
                  viewport={viewport}
                  options={{ zIndex: 100 }}
                  projectId={projectId}
                  minSectors={3}
                />
              )}
            </MapWithMultipleCircles>
          )}
        </div>
      </div>

      {/* Tooltip for area polygons */}
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
