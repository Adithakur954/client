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
import { Save } from "lucide-react";

// APIs
import { adminApi, mapViewApi, settingApi } from "@/api/apiEndpoints";

// Layout components
import MapHeader from "@/components/map/layout/MapHeader";
import SessionDetailPanel from "@/components/map/layout/SessionDetail";
import AllLogsPanelToggle from "@/components/map/layout/AllLogsPanelToggle";

// Layers
import SessionsLayer from "@/components/map/overlays/SessionsLayer";
import LogCirclesLayer from "@/components/map/layers/LogCirclesLayer";
import ProjectPolygonsLayer from "@/components/map/overlays/ProjectPolygonsLayer";
import DrawingToolsLayer from "@/components/map/tools/DrawingToolsLayer";

// UI
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

// Utils
import { loadSavedViewport, saveViewport } from "@/utils/viewport";
import { parseWKTToCoordinates } from "@/utils/wkt";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const MAP_CONTAINER_STYLE = { height: "calc(100vh - 64px)", width: "100%" };
const coordinatesToWktPolygon = (coords) => {
  if (!Array.isArray(coords) || coords.length < 3) {
    return null; // Need at least 3 points for a polygon
  }
  // Format each point as "lng lat" and join with commas
  const pointsString = coords.map((p) => `${p.lng} ${p.lat}`).join(", ");
  // Ensure the polygon is closed by repeating the first point at the end
  const firstPointString = `${coords[0].lng} ${coords[0].lat}`;
  // WKT format requires longitude first, then latitude
  return `POLYGON((${pointsString}, ${firstPointString}))`;
};

