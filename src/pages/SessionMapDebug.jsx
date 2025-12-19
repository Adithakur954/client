import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { mapViewApi } from '../api/apiEndpoints';
import Spinner from '../components/common/Spinner';
import { ArrowLeft, Download, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '@/lib/googleMapsLoader';
import { toast } from 'react-toastify';
import { useMapContext } from '../context/MapContext';
import DrawingToolsLayer from '@/components/map/tools/DrawingToolsLayer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Constants
const containerStyle = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  top: 0,
  left: 0
};

const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };

const MAP_OPTIONS = {
  mapTypeControl: true,
  streetViewControl: false,
  fullscreenControl: true,
  zoomControl: true,
  gestureHandling: 'greedy',
};

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

// Helper function to convert coordinates to WKT
const coordinatesToWktPolygon = (coords) => {
  if (!Array.isArray(coords) || coords.length < 3) return null;
  const pointsString = coords.map((p) => `${p.lng} ${p.lat}`).join(", ");
  const firstPointString = `${coords[0].lng} ${coords[0].lat}`;
  return `POLYGON((${pointsString}, ${firstPointString}))`;
};

// RSRP color function
const getColorForRSRP = (rsrp) => {
  if (rsrp >= -80) return '#00FF00';
  if (rsrp >= -90) return '#FFFF00';
  if (rsrp >= -100) return '#FFA500';
  if (rsrp >= -110) return '#FF6600';
  return '#FF0000';
};

// Canvas overlay component for circles
function CanvasCirclesOverlay({ map, logs }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    if (!map || !logs.length || !window.google) return;

    class CirclesOverlay extends window.google.maps.OverlayView {
      constructor() {
        super();
        this.canvas = null;
      }

      onAdd() {
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.pointerEvents = 'none';
        const panes = this.getPanes();
        if (panes) {
          panes.overlayLayer.appendChild(this.canvas);
        }
      }

      draw() {
        if (!this.canvas) return;
        const projection = this.getProjection();
        if (!projection) return;

        const bounds = map.getBounds();
        if (!bounds) return;

        const ne = projection.fromLatLngToDivPixel(bounds.getNorthEast());
        const sw = projection.fromLatLngToDivPixel(bounds.getSouthWest());

        if (!ne || !sw) return;

        const width = Math.abs(ne.x - sw.x);
        const height = Math.abs(ne.y - sw.y);

        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.left = sw.x + 'px';
        this.canvas.style.top = ne.y + 'px';

        const ctx = this.canvas.getContext('2d');
        ctx.clearRect(0, 0, width, height);

        const zoom = map.getZoom() || 12;
        const radius = Math.max(3, Math.min(8, zoom - 10));

        logs.forEach(pt => {
          try {
            const latLng = new window.google.maps.LatLng(pt.lat, pt.lng);
            const pixel = projection.fromLatLngToDivPixel(latLng);
            if (pixel) {
              const x = pixel.x - sw.x;
              const y = pixel.y - ne.y;

              ctx.beginPath();
              ctx.arc(x, y, radius, 0, Math.PI * 2);
              ctx.fillStyle = getColorForRSRP(pt.rsrp);
              ctx.globalAlpha = 0.6;
              ctx.fill();
              ctx.globalAlpha = 1;
            }
          } catch (e) {
            // Skip invalid points
          }
        });
      }

      onRemove() {
        if (this.canvas && this.canvas.parentNode) {
          this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
      }
    }

    const overlay = new CirclesOverlay();
    overlay.setMap(map);
    overlayRef.current = overlay;

    const idleListener = map.addListener('idle', () => {
      if (overlayRef.current) {
        overlayRef.current.draw();
      }
    });

    return () => {
      if (idleListener) {
        window.google.maps.event.removeListener(idleListener);
      }
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
    };
  }, [map, logs]);

  return null;
}

