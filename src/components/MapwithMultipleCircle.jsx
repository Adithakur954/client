// src/components/MapwithMultipleCircle.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, CircleF, InfoWindowF, PolygonF } from '@react-google-maps/api';
import { metersPerPixel } from '../utils/maps'; // Assuming you have this util

const mapContainerStyle = { height: '100%', width: '100%' };

// --- Helper functions --- (Keep existing helpers: parseNumber, thresholdsKeyFor, fallbackColor, pickMetricValue, colorFromThresholds, labelForMetric, toLatLng, coercePaths)

const parseNumber = (x) => {
  if (x == null) return NaN;
  const s = String(x).replace(/[^\d.+-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

const thresholdsKeyFor = (metric) => {
  switch (metric) {
    case 'dl-throughput':
    case 'dl_thpt':
      return 'dl_thpt';
    case 'ul-throughput':
    case 'ul_thpt':
      return 'ul_thpt';
    case 'lte-bler':
    case 'lte_bler':
      return 'lte_bler';
    default:
      return metric;
  }
};

const fallbackColor = (metric, v) => {
  const n = parseNumber(v);
  if (!Number.isFinite(n)) return '#9ca3af';
  switch (metric) {
    case 'rsrp':
      if (n < -115) return '#ef4444';
      if (n <= -105) return '#f59e0b';
      if (n <= -95) return '#fde047';
      if (n <= -90) return '#1d4ed8';
      if (n <= -85) return '#60a5fa';
      if (n <= -75) return '#86efac';
      return '#065f46';
    case 'rsrq':
      if (n < -16) return '#ef4444';
      if (n < -12) return '#f59e0b';
      if (n < -9) return '#fde047';
      if (n < -6) return '#60a5fa';
      if (n < -3) return '#93c5fd';
      return '#065f46';
    case 'sinr':
      if (n < 0) return '#ef4444';
      if (n < 5) return '#f59e0b';
      if (n < 10) return '#fde047';
      if (n < 15) return '#60a5fa';
      if (n < 20) return '#93c5fd';
      return '#065f46';
    default:
      return '#9ca3af';
  }
};

const pickMetricValue = (row, metric) => {
  // Prefer normalized property if present
  if (row && metric in row && row[metric] != null && row[metric] !== '') {
    return row[metric];
  }
  const tryKeys = (keys) => {
    for (const k of keys) {
      const v = row?.[k];
      if (v != null && v !== '') return v;
    }
    return null;
  };
  switch (metric) {
    case 'rsrp': return tryKeys(['rsrp', 'RSRP', 'rsrp_dbm']);
    case 'rsrq': return tryKeys(['rsrq', 'RSRQ']);
    case 'sinr': return tryKeys(['sinr', 'SINR']);
    case 'dl_thpt': return tryKeys(['dl_thpt', 'dl_tpt', 'DL', 'download', 'download_throughput']);
    case 'ul_thpt': return tryKeys(['ul_thpt', 'ul_tpt', 'UL', 'upload', 'upload_throughput']);
    case 'lte_bler': return tryKeys(['lte_bler', 'LTE_BLER', 'bler']);
    default: return row?.[metric] ?? null;
  }
};

const colorFromThresholds = (value, metric, thresholds) => {
  const v = parseNumber(value);
  const list = thresholds?.[thresholdsKeyFor(metric)] || [];
  if (!Number.isFinite(v) || !Array.isArray(list) || list.length === 0) {
    return fallbackColor(metric, value);
  }
  for (const seg of list) {
    const min = parseNumber(seg.min ?? Number.NEGATIVE_INFINITY);
    const max = parseNumber(seg.max ?? Number.POSITIVE_INFINITY);
    if (v >= min && v <= max) return seg.color || fallbackColor(metric, value);
  }
  return fallbackColor(metric, value);
};

const labelForMetric = (metric) => {
  switch (metric) {
    case 'dl_thpt': return 'DL Throughput';
    case 'ul_thpt': return 'UL Throughput';
    case 'lte_bler': return 'LTE BLER';
    default: return metric?.toUpperCase?.() || String(metric);
  }
};

const toLatLng = (pt) => {
    if (!pt) return null;
    if (typeof pt === 'object' && !Array.isArray(pt)) {
        const lat = pt.lat ?? pt.latitude ?? pt.y ?? pt.Y;
        const lng = pt.lng ?? pt.lon ?? pt.longitude ?? pt.x ?? pt.X;
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const needsSwap = Math.abs(lat) > 90 && Math.abs(lng) <= 180 && Math.abs(lng) <= 90;
            return needsSwap ? { lat: lng, lng: lat } : { lat, lng };
        }
        return null;
    }
    if (Array.isArray(pt) && pt.length >= 2) {
        const a = Number(pt[0]);
        const b = Number(pt[1]);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
        const looksLikeLngLat = Math.abs(a) <= 180 && Math.abs(b) <= 90;
        const looksLikeLatLng = Math.abs(a) <= 90 && Math.abs(b) <= 180;
        if (looksLikeLngLat && !looksLikeLatLng) return { lat: b, lng: a };
        if (looksLikeLatLng && !looksLikeLngLat) return { lat: a, lng: b };
        return { lat: b, lng: a };
    }
    return null;
};

const coercePaths = (coords) => {
  const addRing = (ring) => {
    const arr = [];
    for (const pt of ring) {
      const ll = toLatLng(pt);
      if (ll && Number.isFinite(ll.lat) && Number.isFinite(ll.lng)) {
        arr.push(ll);
      }
    }
    return arr.length ? arr : null;
  };

  if (!coords) return [];
  // Assumes structure like [[[lng, lat],...], [[lng, lat],...]] or just [[lng, lat],...]
  // Needs adjustment if WKT parsing outputs different structure
  if (Array.isArray(coords) && coords.length > 0) {
      // Check if it's already in Google Maps format {lat, lng}
      if(typeof coords[0][0] === 'object' && coords[0][0].hasOwnProperty('lat')) {
          return [coords]; // Already in correct format, wrap in outer array
      }
      // Check if it's a single ring [[lng, lat], ...]
      if(Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
          const ring = addRing(coords);
          return ring ? [[ring]] : []; // Wrap in two arrays
      }
      // Check if it's multiple rings [[[lng, lat], ...], ...]
      if(Array.isArray(coords[0]) && Array.isArray(coords[0][0])) {
          const rings = [];
          for (const ring of coords) {
              const r = addRing(ring);
              if (r) rings.push(r);
          }
          return rings.length > 0 ? [rings] : []; // Wrap rings array in one more array
      }
  }
  return [];
};
// --- End helpers ---

const MapWithMultipleCircles = ({
  isLoaded,
  loadError,
  locations,
  thresholds,
  polygons = [],
  selectedMetric = 'rsrp',
  onMarkerClick,
  activeMarkerIndex,
  onLoad, // <-- Accept onLoad prop
}) => {
  const [map, setMap] = useState(null);
  const [zoom, setZoom] = useState(12);

  // --- MODIFIED onMapLoadInternal ---
  const onMapLoadInternal = useCallback((m) => {
    console.debug("[Map] onLoad Internal");
    setMap(m); // Set internal state
    if (onLoad) {
      console.debug("[Map] Calling parent onLoad");
      onLoad(m); // <-- Call the onLoad prop passed from the parent
    }
  }, [onLoad]); // Add onLoad to dependency array

  const onIdle = useCallback(() => {
    if (map) {
      const newZoom = map.getZoom();
      if (newZoom) {
        setZoom(newZoom);
      }
    }
  }, [map]);

  const initialCenter = useMemo(() => {
      const p = locations.find(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
      if (p) return { lat: p.lat, lng: p.lng };

      try {
          // Attempt to center on the first polygon's first point
          const firstPoly = polygons?.[0];
          // Use the coordinates directly if parsed from WKT
          const coords = firstPoly?.coordinates;
          const firstPoint = coords?.[0];
          if (firstPoint && Number.isFinite(firstPoint.lat) && Number.isFinite(firstPoint.lng)) {
              return firstPoint;
          }
          // Fallback if WKT parsing failed or structure is different
          const paths = coercePaths(firstPoly?.paths); // Original attempt
          if (paths?.[0]?.[0]?.[0]) return paths[0][0][0]; // Deeper nesting? Adjust as needed
      } catch {}
      return { lat: 28.6139, lng: 77.2090 }; // Default fallback
  }, [locations, polygons]);


  // Fit bounds effect (Keep existing logic, ensure polyPtCount works with new polygon structure)
   useEffect(() => {
        if (!map || !window?.google) return;

        const bounds = new window.google.maps.LatLngBounds();
        let locCount = 0;
        let polyPtCount = 0;

        // Fit to locations
        if (Array.isArray(locations) && locations.length) {
            locations.forEach((loc) => {
                if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
                    bounds.extend({ lat: loc.lat, lng: loc.lng });
                    locCount++;
                }
            });
        }

        // Fit to polygons (using the parsed coordinates)
        if (Array.isArray(polygons) && polygons.length) {
            polygons.forEach((poly) => {
                // 'coordinates' should be the array of {lat, lng} for the outer ring
                if (Array.isArray(poly.coordinates)) {
                    poly.coordinates.forEach((pt) => {
                         if (Number.isFinite(pt.lat) && Number.isFinite(pt.lng)) {
                             bounds.extend(pt);
                             polyPtCount++;
                         }
                    });
                }
                // Optionally handle holes ('rawRings' structure) if needed for bounds
            });
        }

        if (!bounds.isEmpty()) {
            console.debug("[Map] Fitting bounds", { locCount, polyPtCount });
            map.fitBounds(bounds);
            const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
                if (map.getZoom() > 17) map.setZoom(17);
                setZoom(map.getZoom() || 12);
            });
            return () => window.google.maps.event.removeListener(listener);
        } else {
            console.debug("[Map] Bounds empty");
        }
    }, [map, locations, polygons]); // Use polygons directly

  const circleRadius = useMemo(() => {
    if (!map) return 20;
    const center = map.getCenter();
    if (!center) return 20;
    // Ensure metersPerPixel is imported or defined
    const mpp = typeof metersPerPixel === 'function' ? metersPerPixel(zoom, center.lat()) : 1;
    return mpp * 6; // Adjust multiplier as needed for desired pixel size
  }, [map, zoom]);


  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div className="flex h-full w-full items-center justify-center">Loading Map...</div>;

  const formatInfoTime = (dateString) => dateString ? new Date(dateString).toLocaleString() : 'N/A';

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={initialCenter}
      onLoad={onMapLoadInternal} // Use the internal handler
      onIdle={onIdle}
      onClick={() => onMarkerClick?.(null)}
      options={{ disableDefaultUI: true, zoomControl: true }}
    >
      {/* Debug header */}
      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.9)', padding: '4px 6px', fontSize: 10, borderRadius: 4 }}>
        polys: {polygons?.length || 0} | pts: {locations?.length || 0} | z: {zoom}
      </div>

       {/* Render Polygons */}
        {Array.isArray(polygons) && polygons.map((poly, i) => {
            // 'coordinates' should be the array [{lat, lng}, ...] for the outer ring
            const paths = poly.coordinates;
             // Ensure paths is an array with at least 3 points for PolygonF
            if (!Array.isArray(paths) || paths.length < 3) {
                 console.warn(`[Polygon ${i}] Skipping render - invalid paths (< 3 points)`, poly);
                 return null;
             }
            // If you need to handle holes, you'd extract them from poly.rawRings
            // const holePaths = poly.rawRings?.[0]?.slice(1) || [];

            return (
                <PolygonF
                    key={`poly-${i}-${poly.id || 0}`} // Add poly.id if available
                    // paths should be [outerRing, hole1, hole2, ...]
                    // For now, just rendering the outer ring
                    paths={paths}
                    options={{
                        fillColor: "#1e90ff",
                        fillOpacity: 0.1,
                        strokeColor: "#1e90ff",
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        zIndex: 1,
                    }}
                    onLoad={() => {
                       console.debug(`[Polygon ${i}] Rendered path length=${paths.length}`);
                    }}
                 />
             );
        })}


      {/* Render Locations/Circles */}
      {locations.map((loc, index) => {
        const rawVal = pickMetricValue(loc, selectedMetric);
        // Use loc.color if available (e.g., from prediction or path mode), else calculate
        const computedFill = loc.color || colorFromThresholds(rawVal, selectedMetric, thresholds);

        return (
          <React.Fragment key={`marker-wrapper-${loc.id || index}`}> {/* Use loc.id if available */}
            <CircleF
              center={{ lat: loc.lat, lng: loc.lng }}
              onClick={() => onMarkerClick?.(index)}
              options={{
                strokeWeight: 0,
                fillColor: computedFill,
                fillOpacity: 0.7,
                radius: circleRadius,
                zIndex: 2, // Ensure circles are above polygons
              }}
            />
            {activeMarkerIndex === index && (
              <InfoWindowF
                position={{ lat: loc.lat, lng: loc.lng }}
                onCloseClick={() => onMarkerClick?.(null)}
              >
                <div style={{ padding: '5px', minWidth: 200, fontSize: '12px', lineHeight: '1.4' }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>Point Info</h4>
                  <p><strong>Time:</strong> {formatInfoTime(loc.timestamp)}</p>
                  <p><strong>{labelForMetric(selectedMetric)}:</strong> {rawVal ?? 'N/A'}</p>
                  <hr style={{ margin: '4px 0' }} />
                  {/* Show other metrics if available */}
                  {loc.rsrp != null && <p><strong>RSRP:</strong> {loc.rsrp ?? 'N/A'}</p>}
                  {loc.rsrq != null && <p><strong>RSRQ:</strong> {loc.rsrq ?? 'N/A'}</p>}
                  {loc.sinr != null && <p><strong>SINR:</strong> {loc.sinr ?? 'N/A'}</p>}
                  {/* Add others like dl_thpt, ul_thpt etc. if needed */}
                </div>
              </InfoWindowF>
            )}
          </React.Fragment>
        );
      })}
    </GoogleMap>
  );
};

export default MapWithMultipleCircles;