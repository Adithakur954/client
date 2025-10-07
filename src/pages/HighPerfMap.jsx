import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import { toast } from "react-toastify";

// APIs
import { adminApi, mapViewApi, settingApi } from "@/api/apiEndpoints";

// Floating filter drawer and panels
import MapSidebarFloating from "@/components/map/layout/MapSidebarFloating";
import SessionDetailPanel from "@/components/map/layout/SessionDetail";
import AllLogsPanelToggle from "@/components/map/layout/AllLogsPanelToggle";

// Layers
import SessionsLayer from "@/components/map/overlays/SessionsLayer";
import LogCirclesLayer from "@/components/map/layers/LogCirclesLayer";
import ProjectPolygonsLayer from "@/components/map/overlays/ProjectPolygonsLayer";
import DrawingToolsLayer from "@/components/map/tools/DrawingToolsLayer";

// UI
import MapLegend from "@/components/map/MapLegend";

// Utils
import { loadSavedViewport, saveViewport } from "@/utils/viewport";
import { parseWKTToRings } from "@/utils/wkt";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const MAP_CONTAINER_STYLE = { height: "100vh", width: "100%" };

// Ensure your loader options include: libraries: ["drawing", "geometry", "visualization"]
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

export default function HighPerfMap() {
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);
  const [map, setMap] = useState(null);

  // Loading flags
  const [isLoading, setIsLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Data state
  const [thresholds, setThresholds] = useState({});
  const [allSessions, setAllSessions] = useState([]);
  const [projectPolygons, setProjectPolygons] = useState([]);

  // Filters and metric
  const [activeFilters, setActiveFilters] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState("rsrp");

  // Session detail
  const [selectedSessionData, setSelectedSessionData] = useState(null);

  // Logs (for summary panel and drawing analysis)
  const [drawnLogs, setDrawnLogs] = useState([]);

  // UI toggles (extended with drawing controls)
  const [ui, setUi] = useState({
    showSessions: true,
    clusterSessions: true,
    showLogsCircles: true,
    showHeatmap: false,
    renderVisibleLogsOnly: true,
    basemapStyle: "clean",
    showPolygons: false,
    selectedProjectId: null,

    // Drawing
    drawEnabled: false,
    drawPixelateRect: false,
    drawCellSizeMeters: 100,
    drawClearSignal: 0,
  });

  const [analysis, setAnalysis] = useState(null);

  // Bounds persistence and debounce
  const [visibleBounds, setVisibleBounds] = useState(null);
  const idleListenerRef = useRef(null);
  const idleTimerRef = useRef(null);

  // Load thresholds
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
          });
        }
      } catch {
        toast.error("Could not load color thresholds.");
      }
    };
    fetchThresholds();
  }, []);

  // Load sessions
  const fetchAllSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getSessions();
      const valid = (data || []).filter(
        (s) => Number.isFinite(parseFloat(s.start_lat)) && Number.isFinite(parseFloat(s.start_lon))
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

  // Polygons
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
          rings: parseWKTToRings(r.wkt),
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

  // Map load/unmount
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

  // Sidebar handlers
  const handleApplyFilters = (filters) => {
    setActiveFilters(filters);
    setSelectedMetric(String(filters.measureIn || "rsrp").toLowerCase());
    setSelectedSessionData(null);
    setDrawnLogs([]);
    setAnalysis(null);
    setUi((u) => ({ ...u, showLogsCircles: true }));
  };

  const handleClearFilters = useCallback(() => {
    setActiveFilters(null);
    setSelectedSessionData(null);
    setDrawnLogs([]);
    setAnalysis(null);
    setUi((u) => ({ ...u, showHeatmap: false }));
    fetchAllSessions();
  }, [fetchAllSessions]);

  const handleUIChange = (partial) => setUi((prev) => ({ ...prev, ...partial }));

  // Session click -> panel
  const handleSessionMarkerClick = async (session) => {
    setIsLoading(true);
    try {
      const logs = await mapViewApi.getNetworkLog(session.id);
      setSelectedSessionData({ session, logs: logs || [] });
    } catch (e) {
      toast.error(`Failed to fetch logs for session ${session.id}: ${e?.message || "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const mapStyles = useMemo(() => MAP_STYLES[ui.basemapStyle] || null, [ui.basemapStyle]);

  if (loadError) return <div>Error loading Google Maps.</div>;
  if (!isLoaded) return <div className="p-4">Loading map…</div>;

  return (
    <div className="relative h-full w-full">
      <MapSidebarFloating
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
        onUIChange={handleUIChange}
        ui={ui}
        initialFilters={activeFilters}
        position="left"
        autoCloseOnApply={true}
      />

      

      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={DEFAULT_CENTER}
        zoom={13}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapId: MAP_ID,
          styles: mapStyles,
          gestureHandling: "greedy",
        }}
      >
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
            onLogsLoaded={(list) => setDrawnLogs(Array.isArray(list) ? list : [])}
            setIsLoading={setLogsLoading}
            showCircles={ui.showLogsCircles}
            showHeatmap={ui.showHeatmap}
            visibleBounds={ui.renderVisibleLogsOnly ? visibleBounds : null}
            renderVisibleOnly={ui.renderVisibleLogsOnly}
            canvasRadiusPx={(zoom) => Math.max(3, Math.min(7, Math.floor(zoom / 2)))}
            maxDraw={80000}
          />
        )}

        {ui.showPolygons && (
          <ProjectPolygonsLayer
            polygons={projectPolygons}
            onClick={(poly) => toast.info(poly.name || `Region ${poly.id}`)}
          />
        )}

        {/* Drawing tools layer */}
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
        <MapLegend thresholds={thresholds} selectedMetric={selectedMetric} />
      )}

      {/* Selection stats panel */}
      {analysis && (
        <div className="absolute bottom-4 left-4 z-30 bg-white/95 dark:bg-gray-900/95 rounded-md shadow p-3 min-w-[240px]">
          <div className="font-medium mb-1">Selection stats</div>
          <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
            <div>Shape: {analysis.type}</div>
            <div>Logs: {analysis.count}</div>
            {analysis.stats?.count > 0 ? (
              <>
                <div>Mean: {analysis.stats.mean?.toFixed(2)}</div>
                <div>Median: {analysis.stats.median?.toFixed(2)}</div>
                <div>Max: {analysis.stats.max?.toFixed(2)}</div>
                <div>Min: {analysis.stats.min?.toFixed(2)}</div>
                {analysis.grid ? (
                  <div className="text-xs text-gray-500 mt-1">
                    Grid: ~{analysis.grid.cells} cells @ {analysis.grid.cellSizeMeters}m
                  </div>
                ) : null}
              </>
            ) : (
              <div>No metric values in selection.</div>
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
      />

      {(isLoading || logsLoading) && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 dark:bg-black/70">
          <div>Loading…</div>
        </div>
      )}
    </div>
  );
}