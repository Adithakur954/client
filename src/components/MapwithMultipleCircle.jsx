// src/components/MapwithMultipleCircle.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, CircleF, InfoWindowF } from '@react-google-maps/api';
import { metersPerPixel } from '../utils/maps';

const mapContainerStyle = { height: '100%', width: '100%' };

// --- Helper functions (color logic, etc.) remain unchanged ---
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
        case 'lte-bler': return 'lte_bler';
        default: return metric;
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
        const min = parseNumber(seg.min ?? Number.NEGATIVE_INFINITY);
        const max = parseNumber(seg.max ?? Number.POSITIVE_INFINITY);
        if (v >= min && v <= max) return seg.color || fallbackColor(metric, value);
    }
    return fallbackColor(metric, value);
};
// --- End of helper functions ---


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
    const [zoom, setZoom] = useState(12);

    const onMapLoad = useCallback((m) => setMap(m), []);

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
                setZoom(map.getZoom() || 12);
            });
            return () => window.google.maps.event.removeListener(listener);
        }
    }, [map, locations]);

    // **FIX**: Moved the dynamic radius calculation hook to be unconditional.
    const circleRadius = useMemo(() => {
        if (!map) return 20;
        const center = map.getCenter();
        if (!center) return 20;
        return metersPerPixel(zoom, center.lat()) * 4;
    }, [map, zoom]);

    // **FIX**: Moved conditional returns *after* all hooks have been called.
    if (loadError) return <div>Error loading maps</div>;
    if (!isLoaded) return <div className="flex h-full w-full items-center justify-center">Loading Map...</div>;

    const formatInfoTime = (dateString) => dateString ? new Date(dateString).toLocaleString() : 'N/A';

    return (
        <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={initialCenter}
            zoom={12}
            onLoad={onMapLoad}
            onIdle={onIdle}
            onClick={() => onMarkerClick?.(null)}
            options={{ disableDefaultUI: true, zoomControl: true }}
        >
            {locations.map((loc, index) => {
                const rawVal = pickMetricValue(loc, selectedMetric);
                const computedFill = colorFromThresholds(rawVal, selectedMetric, thresholds);
                const fill = loc.color || computedFill;

                return (
                    <React.Fragment key={`marker-wrapper-${index}`}>
                        <CircleF
                            center={{ lat: loc.lat, lng: loc.lng }}
                            onClick={() => onMarkerClick?.(index)}
                            options={{
                                strokeWeight: 0,
                                fillColor: fill,
                                fillOpacity: 0.7,
                                radius: circleRadius,
                            }}
                        />
                        {activeMarkerIndex === index && (
                            <InfoWindowF
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
                            </InfoWindowF>
                        )}
                    </React.Fragment>
                );
            })}
        </GoogleMap>
    );
};

export default MapWithMultipleCircles;