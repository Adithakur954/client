// src/components/MapWithMultipleSquare.jsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import { GoogleMap, PolygonF } from "@react-google-maps/api";
import { getColorForMetric } from "../utils/metrics";

const DEFAULT_CENTER = { lat: 28.64453086, lng: 77.37324242 };

function getThresholdColor(thresholdArray, value, fallback = "#3b82f6") {
  if (value === null || value === undefined || isNaN(Number(value))) {
    return "#9ca3af";
  }
  if (!Array.isArray(thresholdArray) || thresholdArray.length === 0) {
    return fallback;
  }

  const v = Number(value);
  for (const t of thresholdArray) {
    const min =
      t.min ??
      t.from ??
      t.gte ??
      (typeof t.lower === "number" ? t.lower : -Infinity);
    const max =
      t.max ??
      t.to ??
      t.lte ??
      (typeof t.upper === "number" ? t.upper : Infinity);
    const color = t.color ?? t.colour ?? t.hex ?? fallback;

    if (v >= min && v < max) return color;
  }
  return fallback;
}

const containerStyle = { width: "100%", height: "100%" };

const MapWithMultipleSquares = ({
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
  children,
}) => {
  const mapRef = useRef(null);
  const [opacity, setOpacity] = useState(1);
  const [showOpacityControl, setShowOpacityControl] = useState(false);

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
      if (
        fitToLocations &&
        locations &&
        locations.length > 0 &&
        window.google
      ) {
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
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={containerStyle}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={options}
        center={computedCenter}
        zoom={defaultZoom}
      >
        {Array.isArray(locations) &&
          locations.map((loc, idx) => {
            const value = loc?.[selectedMetric];
            const color = getColorForMetric(selectedMetric, value, thresholds);
            const isActive = idx === activeMarkerIndex;
            const halfSide = 0.00011;

            const squareCoords = [
              { lat: loc.lat + halfSide, lng: loc.lng - halfSide },
              { lat: loc.lat + halfSide, lng: loc.lng + halfSide },
              { lat: loc.lat - halfSide, lng: loc.lng + halfSide },
              { lat: loc.lat - halfSide, lng: loc.lng - halfSide },
            ];

            return (
              <PolygonF
                key={idx}
                paths={squareCoords}
                onClick={() => onMarkerClick?.(idx)}
                options={{
                  fillColor: color,
                  fillOpacity: opacity,
                  strokeColor: color,
                  strokeOpacity: opacity,
                  strokeWeight: isActive ? 2 : 1,
                  zIndex: isActive ? 2 : 1,
                }}
              />
            );
          })}

        {children}
      </GoogleMap>

      {/* Opacity Control */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg">
        <button
          onClick={() => setShowOpacityControl(!showOpacityControl)}
          className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2"
          title="Adjust polygon opacity"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          Opacity
        </button>

        {showOpacityControl && (
          <div className="px-4 py-3 border-t border-gray-200 bg-white rounded-b-lg">
            {/* Header: Title + Close Button */}
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-700">
                Opacity Settings
              </span>

              <button
                onClick={() => setShowOpacityControl(false)}
                className="text-gray-500 hover:text-gray-700 transition"
                title="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Slider */}
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={opacity * 100}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <span className="text-sm font-medium text-gray-700 min-w-[3rem]">
                {Math.round(opacity * 100)}%
              </span>
            </div>

            {/* Preset buttons */}
            <div className="flex gap-1 mt-2">
              {[0.25, 0.5, 0.75, 1].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setOpacity(preset)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    opacity === preset
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset * 100}%
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapWithMultipleSquares;
