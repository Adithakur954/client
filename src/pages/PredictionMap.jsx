// src/pages/PredictionMap.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  memo,
} from 'react';
import { GoogleMap, useJsApiLoader, CircleF, PolygonF } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../lib/googleMapsLoader';
import { mapViewApi } from '../api/apiEndpoints';
import Spinner from '../components/common/Spinner';

// ================== CONFIG ==================
const MAP_CONTAINER_STYLE = { height: '100%', width: '100%' };
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };
const MAX_RENDER_POINTS = 5000;
const MAX_RENDER_POLYGONS = 800; // adjust to your comfort

// ================== WKT PARSER (robust, lon/lat -> lat/lng) ==================
function parseWKTToPolygons(wkt) {
  if (!wkt || typeof wkt !== 'string') return [];

  const s = wkt.trim().toUpperCase().startsWith('MULTIPOLYGON')
    ? wkt.trim()
    : wkt.trim();

  if (s.startsWith('POLYGON')) {
    const inner = extractOuterParensContent(s, 'POLYGON');
    const rings = parseRings(inner);
    if (!rings.length) return [];
    return [{ paths: rings }];
  }

  if (s.startsWith('MULTIPOLYGON')) {
    const inner = extractOuterParensContent(s, 'MULTIPOLYGON');
    const polyStrings = extractTopLevelGroups(inner); // each like ((...))
    const polys = [];
    for (const ps of polyStrings) {
      const innerPoly = stripOnePair(ps); // remove one pair of ()
      const rings = parseRings(innerPoly);
      if (rings.length) polys.push({ paths: rings });
    }
    return polys;
  }

  return [];
}

// Helpers for WKT
function extractOuterParensContent(text, type) {
  // type is 'POLYGON' or 'MULTIPOLYGON'
  const idx = text.toUpperCase().indexOf(type);
  if (idx === -1) return '';
  const after = text.slice(idx + type.length).trim();
  const start = after.indexOf('(');
  if (start === -1) return '';
  let depth = 0;
  for (let i = start; i < after.length; i++) {
    const ch = after[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth === 0) {
      return after.slice(start + 1, i); // content without the outer ()
    }
  }
  return '';
}

function extractTopLevelGroups(inner) {
  // Given a string like "((...)),((...)),((...))", return ["((...))","((...))","((...))"]
  const groups = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        groups.push(inner.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return groups;
}

function stripOnePair(s) {
  s = s.trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    return s.slice(1, -1);
  }
  return s;
}

function parseRings(inner) {
  // inner looks like "(x y, x y, ...),(x y, ...)" with each ring wrapped in parentheses
  const rings = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        const ringStr = inner.slice(start + 1, i); // content inside this ring
        const ring = parseCoordsToRing(ringStr);
        if (ring.length >= 3) rings.push(ring);
        start = -1;
      }
    }
  }
  return rings;
}

function parseCoordsToRing(ringStr) {
  // "x y, x y, x y"
  const points = [];
  const pairs = ringStr.split(',');
  for (let p of pairs) {
    const parts = p.trim().split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;
    const x = Number(parts[0]); // lon
    const y = Number(parts[1]); // lat
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ lat: y, lng: x }); // lon/lat -> lat/lng
  }
  // Remove closing duplicate if present
  if (points.length >= 4) {
    const f = points[0];
    const l = points[points.length - 1];
    if (almostEqual(f.lat, l.lat) && almostEqual(f.lng, l.lng)) {
      points.pop();
    }
  }
  return points;
}

function almostEqual(a, b, eps = 1e-12) {
  return Math.abs(a - b) <= eps;
}

// ================== GEO UTILS ==================
const computeRingBbox = (ring = []) => {
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const pt of ring) {
    if (!Number.isFinite(pt.lat) || !Number.isFinite(pt.lng)) continue;
    north = Math.max(north, pt.lat);
    south = Math.min(south, pt.lat);
    east = Math.max(east, pt.lng);
    west = Math.min(west, pt.lng);
  }
  if (north === -Infinity) return null;
  return { north, south, east, west };
};

const bboxIntersects = (a, b) => {
  if (!a || !b) return false;
  return !(a.west > b.east || a.east < b.west || a.south > b.north || a.north < b.south);
};