const MAP_STYLES = {
  default: null,
  clean: [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    {
      featureType: "road",
      elementType: "labels.icon",
      stylers: [{ visibility: "off" }],
    },
    { elementType: "labels.text.stroke", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#6b7280" }] },
  ],
  night: [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }],
    },
  ],
};
const formatArea = (areaInMeters) => {
  if (!areaInMeters || areaInMeters < 1) return "N/A";
  if (areaInMeters > 1000000) {
    return `${(areaInMeters / 1000000).toFixed(2)} km²`;
  }
  return `${areaInMeters.toFixed(0)} m²`;
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
  const [drawnLogs, setDrawnLogs] = useState([]);
  const [colorBy, setColorBy] = useState(null);

  const [ui, setUi] = useState({
    showSessions: true,
    clusterSessions: true,
    showLogsCircles: true,
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
  });

  const [analysis, setAnalysis] = useState(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [polygonName, setPolygonName] = useState("");
  const [showCoverageHoleOnly, setShowCoverageHoleOnly] = useState(false);

  const [visibleBounds, setVisibleBounds] = useState(null);
  const idleListenerRef = useRef(null);
  const idleTimerRef = useRef(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
            dl_thpt: JSON.parse(d.dl_thpt_json || "[]"),
            ul_thpt: JSON.parse(d.ul_thpt_json || "[]"),
            mos: JSON.parse(d.mos_json || "[]"),
            lte_bler: JSON.parse(d.lte_bler_json || "[]"),
            coveragehole: parseFloat(d.coveragehole_json) || -110,
          });
        }
      } catch {
        toast.error("Could not load color thresholds.");
      }
    };
    fetchThresholds();
  }, []);

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

  useEffect(() => {
    if (isLoaded && !activeFilters) fetchAllSessions();
  }, [isLoaded, fetchAllSessions, activeFilters]);

  useEffect(() => {
    const loadPolygons = async () => {
      if (!ui.showPolygons || !ui.selectedProjectId) {
        setProjectPolygons([]);
        return;
      }
      setIsLoading(true);
      try {
        const rows = await mapViewApi.getProjectPolygons({
          projectId: ui.selectedProjectId,
        });
        const parsed = (rows || []).map((r) => ({
          id: r.id,
          name: r.name,
          rings: parseWKTToCoordinates(r.wkt),
        }));
        setProjectPolygons(parsed);
      } catch (err) {
        console.error("Failed to load polygons", err);
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

  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
    setSelectedMetric(String(filters.measureIn || "rsrp").toLowerCase());
    setSelectedSessionData(null);
    setDrawnLogs([]);
    setAnalysis(null);
    setUi((u) => ({ ...u, showLogsCircles: true }));
    setShowCoverageHoleOnly(filters.coverageHoleOnly || false);
    setColorBy(filters.colorBy || null);
  };

  const handleClearFilters = useCallback(() => {
    setActiveFilters(null);
    setSelectedSessionData(null);
    setDrawnLogs([]);
    setAnalysis(null);
    setColorBy(null);
    setUi((u) => ({ ...u, showHeatmap: false, drawEnabled: false }));
    fetchAllSessions();
  }, [fetchAllSessions]);

  const handleUIChange = (partial) =>
    setUi((prev) => ({ ...prev, ...partial }));

  const handleSessionMarkerClick = async (session) => {
    setIsLoading(true);
    try {
      const logs = await mapViewApi.getNetworkLog(session.id);
      
      setSelectedSessionData({ session, logs: logs || [] });
    } catch (e) {
      toast.error(
        `Failed to fetch logs for session ${session.id}: ${
          e?.message || "Unknown error"
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

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

    // Convert geometry coordinates to WKT based on type
    if (geometry.type === "polygon" && geometry.polygon) {
      wktString = coordinatesToWktPolygon(geometry.polygon);
    } else if (geometry.type === "rectangle" && geometry.rectangle) {
      // Convert rectangle bounds to a polygon coordinate array first
      const { ne, sw } = geometry.rectangle;
      const rectCoords = [
        { lng: sw.lng, lat: ne.lat }, // Top-left
        { lng: ne.lng, lat: ne.lat }, // Top-right
        { lng: ne.lng, lat: sw.lat }, // Bottom-right
        { lng: sw.lng, lat: sw.lat }, // Bottom-left
        // Closing point is added by coordinatesToWktPolygon
      ];
      wktString = coordinatesToWktPolygon(rectCoords);
    } else if (geometry.type === "circle" && geometry.circle) {
      // Approximate circle as a polygon for WKT
      const { center, radius } = geometry.circle;
      const circleCoords = [];
      const numPoints = 32; // More points make a smoother circle approximation
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 360;
        // Approximate degrees based on meters (latitude doesn't change much locally)
        const latOffset = (radius / 111111) * Math.cos((angle * Math.PI) / 180);
        // Longitude offset depends on latitude
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

    // Prepare payload matching the C# controller
    const payload = {
      Name: polygonName,
      WKT: wktString, //try to send in array os session
      SessionIds: Array.isArray(analysis.session) ? analysis.session : [], 
      
    };

  
  

    setIsLoading(true); // Indicate loading state
    try {
      // Use the correct API endpoint function name
      const response = await mapViewApi.savePolygon(payload);
      if (response && response.Status === 1) {
        // Check response structure
        toast.success(`Polygon "${polygonName}" saved successfully!`);
        setIsSaveDialogOpen(false); // Close dialog on success
        setPolygonName(""); // Reset name field
        // Optionally: Trigger a refresh of polygons if needed
      } else {
        // Use message from response if available
        toast.error(
          response?.Message || "Failed to save polygon. Check server logs."
        );
        console.error("SavePolygon API Error:", response);
      }
    } catch (error) {
      toast.error(
        `Error saving polygon: ${error.message || "An unknown error occurred."}`
      );
      console.error("SavePolygon Network/Catch Error:", error);
    } finally {
      setIsLoading(false); // End loading state
    }
  };

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

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `polygon_stats_${selectedMetric}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("✅ Stats CSV downloaded!");
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
              log[h.replace("dl_throughput", "dl_thpt")] ??
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
    link.download = `polygon_raw_logs_${selectedMetric}_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success(
      `✅ Raw CSV downloaded (${logsInside.length} logs inside polygon)!`
    );
  }, [analysis, selectedMetric]);

  const mapOptions = useMemo(() => {
    const standardMapTypes = ["roadmap", "satellite", "hybrid", "terrain"];
    const styleKey = ui.basemapStyle || "roadmap";

    const options = {
      disableDefaultUI: false,
      zoomControl: true,
      mapId: MAP_ID,
      gestureHandling: "greedy",
      mapTypeId: "roadmap",
      styles: null,
    };

    if (standardMapTypes.includes(styleKey)) {
      options.mapTypeId = styleKey;
    } else if (MAP_STYLES[styleKey]) {
      options.mapTypeId = "roadmap";
      options.styles = MAP_STYLES[styleKey];
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
        hasLogs={!!activeFilters && drawnLogs.length > 0}
        polygonStats={analysis}
        onDownloadStatsCsv={handleDownloadStatsCsv}
        onDownloadRawCsv={handleDownloadRawCsv}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
        initialFilters={activeFilters}
        isSearchOpen={isSearchOpen}
        onSearchToggle={() => setIsSearchOpen((prev) => !prev)}
        thresholds={thresholds}
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

          {activeFilters && (
            <LogCirclesLayer
              map={map}
              filters={activeFilters}
              selectedMetric={selectedMetric}
              thresholds={thresholds}
              onLogsLoaded={(list) =>
                setDrawnLogs(Array.isArray(list) ? list : [])
              }
              setIsLoading={setLogsLoading}
              showCircles={
                ui.showLogsCircles && !(ui.drawPixelateRect && analysis)
              }
              showHeatmap={ui.showHeatmap}
              visibleBounds={ui.renderVisibleLogsOnly ? visibleBounds : null}
              renderVisibleOnly={ui.renderVisibleLogsOnly}
              canvasRadiusPx={(zoom) =>
                Math.max(3, Math.min(7, Math.floor(zoom / 2)))
              }
              maxDraw={80000}
              coverageHoleOnly={showCoverageHoleOnly}
              colorBy={colorBy}
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
              logs={drawnLogs}
              selectedMetric={selectedMetric}
              thresholds={thresholds}
              pixelateRect={ui.drawPixelateRect}
              cellSizeMeters={ui.drawCellSizeMeters || 100}
              onSummary={setAnalysis}
              clearSignal={ui.drawClearSignal || 0}
              maxCells={1500}
            />
          )}
        </GoogleMap>

        {activeFilters && (ui.showLogsCircles || ui.showHeatmap) && (
          <MapLegend
            thresholds={thresholds}
            selectedMetric={selectedMetric}
            colorBy={colorBy}
          />
        )}

        {analysis && (
          <div className="absolute bottom-4 left-4 z-30 bg-white/95 dark:bg-gray-900/95 rounded-lg shadow-xl p-4 min-w-[260px] border border-gray-200">
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
              {analysis.grid && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Cell Size:</span>
                    <span className="font-medium">
                      {analysis.grid.cellSizeMeters}m
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Active Grid Cells:</span>
                    <span className="font-medium">
                      {analysis.grid.cellsWithLogs}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Grid Area:</span>
                    <span className="font-medium">
                      {formatArea(analysis.grid.totalGridArea)}
                    </span>
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
                      {analysis.stats.min?.toFixed(2)} →{" "}
                      {analysis.stats.max?.toFixed(2)}
                    </span>
                  </div>
                  {analysis.grid && (
                    <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                      <div className="flex justify-between">
                        <span>Grid Cells:</span>
                        <span className="font-medium">
                          {analysis.grid.cells}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Cell Size:</span>
                        <span className="font-medium">
                          {analysis.grid.cellSizeMeters}m
                        </span>
                      </div>
                    </div>
                  )}
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
          logs={drawnLogs}
          thresholds={thresholds}
          selectedMetric={selectedMetric}
          isLoading={logsLoading}
          startDate={activeFilters?.startDate} // ✅ Add this
          endDate={activeFilters?.endDate}
        />

        {(isLoading || logsLoading) && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 dark:bg-black/70 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl p-6 flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="text-lg font-medium text-gray-700">
                Loading…
              </span>
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
              <Button
                variant="outline"
                onClick={() => setIsSaveDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSavePolygon}
                disabled={!polygonName.trim() || isLoading}
              >
                {isLoading ? "Saving..." : "Save Polygon"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