function SessionMapDebug() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [map, setMap] = useState(null);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });
  const [analysis, setAnalysis] = useState(null);

  // Save Polygon State
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [polygonName, setPolygonName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { ui, updateUI, setDownloadHandlers, setPolygonStats, setHasLogs } = useMapContext();

  const sessionIdParam = searchParams.get('sessionId') || searchParams.get('sessionIds');

  const sessionIds = useMemo(() => {
    if (!sessionIdParam) return [];
    return sessionIdParam
      .split(',')
      .map(id => id.trim())
      .filter(id => id && id !== 'undefined' && id !== 'null');
  }, [sessionIdParam]);

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const safeUi = useMemo(() => ({
    drawEnabled: false,
    shapeMode: "polygon",
    drawPixelateRect: false,
    drawCellSizeMeters: 100,
    drawClearSignal: 0,
    colorizeCells: true,
    ...ui,
  }), [ui]);

  // Save Polygon Handler
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

    // Convert Geometry to WKT
    if (geometry.type === "polygon" && geometry.polygon) {
      wktString = coordinatesToWktPolygon(geometry.polygon);
    } else if (geometry.type === "rectangle" && geometry.rectangle) {
      const { ne, sw } = geometry.rectangle;
      const rectCoords = [
        { lng: sw.lng, lat: ne.lat },
        { lng: ne.lng, lat: ne.lat },
        { lng: ne.lng, lat: sw.lat },
        { lng: sw.lng, lat: sw.lat }
      ];
      wktString = coordinatesToWktPolygon(rectCoords);
    } else if (geometry.type === "circle" && geometry.circle) {
      const { center, radius } = geometry.circle;
      const circleCoords = [];
      const numPoints = 32;
      for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 360;
        const latOffset = (radius / 111111) * Math.cos((angle * Math.PI) / 180);
        const lngOffset = (radius / (111111 * Math.cos((center.lat * Math.PI) / 180))) * Math.sin((angle * Math.PI) / 180);
        circleCoords.push({ lat: center.lat + latOffset, lng: center.lng + lngOffset });
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
      SessionIds: sessionIds || []
    };

    setIsSaving(true);
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
      setIsSaving(false);
    }
  };

  // Download handlers
  const handleStatsDownload = useCallback(() => {
    if (logs.length === 0) {
      toast.error('No data to download');
      return;
    }

    const rsrpValues = logs.map(log => log.rsrp).filter(v => !isNaN(v));
    const sortedValues = [...rsrpValues].sort((a, b) => a - b);

    const csvRows = [
      ['Metric', 'Value'],
      ['Session IDs', sessionIds.join('; ')],
      ['Total Points', logs.length],
      ['RSRP Mean', (rsrpValues.reduce((a, b) => a + b, 0) / rsrpValues.length).toFixed(2)],
      ['RSRP Min', Math.min(...rsrpValues).toFixed(2)],
      ['RSRP Max', Math.max(...rsrpValues).toFixed(2)],
    ];

    const blob = new Blob([csvRows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `stats_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success('Stats downloaded!');
  }, [logs, sessionIds]);

  const handleRawDownload = useCallback(() => {
    if (logs.length === 0) {
      toast.error('No logs to download');
      return;
    }

    const rows = [
      'session_id,lat,lng,rsrp,rsrq,sinr',
      ...logs.map(l => `${l.sessionId},${l.lat},${l.lng},${l.rsrp},${l.rsrq || ''},${l.sinr || ''}`)
    ];

    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success(`Downloaded ${logs.length} points!`);
  }, [logs]);

  // Register handlers using ref to avoid re-renders
  const handlersRef = useRef({ stats: handleStatsDownload, raw: handleRawDownload });
  handlersRef.current = { stats: handleStatsDownload, raw: handleRawDownload };

  useEffect(() => {
    setDownloadHandlers({
      onDownloadStatsCsv: () => handlersRef.current.stats(),
      onDownloadRawCsv: () => handlersRef.current.raw(),
      onFetchLogs: () => toast.info('Logs already loaded'),
    });
  }, [setDownloadHandlers]);

  // Update stats when logs change
  const prevLogsLengthRef = useRef(0);
  useEffect(() => {
    if (logs.length !== prevLogsLengthRef.current) {
      prevLogsLengthRef.current = logs.length;

      if (logs.length > 0) {
        const rsrpValues = logs.map(l => l.rsrp).filter(v => !isNaN(v));
        const sorted = [...rsrpValues].sort((a, b) => a - b);

        setPolygonStats({
          count: logs.length,
          type: 'session',
          logs,
          stats: {
            count: rsrpValues.length,
            mean: rsrpValues.reduce((a, b) => a + b, 0) / rsrpValues.length,
            min: Math.min(...rsrpValues),
            max: Math.max(...rsrpValues),
            median: sorted[Math.floor(sorted.length / 2)]
          },
          intersectingSessions: sessionIds.map(id => ({ id }))
        });
        setHasLogs(true);
      } else {
        setPolygonStats(null);
        setHasLogs(false);
      }
    }
  }, [logs.length, sessionIds, setPolygonStats, setHasLogs]);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (sessionIds.length === 0) {
        setError('No session ID(s) provided');
        setLoading(false);
        return;
      }

      setLoading(true);
      const allPoints = [];

      for (let i = 0; i < sessionIds.length; i++) {
        setFetchProgress({ current: i + 1, total: sessionIds.length });

        try {
          const response = await mapViewApi.getNetworkLog({ session_id: sessionIds[i] });
          let rawData = Array.isArray(response) ? response :
            response?.data ? (Array.isArray(response.data) ? response.data : response.data.Data || []) :
            response?.Data || [];

          const points = rawData
            .map((log, idx) => ({
              lat: parseFloat(log.lat || log.Lat || log.latitude),
              lng: parseFloat(log.lon || log.lng || log.longitude),
              rsrp: parseFloat(log.rsrp || log.RSRP || -120),
              rsrq: parseFloat(log.rsrq || log.RSRQ || 0),
              sinr: parseFloat(log.sinr || log.SINR || 0),
              sessionId: sessionIds[i],
              id: `${sessionIds[i]}-${idx}`,
            }))
            .filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng));

          allPoints.push(...points);
        } catch (err) {
          console.error(`Error fetching session ${sessionIds[i]}:`, err);
        }
      }

      if (allPoints.length === 0) {
        setError('No valid data found');
      } else {
        toast.success(`Loaded ${allPoints.length} points`);
      }

      setLogs(allPoints);
      setLoading(false);
    };

    fetchData();
  }, [sessionIds.join(',')]);

  // Auto-fit map
  useEffect(() => {
    if (map && logs.length > 0 && window.google) {
      const bounds = new window.google.maps.LatLngBounds();
      logs.forEach(pt => bounds.extend({ lat: pt.lat, lng: pt.lng }));
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [map, logs.length]);

  // Stable callbacks
  const onMapLoad = useCallback((m) => setMap(m), []);
  const onMapUnmount = useCallback(() => setMap(null), []);
  
  const handleDrawingSummary = useCallback((stats) => {
    setAnalysis(stats);
    setPolygonStats(stats);
  }, [setPolygonStats]);

  const handleDrawingsChange = useCallback(() => {}, []);
  const goBack = useCallback(() => navigate(-1), [navigate]);

  const handleCloseAnalysis = useCallback(() => {
    setAnalysis(null);
    setPolygonStats(null);
  }, [setPolygonStats]);

  const mapCenter = useMemo(() =>
    logs.length > 0 ? { lat: logs[0].lat, lng: logs[0].lng } : DEFAULT_CENTER
  , [logs[0]?.lat, logs[0]?.lng]);

  // Loading state
  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900">
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-white">
            {loading && fetchProgress.total > 1
              ? `Loading ${fetchProgress.current}/${fetchProgress.total}...`
              : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError || error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-red-400">{loadError?.message || error}</p>
          <Button onClick={goBack} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={mapCenter}
        zoom={12}
        onLoad={onMapLoad}
        onUnmount={onMapUnmount}
        options={MAP_OPTIONS}
      >
        {map && logs.length > 0 && <CanvasCirclesOverlay map={map} logs={logs} />}

        {map && (
          <DrawingToolsLayer
            map={map}
            enabled={safeUi.drawEnabled}
            logs={logs}
            sessions={EMPTY_ARRAY}
            thresholds={EMPTY_OBJECT}
            selectedMetric="rsrp"
            shapeMode={safeUi.shapeMode}
            pixelateRect={safeUi.drawPixelateRect}
            cellSizeMeters={safeUi.drawCellSizeMeters}
            colorizeCells={safeUi.colorizeCells}
            onSummary={handleDrawingSummary}
            onDrawingsChange={handleDrawingsChange}
            clearSignal={safeUi.drawClearSignal}
          />
        )}
      </GoogleMap>

      

      

      {/* Enhanced Analysis Panel with Save Option */}
      {analysis && (
        <div className="absolute bottom-4 left-4 z-30 bg-white rounded-lg shadow-lg w-[280px] border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-blue-600 rounded-t-lg">
            <h3 className="font-semibold text-white text-sm">Selection Stats</h3>
            <button
              onClick={handleCloseAnalysis}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-3 text-xs space-y-2">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded px-2 py-1.5">
                <div className="text-[10px] text-gray-500">Shape</div>
                <div className="font-medium text-gray-800 capitalize">{analysis.type}</div>
              </div>
              <div className="bg-gray-50 rounded px-2 py-1.5">
                <div className="text-[10px] text-gray-500">Logs Inside</div>
                <div className="font-medium text-gray-800">{analysis.count || 0}</div>
              </div>
            </div>

            {/* Stats */}
            {analysis.stats?.mean && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-50 rounded px-2 py-1.5 border border-blue-100">
                  <div className="text-[10px] text-blue-600">Mean RSRP</div>
                  <div className="font-bold text-blue-700">{analysis.stats.mean.toFixed(2)} dBm</div>
                </div>
                <div className="bg-green-50 rounded px-2 py-1.5 border border-green-100">
                  <div className="text-[10px] text-green-600">Median</div>
                  <div className="font-bold text-green-700">{analysis.stats.median?.toFixed(2) || '-'} dBm</div>
                </div>
                <div className="bg-orange-50 rounded px-2 py-1.5 border border-orange-100">
                  <div className="text-[10px] text-orange-600">Min</div>
                  <div className="font-bold text-orange-700">{analysis.stats.min?.toFixed(2) || '-'} dBm</div>
                </div>
                <div className="bg-red-50 rounded px-2 py-1.5 border border-red-100">
                  <div className="text-[10px] text-red-600">Max</div>
                  <div className="font-bold text-red-700">{analysis.stats.max?.toFixed(2) || '-'} dBm</div>
                </div>
              </div>
            )}

            {/* Area info if available */}
            {analysis.area > 0 && (
              <div className="bg-gray-50 rounded px-2 py-1.5">
                <div className="text-[10px] text-gray-500">Area</div>
                <div className="font-medium text-gray-800">
                  {analysis.area > 1000000
                    ? `${(analysis.area / 1000000).toFixed(2)} km²`
                    : `${analysis.area.toFixed(0)} m²`}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-3 py-2 border-t border-gray-200 bg-gray-50 rounded-b-lg flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => setIsSaveDialogOpen(true)}
              disabled={!analysis.geometry}
            >
              <Save className="h-3 w-3 mr-1.5" />
              Save Polygon
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={handleStatsDownload}
              title="Download Stats CSV"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Save Polygon Dialog */}
      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-800">Save Polygon Analysis</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="polygon-name" className="text-right text-gray-700">
                Name
              </Label>
              <Input
                id="polygon-name"
                value={polygonName}
                onChange={(e) => setPolygonName(e.target.value)}
                className="col-span-3 bg-white border-gray-300 text-gray-800"
                placeholder="e.g., Low Coverage Zone A"
              />
            </div>
            {analysis && (
              <div className="text-xs text-gray-500 ml-[calc(25%+1rem)]">
                Shape: <span className="capitalize">{analysis.type}</span> • 
                Logs: {analysis.count || 0}
                {analysis.stats?.mean && ` • Avg: ${analysis.stats.mean.toFixed(1)} dBm`}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsSaveDialogOpen(false)}
              className="border-gray-300 text-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePolygon}
              disabled={!polygonName.trim() || isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? "Saving..." : "Save Polygon"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SessionMapDebug;