// Point-in-ring using ray casting
function pointInRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng, yi = ring[i].lat;
    const xj = ring[j].lng, yj = ring[j].lat;
    const intersect = ((yi > point.lat) !== (yj > point.lat)) &&
      (point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Point in polygon with holes: inside outer and not in any hole
function pointInPolygonWithHoles(point, paths) {
  if (!paths?.length) return false;
  const outer = paths[0];
  if (!pointInRing(point, outer)) return false;
  for (let i = 1; i < paths.length; i++) {
    if (pointInRing(point, paths[i])) return false; // inside a hole
  }
  return true;
}

// ================== COLOR SCALE ==================
const compileColorScale = (colorSetting = []) => {
  const scale = (colorSetting || [])
    .map(c => ({ min: Number(c.min), max: Number(c.max), color: c.color }))
    .filter(c => Number.isFinite(c.min) && Number.isFinite(c.max) && c.color)
    .sort((a, b) => a.min - b.min);
  return (val) => {
    for (const band of scale) {
      if (val >= band.min && val <= band.max) return band.color;
    }
    return '#808080';
  };
};

// ================== MEMOIZED LAYERS ==================
const CirclesLayer = memo(function CirclesLayer({ points, getColor, radius = 15, zIndex = 2 }) {
  const baseOptions = useMemo(() => ({
    strokeWeight: 0,
    fillOpacity: 0.8,
    zIndex,
    clickable: false,
  }), [zIndex]);

  return points.map((p, i) => (
    <CircleF
      key={p.id ?? `pt-${i}`}
      center={{ lat: p.lat, lng: p.lon }}
      radius={radius}
      options={{ ...baseOptions, fillColor: getColor(p.prm) }}
    />
  ));
});

// Draw polygons as two layers (fill below, outline above)
const PolygonsLayer = memo(function PolygonsLayer({
  polygons,
  strokeColor = '#FF3D00',
  strokeWeight = 4,
  showFill = true,
  showStroke = true,
}) {
  const fillOptions = useMemo(() => ({
    fillColor: '#4285F4',
    fillOpacity: 0.12,
    strokeOpacity: 0,   // no stroke on fill layer
    strokeWeight: 0,
    zIndex: 1,          // below circles
    clickable: false,
  }), []);

  const strokeOptions = useMemo(() => ({
    fillOpacity: 0,     // outline only
    strokeColor,
    strokeOpacity: 1,
    strokeWeight,
    zIndex: 3,          // above circles
    clickable: false,
  }), [strokeColor, strokeWeight]);

  return polygons.flatMap((poly, i) => {
    const paths = poly.paths;
    if (!Array.isArray(paths) || !paths.length || paths[0].length < 3) return [];
    const idPrefix = poly.uid ?? poly.id ?? `poly-${i}`;
    return [
      showFill ? <PolygonF key={`${idPrefix}-fill`} paths={paths} options={fillOptions} /> : null,
      showStroke ? <PolygonF key={`${idPrefix}-stroke`} paths={paths} options={strokeOptions} /> : null,
    ].filter(Boolean);
  });
});

// ================== LAZY LOADED CHART ==================
function PerformanceChart({ data, metric, loading }) {
  const [R, setR] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const mod = await import('recharts');
        if (!cancelled) setR(mod);
      } catch (e) {
        console.error('Failed to load chart library:', e);
      }
    };
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      window.requestIdleCallback(load);
    } else {
      setTimeout(load, 0);
    }
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center"><Spinner /></div>;
  }
  if (!data?.length) {
    return <div className="text-center text-gray-500 pt-10">No chart data.</div>;
  }
  if (!R) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading chart…</div>;
  }

  const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } = R;

  return (
    <ResponsiveContainer width="100%" height="90%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 10, width: 70 }} interval={0} />
        <Tooltip formatter={(value) => [`${Number(value)?.toFixed(1)}%`, 'Percentage']} />
        <Bar dataKey="value" background={{ fill: '#eee' }}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ================== MAIN PAGE ==================
const PredictionMapPage = () => {
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const [loading, setLoading] = useState(false);

  // Filters
  const [projectId, setProjectId] = useState(1);
  const [metric, setMetric] = useState('RSRP');

  // Data
  const [predictionData, setPredictionData] = useState(null);
  const [polygons, setPolygons] = useState([]);

  // UI toggles
  const [showPolys, setShowPolys] = useState(true);
  const [onlyInside, setOnlyInside] = useState(false);

  // Map instance via ref
  const mapRef = useRef(null);

  // Viewport bounds (for virtualization)
  const [viewport, setViewport] = useState(null);

  // Derived pieces
  const {
    dataList = [],
    avgRsrp,
    avgRsrq,
    avgSinr,
    colorSetting = [],
    coveragePerfGraph,
  } = predictionData || {};

  const getColor = useMemo(() => compileColorScale(colorSetting), [colorSetting]);

  // Fetch Prediction Data
  const fetchPredictionData = useCallback(async () => {
    if (!projectId) {
      toast.info('Please enter a Project ID.');
      return;
    }
    setLoading(true);
    setPredictionData(null);
    try {
      const params = {
        projectId,
        metric: metric.toUpperCase(),
      };
      const response = await mapViewApi.getPredictionLog(params);
      if (response?.Status === 1 && response?.Data) {
        setPredictionData(response.Data);
        toast.success(`Loaded ${response.Data?.dataList?.length || 0} prediction points.`);
      } else {
        toast.error(response?.Message || 'Failed to fetch prediction data.');
      }
    } catch (error) {
      toast.error(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [projectId, metric]);

  // Fetch Polygons and parse WKT (supports array or { Status, Data })
  const fetchPolygons = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await mapViewApi.getProjectPolygons(projectId);
      const items = Array.isArray(res)
        ? res
        : (res?.Status === 1 && Array.isArray(res?.Data) ? res.Data : []);

      if (items.length > 0) {
        const parsed = [];
        items.forEach((item, idx) => {
          const polys = parseWKTToPolygons(item.wkt); // [{paths: [...rings]}...]
          polys.forEach((p, k) => {
            const outer = p.paths?.[0] || [];
            const bbox = computeRingBbox(outer);
            parsed.push({
              ...item,
              uid: `${item.id ?? idx}-${k}`, // unique key for multipolygons
              paths: p.paths,
              bbox,
            });
          });
        });
        setPolygons(parsed);
        console.debug(`[Polygons] Loaded ${parsed.length} for project ${projectId}`);
      } else {
        setPolygons([]);
        const msg = res?.Message || 'No polygons found or API returned empty data.';
        console.warn(`[Polygons] ${msg} for project ${projectId}`);
        toast.warn(msg);
      }
    } catch (error) {
      console.error(`[Polygons] Failed to fetch for project ${projectId}:`, error);
      setPolygons([]);
      toast.error(`Failed to fetch polygons: ${error.message}`);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    fetchPredictionData();
    fetchPolygons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle map load and viewport tracking
  const handleMapLoad = useCallback((m) => {
    mapRef.current = m;
    if (!window?.google) return;

    const updateViewport = () => {
      const b = m.getBounds();
      if (!b) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      setViewport({
        north: ne.lat(),
        east: ne.lng(),
        south: sw.lat(),
        west: sw.lng(),
        zoom: m.getZoom(),
      });
    };

    const idleListener = window.google.maps.event.addListener(m, 'idle', updateViewport);
    updateViewport();

    return () => {
      if (idleListener) window.google.maps.event.removeListener(idleListener);
    };
  }, []);

  // Fit bounds when new data arrives
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !window.google) return;
    const hasPoints = Array.isArray(dataList) && dataList.length > 0;
    const hasPolys = Array.isArray(polygons) && polygons.length > 0;
    if (!hasPoints && !hasPolys) return;

    const bounds = new window.google.maps.LatLngBounds();

    dataList.forEach(point => {
      if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
        bounds.extend({ lat: point.lat, lng: point.lon });
      }
    });

    polygons.forEach(poly => {
      const outer = poly.paths?.[0] || [];
      outer.forEach(pt => {
        if (Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) {
          bounds.extend(pt);
        }
      });
    });

    if (!bounds.isEmpty()) {
      m.fitBounds(bounds);
      const listener = window.google.maps.event.addListenerOnce(m, 'idle', () => {
        if (m.getZoom() > 17) m.setZoom(17);
      });
      return () => window.google.maps.event.removeListener(listener);
    }
  }, [dataList, polygons]);

  // Viewport-based filtering
  const visiblePolygons = useMemo(() => {
    if (!viewport || !polygons?.length) return [];
    const arr = polygons.filter(poly => bboxIntersects(poly.bbox, viewport));
    return arr.slice(0, MAX_RENDER_POLYGONS);
  }, [viewport, polygons]);

  // Point-in-polygon filter (optional toggle)
  const isPointInsideAnyVisiblePoly = useCallback((pt, polys) => {
    // bbox pre-filter then ring check
    for (const poly of polys) {
      const b = poly.bbox;
      if (!b) continue;
      if (pt.lat < b.south || pt.lat > b.north || pt.lon < b.west || pt.lon > b.east) continue;
      if (pointInPolygonWithHoles({ lat: pt.lat, lng: pt.lon }, poly.paths)) return true;
    }
    return false;
  }, []);

  const visiblePoints = useMemo(() => {
    if (!viewport || !dataList?.length) return [];
    let arr = dataList.filter(p =>
      Number.isFinite(p.lat) &&
      Number.isFinite(p.lon) &&
      p.lat >= viewport.south && p.lat <= viewport.north &&
      p.lon >= viewport.west && p.lon <= viewport.east
    );

    if (onlyInside && visiblePolygons.length) {
      arr = arr.filter(pt => isPointInsideAnyVisiblePoly(pt, visiblePolygons));
    }

    return arr.slice(0, MAX_RENDER_POINTS);
  }, [viewport, dataList, onlyInside, visiblePolygons, isPointInsideAnyVisiblePoly]);

  // Chart data
  const chartData = useMemo(() => {
    const series = coveragePerfGraph?.series?.[0]?.data || [];
    const cats = coveragePerfGraph?.Category || [];
    return series.map((item, idx) => ({
      name: cats[idx] || `Range ${idx + 1}`,
      value: item?.y,
      color: item?.color,
    }));
  }, [coveragePerfGraph]);

  if (loadError) return <div>Error loading map.</div>;

  return (
    <div className="h-screen flex flex-col p-4 gap-4 bg-gray-50">
      {/* Header & Filters */}
      <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-md border">
        <h1 className="text-xl font-bold mb-4">Prediction Data Viewer</h1>
        <div className="flex flex-wrap items-end gap-3">
          {/* Project ID */}
          <div>
            <label className="text-sm font-medium">Project ID</label>
            <input
              type="number"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : '')}
              className="w-full border rounded px-2 py-1"
              placeholder="Enter Project ID"
            />
          </div>

          {/* Metric */}
          <div>
            <label className="text-sm font-medium">Metric</label>
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              <option value="RSRP">RSRP</option>
              <option value="RSRQ">RSRQ</option>
              <option value="SINR">SINR</option>
            </select>
          </div>

          {/* Buttons */}
          <button
            onClick={() => { fetchPredictionData(); fetchPolygons(); }}
            disabled={loading || !projectId}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Loading...' : 'Reload Data'}
          </button>

          <button
            onClick={() => setShowPolys(v => !v)}
            className={`px-3 py-2 rounded border ${showPolys ? 'bg-green-600 text-white border-green-700' : 'bg-white text-gray-700 border-gray-300'}`}
            title="Toggle polygon visibility"
          >
            {showPolys ? 'Hide Polygons' : 'Show Polygons'}
          </button>

          <button
            onClick={() => setOnlyInside(v => !v)}
            className={`px-3 py-2 rounded border ${onlyInside ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-gray-700 border-gray-300'}`}
            title="Show only points inside polygons"
          >
            {onlyInside ? 'Show All Points' : 'Points Inside Polygons'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 rounded-lg border shadow-md overflow-hidden relative">
          {!isLoaded ? <Spinner /> : (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={DEFAULT_CENTER}
              zoom={12}
              onLoad={handleMapLoad}
              options={{ disableDefaultUI: true, zoomControl: true }}
            >
              {/* Polygons as fill + bold outline */}
              {showPolys && (
                <PolygonsLayer
                  polygons={visiblePolygons}
                  strokeColor="#FF3D00"
                  strokeWeight={4}
                  showFill={true}
                  showStroke={true}
                />
              )}

              {/* Points */}
              <CirclesLayer points={visiblePoints} getColor={getColor} radius={15} zIndex={2} />
            </GoogleMap>
          )}

          {/* Loading overlay */}
          {loading && !predictionData && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
              <Spinner />
            </div>
          )}

          {/* Overlay counts */}
          <div className="absolute bottom-2 left-2 bg-white/90 rounded px-2 py-1 text-xs shadow">
            <div>Total points: {dataList.length} | Shown: {visiblePoints.length}</div>
            <div>Total polygons: {polygons.length} | Shown: {visiblePolygons.length}</div>
          </div>
        </div>

        {/* Stats & Chart */}
        <div className="space-y-4">
          {/* Averages */}
          <div className="p-4 bg-white rounded-lg shadow-md border">
            <h2 className="font-semibold mb-2">Averages</h2>
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <div>
                <div className="text-gray-500">RSRP</div>
                <div className="font-bold text-lg">{avgRsrp != null ? Number(avgRsrp).toFixed(2) : 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">RSRQ</div>
                <div className="font-bold text-lg">{avgRsrq != null ? Number(avgRsrq).toFixed(2) : 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">SINR</div>
                <div className="font-bold text-lg">{avgSinr != null ? Number(avgSinr).toFixed(2) : 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="p-4 bg-white rounded-lg shadow-md border h-80">
            <h2 className="font-semibold mb-2">Performance Distribution ({metric})</h2>
            <PerformanceChart data={chartData} metric={metric} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictionMapPage;