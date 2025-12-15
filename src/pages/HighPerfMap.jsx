import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { toast } from "react-toastify";
import MapSearchBox from "@/components/map/MapSearchBox";
import { Save, Clock } from "lucide-react";

import { adminApi, mapViewApi, settingApi } from "@/api/apiEndpoints";

import MapHeader from "@/components/map/layout/MapHeader";
import SessionDetailPanel from "@/components/map/layout/SessionDetail";
import AllLogsPanelToggle from "@/components/map/layout/AllLogsPanelToggle";
import TimeControlsPanel from "@/components/map/TimeControlsPanel";

import SessionsLayer from "@/components/map/overlays/SessionsLayer";
import LogCirclesLayer from "@/components/map/layers/LogCirclesLayer";
import ProjectPolygonsLayer from "@/components/map/overlays/ProjectPolygonsLayer";
import DrawingToolsLayer from "@/components/map/tools/DrawingToolsLayer";

import MapLegend from "@/components/map/MapLegend";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { loadSavedViewport, saveViewport } from "@/utils/viewport";
import { parseWKTToCoordinates } from "@/utils/wkt";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const MAP_CONTAINER_STYLE = { height: "calc(100vh - 64px)", width: "100%" };

const toYmdLocal = (d) => {
  if (!(d instanceof Date)) return "";
  const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

const extractLogsFromResponse = (response) => {
  if (!response) return [];
  
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.Data)) return response.Data;
  if (Array.isArray(response.logs)) return response.logs;
  if (Array.isArray(response.result)) return response.result;
  if (Array.isArray(response.Result)) return response.Result;
  
  return [];
};

export const normalizeProviderName = (raw) => {
  if (!raw) return "Unknown";
  const s = String(raw).trim();
  if (/^\/+$/.test(s)) return "Unknown";
  if (s.replace(/\s+/g, "") === "404011") return "Unknown";

  const cleaned = s.toUpperCase().replace(/[\s\-_]/g, "");

  if (cleaned.includes("JIO") || cleaned.includes("JIOTRUE")) return "Jio";
  if (cleaned.includes("AIRTEL")) return "Airtel";
  if (cleaned === "VI" || cleaned.includes("VIINDIA") || cleaned.includes("VODAFONE") || cleaned.includes("IDEA")) return "VI India";
  if (cleaned.includes("BSNL")) return "BSNL";

  return "Unknown";
};

export const normalizeTechName = (tech) => {
  if (!tech) return "Unknown";
  const t = String(tech).trim().toUpperCase();

  if (t.includes("5G") || t.includes("NR")) return "5G";
  if (t.includes("LTE") || t.includes("4G")) return "4G";
  if (t.includes("3G")) return "3G";
  if (t.includes("2G") || t.includes("EDGE")) return "2G";
  return "Unknown";
};

const coordinatesToWktPolygon = (coords) => {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const pointsString = coords.map((p) => `${p.lng} ${p.lat}`).join(", ");
  const firstPointString = `${coords[0].lng} ${coords[0].lat}`;
  return `POLYGON((${pointsString}, ${firstPointString}))`;
};

const MAP_STYLES = {
  default: null,
  clean: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  ],
  night: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }] },
    { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
    { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
    { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }] },
    { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }] },
  ],
};

const formatArea = (areaInMeters) => {
  if (!areaInMeters || areaInMeters < 1) return "N/A";
  if (areaInMeters > 1000000) return `${(areaInMeters / 1000000).toFixed(2)} km²`;
  return `${areaInMeters.toFixed(0)} m²`;
};

const getDayName = (index) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[index] || '';
};

const fitMapToMostlyLogs = (map, points) => {
  if (!map || !Array.isArray(points) || points.length === 0) return;
  
  const bounds = new window.google.maps.LatLngBounds();
  const lats = points.map(p => p.lat).filter(Number.isFinite).sort((a, b) => a - b);
  const lons = points.map(p => p.lon).filter(Number.isFinite).sort((a, b) => a - b);
  
  if (lats.length > 0 && lons.length > 0) {
    const q = 0.1;
    const lowerIdx = Math.floor(q * (lats.length - 1));
    const upperIdx = Math.ceil((1 - q) * (lats.length - 1));
    
    bounds.extend({ lat: lats[lowerIdx], lng: lons[lowerIdx] });
    bounds.extend({ lat: lats[upperIdx], lng: lons[upperIdx] });
    map.fitBounds(bounds);
  }
};

export default function HighPerfMap() {
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);
  const [map, setMap] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const [thresholds, setThresholds] = useState({});
  const [allSessions, setAllSessions] = useState([]);
  const [projectPolygons, setProjectPolygons] = useState([]);

  const [activeFilters, setActiveFilters] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState("rsrp");

  const [selectedSessionData, setSelectedSessionData] = useState(null);
  
  const [rawLogs, setRawLogs] = useState([]);
  const [displayedLogs, setDisplayedLogs] = useState([]);
  
  const [colorBy, setColorBy] = useState(null);

  const [ui, setUi] = useState({
    showSessions: true,
    clusterSessions: true,
    showLogsCircles: false,
    showHeatmap: false,
    renderVisibleLogsOnly: true,
    basemapStyle: "clean",
    showPolygons: false,
    selectedProjectId: null,
    drawEnabled: false,
    shapeMode: "polygon",
    drawPixelateRect: false,
    drawCellSizeMeters: 10,
    drawClearSignal: 0,
    showNeighbours: false,
    colorizeCells: true,
    timeFilterEnabled: false,
    timeMode: 'all',
    currentHour: 12,
    timeRange: [0, 23],
    selectedDays: [0, 1, 2, 3, 4, 5, 6],
    isTimePlaying: false,
    timeSpeed: 1,
  });

  const [analysis, setAnalysis] = useState(null);
  const [temporalAnalysis, setTemporalAnalysis] = useState(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isTimeControlsOpen, setIsTimeControlsOpen] = useState(false);
  const [polygonName, setPolygonName] = useState("");
  const [showCoverageHoleOnly, setShowCoverageHoleOnly] = useState(false);

  const [visibleBounds, setVisibleBounds] = useState(null);
  const idleListenerRef = useRef(null);
  const idleTimerRef = useRef(null);
  const [appSummary, setAppSummary] = useState(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const availableFilterOptions = useMemo(() => {
    if (!rawLogs || rawLogs.length === 0) {
      return { providers: [], technologies: [], bands: [] };
    }

    const providerSet = new Set();
    const techSet = new Set();
    const bandSet = new Set();

    rawLogs.forEach(log => {
      const provider = normalizeProviderName(log.provider || log.Provider || log.carrier);
      if (provider && provider !== "Unknown") {
        providerSet.add(provider);
      }

      const tech = normalizeTechName(log.network || log.Network || log.technology);
      if (tech && tech !== "Unknown") {
        techSet.add(tech);
      }

      const band = String(log.band || log.Band || "").trim();
      if (band && band !== "-1" && band !== "" && band !== "undefined") {
        bandSet.add(band);
      }
    });

    return {
      providers: Array.from(providerSet).sort().map(name => ({ id: name, name })),
      technologies: Array.from(techSet).sort().map(name => ({ id: name, name })),
      bands: Array.from(bandSet).sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return a.localeCompare(b);
      }).map(name => ({ id: name, name })),
    };
  }, [rawLogs]);

  // Fetch thresholds on mount
  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        if (res?.Data) {
          const d = res.Data;
          setThresholds({
            rsrp: JSON.parse(d.rsrp_json || "[]"),
            rsrq: JSON.parse(d.rsrq_json || "[]"),
            sinr: JSON.parse(d.sinr_json || "[]"),
            dl_thpt: JSON.parse(d.dl_tpt_json || d.dl_thpt_json || "[]"),
            ul_thpt: JSON.parse(d.ul_thpt_json || d.ul_tpt_json || "[]"),
            mos: JSON.parse(d.mos_json || "[]"),
            lte_bler: JSON.parse(d.lte_bler_json || "[]"),
            coveragehole: parseFloat(d.coveragehole_json) || -110,
          });
        }
      } catch (err) {
        toast.error("Could not load color thresholds.");
      }
    };
    fetchThresholds();
  }, []);

  useEffect(()=>{
    console.log(thresholds,"when threshold has value")
  },[thresholds])

  const fetchAllSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getSessions();
      const valid = (data || []).filter(
        (s) =>
          Number.isFinite(parseFloat(s.start_lat)) &&
          Number.isFinite(parseFloat(s.start_lon))
      );
      setAllSessions(valid);
    } catch (e) {
      toast.error(`Failed to fetch sessions: ${e?.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch sessions on initial load when no filters
  useEffect(() => {
    if (!isLoaded) return;
    
    if (!activeFilters) {
      fetchAllSessions();
    }
  }, [isLoaded, activeFilters, fetchAllSessions]);

  const fetchLogsFromApi = useCallback(async (dateFilters) => {
  setLogsLoading(true);
  try {
    const apiParams = {
      StartDate: toYmdLocal(dateFilters.startDate),
      EndDate: toYmdLocal(dateFilters.endDate),
    };

    if (dateFilters.provider && dateFilters.provider !== "ALL") {
      apiParams.Provider = dateFilters.provider;
    }
    if (dateFilters.technology && dateFilters.technology !== "ALL") {
      apiParams.Technology = dateFilters.technology;
    }
    if (dateFilters.band && dateFilters.band !== "ALL") {
      apiParams.Band = dateFilters.band;
    }

    const response = await mapViewApi.getLogsByDateRange(apiParams);

    // ⭐ Handle response structure: { data: [], app_summary: {} }
    let fetched = [];
    let appSummaryData = null;

    if (response) {
      // Get logs from response.data or response directly
      if (response.data && Array.isArray(response.data)) {
        fetched = response.data;
      } else if (Array.isArray(response)) {
        fetched = response;
      }

      // ⭐ Get app_summary from response
      if (response.app_summary) {
        appSummaryData = response.app_summary;
      }
    }

    if (!fetched || fetched.length === 0) {
      toast.warn("No logs found for the selected date range.");
      setRawLogs([]);
      setDisplayedLogs([]);
      setAppSummary(null);
      return [];
    }

    setRawLogs(fetched);
    setAppSummary(appSummaryData); // ⭐ Store the full app_summary
    
    if (map) {
      const points = fetched
        .map(log => ({
          lat: parseFloat(log.lat),
          lon: parseFloat(log.lon),
        }))
        .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
      
      if (points.length > 0) {
        fitMapToMostlyLogs(map, points);
      }
    }

    toast.success(`Loaded ${fetched.length} logs.`);
    return fetched;
  } catch (error) {
    toast.error(`Failed to fetch logs: ${error?.message || "Unknown error"}`);
    setRawLogs([]);
    setDisplayedLogs([]);
    setAppSummary(null);
    return [];
  } finally {
    setLogsLoading(false);
  }
}, [map]);

  const applyLocalFilters = useCallback((logs, filters) => {
    if (!logs || logs.length === 0) return [];

    let filtered = [...logs];

    if (filters.provider && filters.provider !== "ALL") {
      filtered = filtered.filter(log => {
        const logProvider = normalizeProviderName(log.provider || log.Provider || log.carrier);
        return logProvider === filters.provider;
      });
    }

    if (filters.technology && filters.technology !== "ALL") {
      filtered = filtered.filter(log => {
        const logTech = normalizeTechName(log.network || log.Network || log.technology);
        return logTech === filters.technology;
      });
    }

    if (filters.band && filters.band !== "ALL") {
      filtered = filtered.filter(log => {
        const logBand = String(log.band || log.Band || "").trim();
        return logBand === filters.band;
      });
    }

    if (filters.coverageHoleOnly) {
      const threshold = thresholds.coveragehole || -110;
      filtered = filtered.filter(log => {
        const rsrp = parseFloat(log.rsrp);
        return Number.isFinite(rsrp) && rsrp < threshold;
      });
    }

    return filtered;
  }, [thresholds]);

  const handleApplyFilters = useCallback(async (filters) => {
    const dateChanged = 
      !activeFilters ||
      toYmdLocal(filters.startDate) !== toYmdLocal(activeFilters.startDate) ||
      toYmdLocal(filters.endDate) !== toYmdLocal(activeFilters.endDate);

    const apiFiltersChanged = dateChanged ||
      filters.provider !== activeFilters?.provider ||
      filters.technology !== activeFilters?.technology ||
      filters.band !== activeFilters?.band;

    setActiveFilters(filters);
    setSelectedMetric(String(filters.measureIn || "rsrp").toLowerCase());
    setSelectedSessionData(null);
    setAnalysis(null);
    setTemporalAnalysis(null);
    setUi(u => ({ 
      ...u, 
      showLogsCircles: true,
      showSessions: false,
    }));
    setShowCoverageHoleOnly(filters.coverageHoleOnly || false);
    setColorBy(filters.colorBy || null);

    let logsToFilter = rawLogs;

    if (apiFiltersChanged) {
      logsToFilter = await fetchLogsFromApi(filters);
    }

    const filtered = applyLocalFilters(logsToFilter, filters);
    setDisplayedLogs(filtered);
  }, [activeFilters, rawLogs, fetchLogsFromApi, applyLocalFilters]);

  const handleClearFilters = useCallback(() => {
    setActiveFilters(null);
    setSelectedSessionData(null);
    setRawLogs([]);
    setDisplayedLogs([]);
    setAnalysis(null);
    setTemporalAnalysis(null);
    setColorBy(null);
    setAppSummary(null);
    setUi((u) => ({
      ...u,
      showHeatmap: false,
      drawEnabled: false,
      timeFilterEnabled: false,
      showLogsCircles: false,
      showSessions: true,
    }));
    fetchAllSessions();
  }, [fetchAllSessions]);

  const handleUIChange = (partial) => setUi((prev) => ({ ...prev, ...partial }));

  const handleSessionMarkerClick = async (session) => {
  setIsLoading(true);
  try {
    const response = await mapViewApi.getNetworkLog(session.id);
    const logs = extractLogsFromResponse(response);
    
    setSelectedSessionData({ 
      session, 
      logs 
    });
    
    if (logs.length === 0) {
      toast.warn(`No logs found for session ${session.id}`);
    }
  } catch (e) {
    toast.error(`Failed to fetch logs for session ${session.id}: ${e?.message || "Unknown error"}`);
    setSelectedSessionData(null);
  } finally {
    setIsLoading(false);
  }
};

  useEffect(() => {
    const loadPolygons = async () => {
      if (!ui.showPolygons || !ui.selectedProjectId) {
        setProjectPolygons([]);
        return;
      }
      setIsLoading(true);
      try {
        const rows = await mapViewApi.getProjectPolygons({ projectId: ui.selectedProjectId });
        const parsed = (rows || []).map((r) => ({
          id: r.id,
          name: r.name,
          rings: parseWKTToCoordinates(r.wkt),
        }));
        setProjectPolygons(parsed);
      } catch (err) {
        toast.error("Failed to load project polygons");
      } finally {
        setIsLoading(false);
      }
    };
    loadPolygons();
  }, [ui.showPolygons, ui.selectedProjectId]);

  const onMapLoad = useCallback((m) => {
    setMap(m);
    const saved = loadSavedViewport();
    if (saved) {
      m.setCenter({ lat: saved.lat, lng: saved.lng });
      m.setZoom(saved.zoom);
    }
    idleListenerRef.current = m.addListener("idle", () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        saveViewport(m);
        const b = m.getBounds?.();
        if (b) {
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          setVisibleBounds({
            north: ne.lat(),
            east: ne.lng(),
            south: sw.lat(),
            west: sw.lng(),
          });
        }
      }, 120);
    });
  }, []);

  const onMapUnmount = useCallback(() => {
    try {
      if (idleListenerRef.current) {
        window.google?.maps?.event?.removeListener?.(idleListenerRef.current);
      }
    } catch {}
    idleListenerRef.current = null;
    setMap(null);
  }, []);

  const handleDownloadStatsCsv = useCallback(() => {
    if (!analysis || !analysis.stats) {
      toast.error("No polygon stats available. Draw a shape first.");
      return;
    }

    const csvRows = [
      ["Metric", "Value"],
      ["Shape Type", analysis.type || "N/A"],
      ["Total Logs Inside", analysis.count || 0],
      ["Mean", analysis.stats.mean?.toFixed(2) || "N/A"],
      ["Median", analysis.stats.median?.toFixed(2) || "N/A"],
      ["Min", analysis.stats.min?.toFixed(2) || "N/A"],
      ["Max", analysis.stats.max?.toFixed(2) || "N/A"],
      ["Selected Metric", selectedMetric],
    ];

    if (analysis.grid) {
      csvRows.push(
        ["Grid Cells", analysis.grid.cells],
        ["Cell Size (meters)", analysis.grid.cellSizeMeters]
      );
    }

    if (analysis.timeFilter) {
      csvRows.push(
        ["", ""],
        ["Time Filter", ""],
        ["Mode", analysis.timeFilter.mode],
      );
      if (analysis.timeFilter.mode === 'single') {
        csvRows.push(["Hour", `${analysis.timeFilter.currentHour}:00`]);
      } else if (analysis.timeFilter.mode === 'range') {
        csvRows.push([
          "Time Range", 
          `${analysis.timeFilter.timeRange[0]}:00 - ${analysis.timeFilter.timeRange[1]}:00`
        ]);
      }
      csvRows.push(["Days Selected", analysis.timeFilter.selectedDays.join(', ')]);
    }

    if (analysis.temporalPatterns) {
      csvRows.push(
        ["", ""],
        ["Temporal Analysis", ""],
        ["Peak Hour", `${analysis.temporalPatterns.peakHour}:00`],
        ["Peak Day", getDayName(analysis.temporalPatterns.peakDay)],
      );
    }

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polygon_stats_${selectedMetric}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Stats CSV downloaded!");
  }, [analysis, selectedMetric]);

  const handleDownloadRawCsv = useCallback(() => {
    if (!analysis || !analysis.logs || !analysis.logs.length) {
      toast.error("No logs inside polygon. Draw a shape with data first.");
      return;
    }

    const logsInside = analysis.logs;

    const headers = [
      "latitude",
      "longitude",
      "rsrp",
      "rsrq",
      "sinr",
      "dl_throughput",
      "ul_throughput",
      "mos",
      "lte_bler",
      "timestamp",
      "carrier",
      "technology",
    ];

    const csvRows = [
      headers.join(","),
      ...logsInside.map((log) => {
        return headers
          .map((h) => {
            let val =
              log[h] ??
              log[h.replace("_", "-")] ??
              log[h.replace("dl_throughput", "dl_tpt")] ??
              log[h.replace("ul_throughput", "ul_thpt")] ??
              "";

            if (h === "latitude" && !val) {
              val = log.lat ?? log.latitude ?? log.Latitude ?? "";
            }
            if (h === "longitude" && !val) {
              val = log.lng ?? log.lon ?? log.longitude ?? log.Longitude ?? "";
            }

            return typeof val === "string" && val.includes(",")
              ? `"${val}"`
              : val;
          })
          .join(",");
      }),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polygon_raw_logs_${selectedMetric}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(`Raw CSV downloaded (${logsInside.length} logs inside polygon)!`);
  }, [analysis, selectedMetric]);

  const handleTimeAnalysis = useCallback((patterns) => {
    setTemporalAnalysis(patterns);
  }, []);

  const handleSavePolygon = async () => {
    if (!analysis || !analysis.geometry) {
      toast.warn("No analysis data or geometry found to save.");
      return;
    }
    if (!polygonName.trim()) {
      toast.warn("Please provide a name for the polygon.");
      return;
    }

    let wktString = null;
    const geometry = analysis.geometry;

    if (geometry.type === "polygon" && geometry.polygon) {
      wktString = coordinatesToWktPolygon(geometry.polygon);
    } else if (geometry.type === "rectangle" && geometry.rectangle) {
      const { ne, sw } = geometry.rectangle;
      const rectCoords = [
        { lng: sw.lng, lat: ne.lat },
        { lng: ne.lng, lat: ne.lat },
        { lng: ne.lng, lat: sw.lat },
        { lng: sw.lng, lat: sw.lat },
      ];
      wktString = coordinatesToWktPolygon(rectCoords);
    } else if (geometry.type === "circle" && geometry.circle) {
      const { center, radius } = geometry.circle;
      const circleCoords = [];
      const numPoints = 32;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 360;
        const latOffset = (radius / 111111) * Math.cos((angle * Math.PI) / 180);
        const lngOffset =
          (radius / (111111 * Math.cos((center.lat * Math.PI) / 180))) *
          Math.sin((angle * Math.PI) / 180);
        circleCoords.push({
          lat: center.lat + latOffset,
          lng: center.lng + lngOffset,
        });
      }
      wktString = coordinatesToWktPolygon(circleCoords);
    }

    if (!wktString) {
      toast.error("Could not convert the drawn shape to WKT format.");
      return;
    }

    const payload = {
      Name: polygonName,
      WKT: wktString,
      SessionIds: Array.isArray(analysis.session) ? analysis.session : [],
    };

    setIsLoading(true);
    try {
      const response = await mapViewApi.savePolygon(payload);
      if (response && response.Status === 1) {
        toast.success(`Polygon "${polygonName}" saved successfully!`);
        setIsSaveDialogOpen(false);
        setPolygonName("");
      } else {
        toast.error(response?.Message || "Failed to save polygon.");
      }
    } catch (error) {
      toast.error(`Error saving polygon: ${error.message || "An unknown error occurred."}`);
    } finally {
      setIsLoading(false);
    }
  };

  const mapOptions = useMemo(() => {
    const standardMapTypes = ["roadmap", "satellite", "hybrid", "terrain"];
    const styleKey = ui.basemapStyle || "roadmap";

    const options = {
      disableDefaultUI: false,
      zoomControl: true,
      gestureHandling: "greedy",
    };

    if (standardMapTypes.includes(styleKey)) {
      options.mapId = MAP_ID;
      options.mapTypeId = styleKey;
    } else if (MAP_STYLES[styleKey]) {
      options.mapTypeId = "roadmap";
      options.styles = MAP_STYLES[styleKey];
    } else {
      options.mapId = MAP_ID;
      options.mapTypeId = "roadmap";
    }

    return options;
  }, [ui.basemapStyle]);

  if (loadError) return <div>Error loading Google Maps.</div>;
  if (!isLoaded) return <div className="p-4">Loading map…</div>;

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      <MapHeader
        ui={ui}
        onUIChange={handleUIChange}
        hasLogs={!!activeFilters && displayedLogs.length > 0}
        polygonStats={analysis}
        onDownloadStatsCsv={handleDownloadStatsCsv}
        onDownloadRawCsv={handleDownloadRawCsv}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
        initialFilters={activeFilters}
        isSearchOpen={isSearchOpen}
        onSearchToggle={() => setIsSearchOpen((prev) => !prev)}
        thresholds={thresholds}
        logs={displayedLogs}
        availableFilterOptions={availableFilterOptions}
        rawLogsCount={rawLogs.length}
        isLoading={logsLoading}
      />

      <div className="relative flex-1">
        <GoogleMap
          mapContainerStyle={MAP_CONTAINER_STYLE}
          center={DEFAULT_CENTER}
          zoom={13}
          onLoad={onMapLoad}
          onUnmount={onMapUnmount}
          options={mapOptions}
        >
          {isSearchOpen && <MapSearchBox />}

          {!activeFilters && ui.showSessions && (
            <SessionsLayer
              map={map}
              sessions={allSessions}
              onClick={handleSessionMarkerClick}
              cluster={ui.clusterSessions}
            />
          )}

          {activeFilters && displayedLogs.length > 0 && (
            <LogCirclesLayer
              map={map}
              logs={displayedLogs}
              selectedMetric={selectedMetric}
              thresholds={thresholds}
              showCircles={ui.showLogsCircles && !(ui.drawPixelateRect && analysis)}
              showHeatmap={ui.showHeatmap}
              visibleBounds={ui.renderVisibleLogsOnly ? visibleBounds : null}
              setAppSummary={setAppSummary}
              renderVisibleOnly={ui.renderVisibleLogsOnly}
              canvasRadiusPx={(zoom) => Math.max(3, Math.min(7, Math.floor(zoom / 2)))}
              maxDraw={80000}
              colorBy={colorBy}
              showNeighbours={ui.showNeighbours}
            />
          )}

          {ui.showPolygons && (
            <ProjectPolygonsLayer
              polygons={projectPolygons}
              onClick={(poly) => toast.info(poly.name || `Region ${poly.id}`)}
            />
          )}

          {ui.drawEnabled && (
            <DrawingToolsLayer
              map={map}
              enabled={ui.drawEnabled}
              logs={displayedLogs}
              selectedMetric={selectedMetric}
              thresholds={thresholds}
              pixelateRect={ui.drawPixelateRect}
              cellSizeMeters={ui.drawCellSizeMeters || 100}
              onSummary={setAnalysis}
              clearSignal={ui.drawClearSignal || 0}
              maxCells={1500}
              onDrawingsChange={() => {}}
              colorizeCells={ui.colorizeCells}
              timeSettings={{
                timeFilterEnabled: ui.timeFilterEnabled,
                timeMode: ui.timeMode,
                currentHour: ui.currentHour,
                timeRange: ui.timeRange,
                selectedDays: ui.selectedDays,
              }}
              onTimeAnalysis={handleTimeAnalysis}
            />
          )}
        </GoogleMap>

        {ui.drawEnabled && (
          <button
            onClick={() => setIsTimeControlsOpen(!isTimeControlsOpen)}
            className={`absolute top-4 right-4 z-40 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
              isTimeControlsOpen
                ? "bg-purple-600 text-white"
                : "bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Time Filter</span>
          </button>
        )}

        {isTimeControlsOpen && ui.drawEnabled && (
          <TimeControlsPanel
            ui={ui}
            onUIChange={handleUIChange}
            hasLogs={displayedLogs.length > 0}
            onClose={() => setIsTimeControlsOpen(false)}
          />
        )}

        {activeFilters && (ui.showLogsCircles || ui.showHeatmap) && (
          <MapLegend
            thresholds={thresholds}
            selectedMetric={selectedMetric}
            colorBy={colorBy}
            logs={displayedLogs}
          />
        )}

        {analysis && (
          <div className="absolute bottom-4 left-4 z-30 bg-white/95 dark:bg-gray-900/95 rounded-lg shadow-xl p-4 min-w-[280px] max-w-[320px] border border-gray-200 max-h-[80vh] overflow-y-auto">
            <div className="font-semibold mb-2 text-gray-800 dark:text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                Selection Stats
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSaveDialogOpen(true)}
              >
                <Save className="h-4 w-4 mr-2" />
                Save
              </Button>
            </div>
            
            <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1.5">
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Shape:</span>
                <span className="font-medium capitalize">{analysis.type}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Area:</span>
                <span className="font-medium">{formatArea(analysis.area)}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-1">
                <span className="text-gray-600">Total Logs:</span>
                <span className="font-medium">{analysis.count}</span>
              </div>

              {analysis.timeFilter && (
                <div className="mt-3 pt-2 border-t-2 border-purple-200">
                  <div className="font-medium text-purple-700 mb-2 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Time Filter Active
                  </div>
                  <div className="text-xs space-y-1 bg-purple-50 p-2 rounded">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Mode:</span>
                      <span className="font-medium capitalize">{analysis.timeFilter.mode}</span>
                    </div>
                    {analysis.timeFilter.mode === 'single' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Hour:</span>
                        <span className="font-medium">{analysis.timeFilter.currentHour}:00</span>
                      </div>
                    )}
                    {analysis.timeFilter.mode === 'range' && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Range:</span>
                        <span className="font-medium">
                          {analysis.timeFilter.timeRange[0]}:00 - {analysis.timeFilter.timeRange[1]}:00
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Days:</span>
                      <span className="font-medium">
                        {analysis.timeFilter.selectedDays.length}/7 selected
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {analysis.temporalPatterns && (
                <div className="mt-3 pt-2 border-t-2 border-blue-200">
                  <div className="font-medium text-blue-700 mb-2">📈 Temporal Patterns</div>
                  <div className="text-xs space-y-1 bg-blue-50 p-2 rounded">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Peak Hour:</span>
                      <span className="font-medium text-blue-600">
                        {analysis.temporalPatterns.peakHour}:00
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Peak Day:</span>
                      <span className="font-medium text-blue-600">
                        {getDayName(analysis.temporalPatterns.peakDay)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {analysis.grid && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Cell Size:</span>
                    <span className="font-medium">{analysis.grid.cellSizeMeters}m</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Active Grid Cells:</span>
                    <span className="font-medium">{analysis.grid.cellsWithLogs}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Grid Area:</span>
                    <span className="font-medium">{formatArea(analysis.grid.totalGridArea)}</span>
                  </div>
                </div>
              )}

              {analysis.stats?.count > 0 ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Mean:</span>
                    <span className="font-medium text-blue-600">
                      {analysis.stats.mean?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Median:</span>
                    <span className="font-medium text-green-600">
                      {analysis.stats.median?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Range:</span>
                    <span className="font-medium text-orange-600">
                      {analysis.stats.min?.toFixed(2)} → {analysis.stats.max?.toFixed(2)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-gray-500 italic text-center py-2">
                  No metric values in selection
                </div>
              )}
            </div>
          </div>
        )}

        <SessionDetailPanel
          sessionData={selectedSessionData}
          isLoading={isLoading}
          thresholds={thresholds}
          selectedMetric={selectedMetric}
          onClose={() => setSelectedSessionData(null)}
        />

        <AllLogsPanelToggle
          logs={displayedLogs}
          thresholds={thresholds}
          selectedMetric={selectedMetric}
          appSummary={appSummary}
          isLoading={logsLoading}
          startDate={activeFilters?.startDate}
          endDate={activeFilters?.endDate}
        />

        {(isLoading || logsLoading) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 dark:bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-lg font-medium text-gray-700">Loading…</span>
            </div>
          </div>
        )}

        <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Save Polygon Analysis</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="name" className="text-right">
                  Name
                </Label>
                <Input
                  id="name"
                  value={polygonName}
                  onChange={(e) => setPolygonName(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., Sector 15 Coverage Gap"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSavePolygon} disabled={!polygonName.trim() || isLoading}>
                {isLoading ? "Saving..." : "Save Polygon"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}