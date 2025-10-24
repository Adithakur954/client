// src/components/MapwithMultipleCircle.jsx
import React, { useCallback, useMemo, useRef } from "react";
import { GoogleMap, CircleF } from "@react-google-maps/api";

// Fallback if not provided by parent
const DEFAULT_CENTER = { lat: 28.64453086, lng: 77.37324242 };

function getThresholdColor(thresholdArray, value, fallback = "#3b82f6") {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return "#9ca3af"; // neutral grey for missing values
  }
  if (!Array.isArray(thresholdArray) || thresholdArray.length === 0) {
    return fallback;
  }

  const v = Number(value);
  for (const t of thresholdArray) {
    // Try common field names
    const min =
      t.min ?? t.from ?? t.gte ?? (typeof t.lower === "number" ? t.lower : -Infinity);
    const max =
      t.max ?? t.to ?? t.lte ?? (typeof t.upper === "number" ? t.upper : Infinity);
    const color = t.color ?? t.colour ?? t.hex ?? fallback;

    // Inclusive lower, exclusive upper by default
    if (v >= min && v < max) return color;
  }
  return fallback;
}

const containerStyle = { width: "100%", height: "100%" };

const MapWithMultipleCircles = ({
  isLoaded,
  loadError,
  locations = [],
  thresholds = {},
  selectedMetric = "rsrp",
  activeMarkerIndex,
  onMarkerClick,
  options,
  center = DEFAULT_CENTER,
  defaultZoom = 14,
  fitToLocations = true,
  children, // overlays like <NetworkPlannerMap />
}) => {
  const mapRef = useRef(null);

  const computedCenter = useMemo(() => {
    if (!locations || locations.length === 0) return center;
    const { lat, lng } = locations.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return { lat: lat / locations.length, lng: lng / locations.length };
  }, [locations, center]);

  const onLoad = useCallback(
    (map) => {
      mapRef.current = map;
      if (fitToLocations && locations && locations.length > 0 && window.google) {
        const bounds = new window.google.maps.LatLngBounds();
        locations.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        map.fitBounds(bounds, 50);
      } else {
        map.setCenter(computedCenter);
        map.setZoom(defaultZoom);
      }
    },
    [locations, fitToLocations, computedCenter, defaultZoom]
  );

  const onUnmount = useCallback(() => {
    mapRef.current = null;
  }, []);

  if (loadError) {
    return (
      <div className="flex items-center justify-center w-full h-full text-red-500">
        Failed to load Google Maps
      </div>
    );
  }

  if (!isLoaded) return null;

  const metricThresholds = thresholds?.[selectedMetric] ?? [];

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      onLoad={onLoad}
      onUnmount={onUnmount}
      options={options}
      center={computedCenter} // initial center (will be updated in onLoad)
      zoom={defaultZoom}
    >
      {Array.isArray(locations) &&
        locations.map((loc, idx) => {
          const value = loc?.[selectedMetric];
          const color = getThresholdColor(metricThresholds, value);
          const isActive = idx === activeMarkerIndex;
          const radius = Number(loc.radius) || 18;

          return (
            <CircleF
              key={idx}
              center={{ lat: loc.lat, lng: loc.lng }}
              radius={radius}
              onClick={() => onMarkerClick?.(idx)}
              options={{
                fillColor: color,
                fillOpacity: 0.6,
                strokeColor: color,
                strokeOpacity: 0.9,
                strokeWeight: isActive ? 2 : 1,
                zIndex: isActive ? 2 : 1,
              }}
            />
          );
        })}

      {/* Inject additional overlays (e.g., sector polygons) */}
      {children}
    </GoogleMap>
  );
};

export default MapWithMultipleCircles;