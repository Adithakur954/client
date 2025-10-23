// src/pages/PredictionMap.jsx
import React, { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import { GoogleMap, useJsApiLoader, CircleF, PolygonF } from "@react-google-maps/api";
import { toast } from "react-toastify";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";
import { mapViewApi } from "@/api/apiEndpoints";
import Spinner from "@/components/common/Spinner";
import PredictionDetailsPanel from "@/components/prediction/PredictionDetailsPanel";
import PredictionHeader from "@/components/prediction/PredictionHeader";
import PredictionSide from "@/components/prediction/PredictionSide"; // adjust path if needed
import { useSearchParams } from "react-router-dom";
import { Filter } from "lucide-react";

// ================== CONFIG ==================
const MAP_CONTAINER_STYLE = { height: "calc(100vh - 64px)", width: "100%" };
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };
const MAX_RENDER_POINTS = 5000;
const MAX_RENDER_POLYGONS = 800;

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
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    { featureType: "water", stylers: [{ color: "#17263c" }] },
  ],
};

// ================== WKT PARSER ==================
function parseWKTToPolygons(wkt) {
  if (!wkt || typeof wkt !== "string") return [];
  const s = wkt.trim().toUpperCase();
  if (s.startsWith("POLYGON")) {
    const inner = extractOuterParensContent(s, "POLYGON");
    const rings = parseRings(inner);
    return [{ paths: rings }];
  }
  if (s.startsWith("MULTIPOLYGON")) {
    const inner = extractOuterParensContent(s, "MULTIPOLYGON");
    const polyStrings = extractTopLevelGroups(inner);
    const polys = [];
    for (const ps of polyStrings) {
      const innerPoly = stripOnePair(ps);
      const rings = parseRings(innerPoly);
      polys.push({ paths: rings });
    }
    return polys;
  }
  return [];
}
function extractOuterParensContent(text, type) {
  const idx = text.indexOf(type);
  if (idx === -1) return "";
  const after = text.slice(idx + type.length).trim();
  const start = after.indexOf("(");
  let depth = 0;
  for (let i = start; i < after.length; i++) {
    if (after[i] === "(") depth++;
    else if (after[i] === ")") depth--;
    if (depth === 0) return after.slice(start + 1, i);
  }
  return "";
}
function extractTopLevelGroups(inner) {
  const groups = [];
  let depth = 0, start = -1;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") { if (depth === 0) start = i; depth++; }
    else if (inner[i] === ")") {
      depth--;
      if (depth === 0 && start !== -1) groups.push(inner.slice(start, i + 1));
    }
  }
  return groups;
}
function stripOnePair(s) {
  return s.trim().startsWith("(") && s.endsWith(")") ? s.slice(1, -1) : s;
}
function parseRings(inner) {
  const rings = [];
  let depth = 0, start = -1;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === "(") { if (depth === 0) start = i; depth++; }
    else if (inner[i] === ")") {
      depth--;
      if (depth === 0 && start !== -1) {
        const ring = parseCoordsToRing(inner.slice(start + 1, i));
        if (ring.length >= 3) rings.push(ring);
      }
    }
  }
  return rings;
}
function parseCoordsToRing(ringStr) {
  const points = ringStr.split(",").map(p => {
    const [x, y] = p.trim().split(/\s+/).map(Number);
    return { lat: y, lng: x };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  return points;
}

// ================== GEO & COLOR UTILS ==================
const computeRingBbox = (ring = []) => {
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  ring.forEach(pt => {
    north = Math.max(north, pt.lat);
    south = Math.min(south, pt.lat);
    east = Math.max(east, pt.lng);
    west = Math.min(west, pt.lng);
  });
  return { north, south, east, west };
};
const bboxIntersects = (a, b) => a && b ? !(a.west > b.east || a.east < b.west || a.south > b.north || a.north < b.south) : false;
function pointInRing(pt, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng, yi = ring[i].lat, xj = ring[j].lng, yj = ring[j].lat;
    const intersect = ((yi > pt.lat) !== (yj > pt.lat)) &&
      (pt.lng < (xj - xi) * (pt.lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
function pointInPolygonWithHoles(point, paths) {
  if (!paths?.length || !pointInRing(point, paths[0])) return false;
  for (let i = 1; i < paths.length; i++) if (pointInRing(point, paths[i])) return false;
  return true;
}
const compileColorScale = (settings = []) => {
  const scale = settings.map(c => ({ min: +c.min, max: +c.max, color: c.color }))
    .filter(c => !isNaN(c.min) && !isNaN(c.max)).sort((a, b) => a.min - b.min);
  return v => (scale.find(s => v >= s.min && v <= s.max)?.color ?? "#999");
};

// ================== LAYERS ==================
const CirclesLayer = memo(({ points, getColor, radius = 15 }) =>
  points.map((p, i) =>
    <CircleF key={p.id ?? i} center={{ lat: p.lat, lng: p.lon }}
      radius={radius} options={{ fillColor: getColor(p.prm), strokeWeight: 0, fillOpacity: 0.8 }} />)
);
const PolygonsLayer = memo(({ polygons }) =>
  polygons.flatMap((poly, i) =>
    <PolygonF key={poly.uid ?? i} paths={poly.paths}
      options={{ fillColor: "#4285F4", fillOpacity: 0.15, strokeColor: "#FF3D00", strokeWeight: 2 }} />)
);

// ================== MAIN PAGE ==================
export default function PredictionMapPage() {
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState(1);
  const [metric, setMetric] = useState("rsrp"); // UI uses lowercase
  const [predictionData, setPredictionData] = useState(null);
  const [polygons, setPolygons] = useState([]);
  const [showPolys, setShowPolys] = useState(true);
  const [onlyInside, setOnlyInside] = useState(false);
  const [uiToggles, setUiToggles] = useState({ basemapStyle: "clean" });
  const [viewport, setViewport] = useState(null);
  const [isSideOpen, setIsSideOpen] = useState(false);

  const mapRef = useRef(null);

  // Read project and session from URL (back-compat)
  const sessionParam = useMemo(
    () => searchParams.get("sessionId") ?? searchParams.get("session") ?? "",
    [searchParams]
  );
  
  useEffect(() => {
    const p = searchParams.get("project_id") ?? searchParams.get("project");
    if (p && Number(p) !== projectId) setProjectId(Number(p));
  }, [searchParams]); // eslint-disable-line

  const { dataList = [], colorSetting = [] } = predictionData || {};
  const getColor = useMemo(() => compileColorScale(colorSetting), [colorSetting]);

  const fetchPredictionData = useCallback(async () => {
    if (!projectId) return toast.info("Enter Project ID");
    setLoading(true);
    console.log(sessionParam,"dta to checck sessionn")
    try {
      const res = await mapViewApi.getPredictionLog({
        projectId,
        metric: String(metric).toUpperCase(), // API expects uppercase
      });
      if (res?.Status === 1 && res?.Data) {
        setPredictionData(res.Data);
        toast.success("Prediction data loaded");
      } else toast.error(res?.Message || "No data");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, metric]);

  const fetchPolygons = useCallback(async () => {
    try {
      const res = await mapViewApi.getProjectPolygons(projectId);
      const items = Array.isArray(res?.Data) ? res.Data : [];
      const parsed = items.flatMap((item, i) =>
        parseWKTToPolygons(item.wkt).map((p, k) => ({
          ...item, uid: `${i}-${k}`, paths: p.paths,
          bbox: computeRingBbox(p.paths?.[0] || []),
        }))
      );
      setPolygons(parsed);
    } catch (e) {
      console.error(e); toast.error("Failed to fetch polygons");
    }
  }, [projectId]);

  const reloadData = useCallback(() => {
    // normalize project key in URL
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (projectId) {
        next.set("project", String(projectId));
        next.delete("projectId");
      } else {
        next.delete("project");
        next.delete("projectId");
      }
      // preserve incoming session if present
      if (sessionParam) {
        next.set("session", sessionParam);
        next.delete("sessionId");
      }
      return next;
    });
    fetchPredictionData();
    fetchPolygons();
  }, [fetchPredictionData, fetchPolygons, projectId, sessionParam, setSearchParams]);

  useEffect(() => {
    // initial load (and when component mounts)
    fetchPredictionData();
    fetchPolygons();
  }, []); // eslint-disable-line

  const handleMapLoad = useCallback(map => {
    mapRef.current = map;
    const updateViewport = () => {
      const b = map.getBounds(); if (!b) return;
      const ne = b.getNorthEast(), sw = b.getSouthWest();
      setViewport({ north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() });
    };
    map.addListener("idle", updateViewport);
    updateViewport();
  }, []);

  const visiblePolygons = useMemo(() =>
    polygons.filter(p => bboxIntersects(p.bbox, viewport)).slice(0, MAX_RENDER_POLYGONS),
    [viewport, polygons]
  );
  const visiblePoints = useMemo(() => {
    if (!viewport) return [];
    let pts = dataList.filter(p => p.lat >= viewport.south && p.lat <= viewport.north);
    if (onlyInside && visiblePolygons.length)
      pts = pts.filter(pt => visiblePolygons.some(p => pointInPolygonWithHoles(pt, p.paths)));
    return pts.slice(0, MAX_RENDER_POINTS);
  }, [viewport, dataList, onlyInside, visiblePolygons]);

  const mapOptions = useMemo(() => {
    const styleKey = uiToggles.basemapStyle || "roadmap";
    const options = { disableDefaultUI: true, zoomControl: true, gestureHandling: "greedy" };
    if (["roadmap", "satellite", "terrain", "hybrid"].includes(styleKey))
      options.mapTypeId = styleKey;
    else if (MAP_STYLES[styleKey]) options.styles = MAP_STYLES[styleKey];
    return options;
  }, [uiToggles]);

  if (loadError) return <div>Error loading map</div>;
  if (!isLoaded) return <div className="h-screen flex items-center justify-center"><Spinner /></div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <PredictionHeader
        projectId={projectId} setProjectId={setProjectId}
        metric={metric} setMetric={setMetric}
        reloadData={reloadData}
        showPolys={showPolys} setShowPolys={setShowPolys}
        onlyInside={onlyInside} setOnlyInside={setOnlyInside}
        loading={loading} ui={uiToggles} onUIChange={setUiToggles}
      />

      {/* Optional quick toggle for the drawer (mobile friendly) */}
      <div className="px-4 pt-2">
        <button
          onClick={() => setIsSideOpen(v => !v)}
          className="flex gap-1 items-center bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md px-3 py-1"
        >
          <Filter className="h-4" />
          {isSideOpen ? "Close Filters" : "Open Filters"}
        </button>
      </div>

      <div className="flex-grow flex p-4 gap-4 overflow-hidden">
        <div className="flex-grow rounded-lg border shadow-md overflow-hidden relative">
          <GoogleMap mapContainerStyle={MAP_CONTAINER_STYLE}
            center={DEFAULT_CENTER} zoom={12} onLoad={handleMapLoad}
            options={mapOptions}>
            {showPolys && <PolygonsLayer polygons={visiblePolygons} />}
            <CirclesLayer points={visiblePoints} getColor={getColor} radius={15} />
          </GoogleMap>
          {loading && <div className="absolute inset-0 flex items-center justify-center bg-white/60"><Spinner /></div>}
          <div className="absolute bottom-2 left-2 bg-white/90 rounded px-2 py-1 text-xs shadow">
            <div>Total points: {dataList.length} | Shown: {visiblePoints.length}</div>
            <div>Total polygons: {polygons.length} | Shown: {visiblePolygons.length}</div>
          </div>
        </div>
        <div className="w-full lg:w-1/3 flex-shrink-0 overflow-y-auto">
          <PredictionDetailsPanel predictionData={predictionData} metric={metric} loading={loading} />
        </div>
      </div>

      {/* Drawer */}
      <PredictionSide
        open={isSideOpen}
        onOpenChange={setIsSideOpen}
        loading={loading}
        ui={uiToggles}
        onUIChange={setUiToggles}
        metric={metric}
        setMetric={setMetric}
        projectId={projectId}
        setProjectId={setProjectId}
        reloadData={reloadData}
        showPolys={showPolys}
        setShowPolys={setShowPolys}
        onlyInside={onlyInside}
        setOnlyInside={setOnlyInside}
        sessionId={sessionParam} // preserve session(s) when navigating back
      />
    </div>
  );
}