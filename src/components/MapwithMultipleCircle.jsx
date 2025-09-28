// src/components/MapwithMultipleCircle.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, Circle, InfoWindow } from '@react-google-maps/api';

const mapContainerStyle = { height: '100%', width: '100%' };

// Helpers
const parseNumber = (x) => {
  if (x == null) return NaN;
  const s = String(x).replace(/[^\d.+-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
};

const thresholdsKeyFor = (metric) => {
  switch (metric) {
    case 'dl-throughput': return 'dl_thpt';
    case 'ul-throughput': return 'ul_thpt';
    case 'lte-bler':      return 'lte_bler';
    default:              return metric; // rsrp, rsrq, sinr, mos
  }
};

const fallbackColor = (metric, v) => {
  const n = parseNumber(v);
  if (!Number.isFinite(n)) return '#9ca3af';
  switch (metric) {
    case 'rsrp':
      if (n < -115) return '#ef4444';
      if (n <= -105) return '#f59e0b';
      if (n <= -95)  return '#fde047';
      if (n <= -90)  return '#1d4ed8';
      if (n <= -85)  return '#60a5fa';
      if (n <= -75)  return '#86efac';
      return '#065f46';
    case 'rsrq':
      if (n < -16) return '#ef4444';
      if (n < -12) return '#f59e0b';
      if (n < -9)  return '#fde047';
      if (n < -6)  return '#60a5fa';
      if (n < -3)  return '#93c5fd';
      return '#065f46';
    case 'sinr':
      if (n < 0)  return '#ef4444';
      if (n < 5)  return '#f59e0b';
      if (n < 10) return '#fde047';
      if (n < 15) return '#60a5fa';
      if (n < 20) return '#93c5fd';
      return '#065f46';
    case 'dl-throughput':
    case 'ul-throughput':
      if (n < 1)  return '#ef4444';
      if (n < 5)  return '#f59e0b';
      if (n < 15) return '#fde047';
      if (n < 30) return '#60a5fa';
      if (n < 60) return '#93c5fd';
      return '#065f46';
    case 'mos':
      if (n < 2)   return '#ef4444';
      if (n < 3)   return '#f59e0b';
      if (n < 3.5) return '#fde047';
      if (n < 4)   return '#60a5fa';
      return '#065f46';
    case 'lte-bler':
      if (n > 10) return '#ef4444';
      if (n > 5)  return '#f59e0b';
      if (n > 2)  return '#fde047';
      if (n > 1)  return '#60a5fa';
      return '#065f46';
    default:
      return '#9ca3af';
  }
};

const pickMetricValue = (row, metric) => {
  const tryKeys = (keys) => {
    for (const k of keys) {
      const v = row?.[k];
      if (v != null && v !== '') return v;
    }
    return null;
  };
  switch (metric) {
    case 'rsrp': return tryKeys(['rsrp', 'RSRP', 'rsrp_dbm', 'm_rsrp', 'signal_rsrp']);
    case 'rsrq': return tryKeys(['rsrq', 'RSRQ']);
    case 'sinr': return tryKeys(['sinr', 'SINR']);
    case 'dl-throughput': return tryKeys(['dl_thpt', 'dl_tpt', 'DL', 'dl', 'download', 'download_throughput']);
    case 'ul-throughput': return tryKeys(['ul_thpt', 'ul_tpt', 'UL', 'ul', 'upload', 'upload_throughput']);
    case 'mos': return tryKeys(['mos', 'MOS']);
    case 'lte-bler': return tryKeys(['lte_bler', 'LTE_BLER', 'bler']);
    default: return null;
  }
};

const colorFromThresholds = (value, metric, thresholds) => {
  const v = parseNumber(value);
  const list = thresholds?.[thresholdsKeyFor(metric)] || [];
  if (!Number.isFinite(v) || !Array.isArray(list) || list.length === 0) {
    return fallbackColor(metric, value);
  }
  for (const seg of list) {
    const min = parseNumber(seg.min ?? seg.from ?? seg.gte ?? Number.NEGATIVE_INFINITY);
    const max = parseNumber(seg.max ?? seg.to ?? seg.lte ?? Number.POSITIVE_INFINITY);
    const minOk = Number.isFinite(min) ? min : Number.NEGATIVE_INFINITY;
    const maxOk = Number.isFinite(max) ? max : Number.POSITIVE_INFINITY;
    if (v >= minOk && v <= maxOk) return seg.color || fallbackColor(metric, value);
  }
  return fallbackColor(metric, value);
};

const MapWithMultipleCircles = ({
  isLoaded,
  loadError,
  locations,
  thresholds,
  selectedMetric = 'rsrp',
  onMarkerClick,
  activeMarkerIndex,
}) => {
  const [map, setMap] = useState(null);
  const onMapLoad = useCallback((m) => setMap(m), []);

  const initialCenter = useMemo(() => {
    const p = locations.find(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng));
    return p ? { lat: p.lat, lng: p.lng } : { lat: 28.6139, lng: 77.2090 };
  }, [locations]);

  useEffect(() => {
    if (!map || !locations?.length || !window?.google) return;
    const bounds = new window.google.maps.LatLngBounds();
    locations.forEach((loc) => {
      if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
        bounds.extend({ lat: loc.lat, lng: loc.lng });
      }
    });
    if (!bounds.isEmpty()) {
      map.fitBounds(bounds);
      const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 17) map.setZoom(17);
      });
      return () => window.google.maps.event.removeListener(listener);
    }
  }, [map, locations]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div className="flex h-full w-full items-center justify-center">Loading Map...</div>;

  const formatInfoTime = (dateString) => dateString ? new Date(dateString).toLocaleString() : 'N/A';

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={initialCenter}
      zoom={12}
      onLoad={onMapLoad}
      onClick={() => onMarkerClick?.(null)}
      options={{ disableDefaultUI: true, zoomControl: true }}
    >
      {locations.map((loc, index) => {
        const rawVal = pickMetricValue(loc, selectedMetric);
        const computedFill = colorFromThresholds(rawVal, selectedMetric, thresholds);
        const fill = loc.color || computedFill; // Prefer explicit color override if provided

        return (
          <React.Fragment key={`marker-wrapper-${index}`}>
            <Circle
              center={{ lat: loc.lat, lng: loc.lng }}
              onClick={() => onMarkerClick?.(index)}
              options={{
                strokeWeight: 0,
                fillColor: fill,
                fillOpacity: 0.7,
                radius: loc.radius || 30,
              }}
            />
            {activeMarkerIndex === index && (
              <InfoWindow
                position={{ lat: loc.lat, lng: loc.lng }}
                onCloseClick={() => onMarkerClick?.(null)}
              >
                <div style={{ padding: '5px', minWidth: 180 }}>
                  <h4 style={{ fontWeight: 'bold', marginBottom: '5px' }}>Point Info</h4>
                  <p><strong>Time:</strong> {formatInfoTime(loc.timestamp)}</p>
                  <p><strong>RSRP:</strong> {loc.rsrp ?? 'N/A'}</p>
                  <p><strong>RSRQ:</strong> {loc.rsrq ?? 'N/A'}</p>
                  <p><strong>SINR:</strong> {loc.sinr ?? 'N/A'}</p>
                </div>
              </InfoWindow>
            )}
          </React.Fragment>
        );
      })}
    </GoogleMap>
  );
};

export default MapWithMultipleCircles;