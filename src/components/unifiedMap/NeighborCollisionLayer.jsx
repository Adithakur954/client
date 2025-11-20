// src/components/unifiedMap/NeighborHeatmapLayer.jsx
import React, { useMemo, useState, useCallback } from 'react';
import { HeatmapLayer, InfoWindow } from '@react-google-maps/api';

// Helper function to validate coordinates
const isValidCoordinate = (lat, lng) => {
  return (
    lat != null &&
    lng != null &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
};

const NeighborHeatmapLayer = ({
  allNeighbors = [],
  showNeighbors = true,
  selectedMetric = 'rsrp',
  intensity = 1,
  radius = 30,
  opacity = 0.6,
}) => {
  // Process and validate neighbor data
  const heatmapData = useMemo(() => {
    if (!showNeighbors || !window.google) return [];

    const validNeighbors = allNeighbors.filter(n => {
      const lat = parseFloat(n.lat);
      const lng = parseFloat(n.lng || n.lon);

      if (!isValidCoordinate(lat, lng)) {
        return false;
      }
      
      n.validLat = lat;
      n.validLng = lng;
      return true;
    });

    // Convert to Google Maps LatLng with weighted points based on metric
    return validNeighbors.map(neighbor => {
      const location = new window.google.maps.LatLng(
        neighbor.validLat,
        neighbor.validLng
      );

      // Calculate weight based on metric value
      const metricValue = parseFloat(neighbor[selectedMetric]);
      let weight = 1;

      if (!isNaN(metricValue)) {
        // Normalize metric values to 0-1 range for heatmap weight
        switch (selectedMetric) {
          case 'rsrp':
            // RSRP: -140 to -40 dBm (higher is better)
            weight = Math.max(0, Math.min(1, (metricValue + 140) / 100));
            break;
          case 'rsrq':
            // RSRQ: -20 to 0 dB (higher is better)
            weight = Math.max(0, Math.min(1, (metricValue + 20) / 20));
            break;
          case 'sinr':
            // SINR: -10 to 30 dB (higher is better)
            weight = Math.max(0, Math.min(1, (metricValue + 10) / 40));
            break;
          default:
            weight = 1;
        }
      }

      return {
        location,
        weight: weight * intensity,
      };
    });
  }, [allNeighbors, showNeighbors, selectedMetric, intensity]);

  // Heatmap gradient (green -> yellow -> red)
  const gradient = useMemo(() => [
    'rgba(0, 255, 255, 0)',     // Transparent cyan
    'rgba(0, 255, 255, 1)',     // Cyan
    'rgba(0, 191, 255, 1)',     // Deep sky blue
    'rgba(0, 127, 255, 1)',     // Blue
    'rgba(0, 63, 255, 1)',      // Dark blue
    'rgba(0, 0, 255, 1)',       // Blue
    'rgba(0, 0, 223, 1)',       // Medium blue
    'rgba(42, 42, 255, 1)',     // Light blue
    'rgba(85, 85, 255, 1)',     // Lighter blue
    'rgba(127, 127, 255, 1)',   // Very light blue
    'rgba(170, 170, 255, 1)',   // Pale blue
    'rgba(255, 0, 0, 1)',       // Red
    'rgba(255, 42, 0, 1)',      // Red-orange
    'rgba(255, 85, 0, 1)',      // Orange
    'rgba(255, 127, 0, 1)',     // Light orange
    'rgba(255, 170, 0, 1)',     // Yellow-orange
    'rgba(255, 212, 0, 1)',     // Yellow
    'rgba(255, 255, 0, 1)',     // Bright yellow
  ], []);

  if (!showNeighbors || heatmapData.length === 0) {
    return null;
  }

  return (
    <HeatmapLayer
      data={heatmapData}
      options={{
        radius,
        opacity,
        gradient,
        maxIntensity: 100,
        dissipating: true,
      }}
    />
  );
};

export default React.memo(NeighborHeatmapLayer);