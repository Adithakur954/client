// src/pages/UnifiedMapView.jsx
import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useJsApiLoader, Polygon } from "@react-google-maps/api";
import { toast } from "react-toastify";

import { mapViewApi, settingApi, areaBreakdownApi } from "../api/apiEndpoints";
import Spinner from "../components/common/Spinner";
import MapWithMultipleCircles from "../components/MapwithMultipleCircle";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";
import UnifiedMapSidebar from "@/components/unifiedMap/UnifiedMapSideBar.jsx";
import SiteMarkers from "@/components/SiteMarkers";
import NetworkPlannerMap from "@/components/unifiedMap/NetworkPlannerMap";
import { useSiteData } from "@/hooks/useSiteData";
import UnifiedHeader from "@/components/unifiedMap/unifiedMapHeader";
import UnifiedDetailLogs from "@/components/unifiedMap/UnifiedDetailLogs";
import MapLegend from "@/components/map/MapLegend";
import { useNeighborCollisions } from "@/hooks/useNeighborCollisions";
import NeighborHeatmapLayer from "@/components/unifiedMap/NeighborHeatmapLayer";

import {
  useBestNetworkCalculation,
  DEFAULT_WEIGHTS,
} from "@/hooks/useBestNetworkCalculation";

const DEFAULT_CENTER = { lat: 28.64453086, lng: 77.37324242 };

const DEFAULT_THRESHOLDS = {
  rsrp: [],
  rsrq: [],
  sinr: [],
  dl_thpt: [],
  ul_thpt: [],
  mos: [],
  lte_bler: [],
};

const DEFAULT_COVERAGE_FILTERS = {
  rsrp: { enabled: false, threshold: -110 },
  rsrq: { enabled: false, threshold: -15 },
  sinr: { enabled: false, threshold: 0 },
};

const DEFAULT_DATA_FILTERS = {
  providers: [],
  bands: [],
  technologies: [],
};

const PROVIDER_COLORS = {
  JIO: "#3B82F6",
  jio: "#3B82F6",
  Jio: "#3B82F6",
  "Jio True5G": "#3B82F6",
  "JIO 4G": "#3B82F6",
  JIO4G: "#3B82F6",
  "IND-JIO": "#3B82F6",
  "IND JIO": "#3B82F6",
  "IND airtel": "#EF4444",
  "IND Airtel": "#EF4444",
  airtel: "#EF4444",
  Airtel: "#EF4444",
  "Airtel 5G": "#EF4444",
  "VI India": "#22C55E",
  "Vi India": "#22C55E",
  VI: "#22C55E",
  "Vodafone IN": "#22C55E",
  BSNL: "#F59E0B",
  bsnl: "#F59E0B",
  Unknown: "#6B7280",
};

const BAND_COLORS = {
  3: "#EF4444",
  5: "#F59E0B",
  8: "#10B981",
  40: "#3B82F6",
  41: "#8B5CF6",
  n28: "#EC4899",
  n78: "#F472B6",
  1: "#EF4444",
  2: "#F59E0B",
  7: "#10B981",
  Unknown: "#6B7280",
};

const TECHNOLOGY_COLORS = {
  "5G": "#EC4899",
  "NR (5G)": "#EC4899",
  "NR (5G SA)": "#EC4899",
  "NR (5G NSA)": "#EC4899",
  "4G": "#8B5CF6",
  "LTE (4G)": "#8B5CF6",
  "3G": "#10B981",
  "2G": "#6B7280",
  "EDGE (2G)": "#6B7280",
  Unknown: "#F59E0B",
};

// ============================================
// METRIC CONFIGURATION & COLOR HELPERS
// ============================================
const METRIC_CONFIG = {
  rsrp: { higherIsBetter: true, unit: "dBm", label: "RSRP", min: -140, max: -44 },
  rsrq: { higherIsBetter: true, unit: "dB", label: "RSRQ", min: -20, max: -3 },
  sinr: { higherIsBetter: true, unit: "dB", label: "SINR", min: -10, max: 30 },
  dl_tpt: { higherIsBetter: true, unit: "Mbps", label: "DL Throughput", min: 0, max: 300 },
  ul_tpt: { higherIsBetter: true, unit: "Mbps", label: "UL Throughput", min: 0, max: 100 },
  mos: { higherIsBetter: true, unit: "", label: "MOS", min: 1, max: 5 },
  lte_bler: { higherIsBetter: false, unit: "%", label: "BLER", min: 0, max: 100 },
};

// Color gradient (normalized 0-1, higher = better after inversion for BLER)
const COLOR_GRADIENT = [
  { min: 0.8, color: "#22C55E" },   // Excellent - Green
  { min: 0.6, color: "#84CC16" },   // Good - Lime  
  { min: 0.4, color: "#EAB308" },   // Fair - Yellow
  { min: 0.2, color: "#F97316" },   // Poor - Orange
  { min: 0.0, color: "#EF4444" },   // Bad - Red
];

const normalizeMetricValue = (value, metric) => {
  const config = METRIC_CONFIG[metric];
  if (!config || value == null || isNaN(value)) return null;

  let normalized = (value - config.min) / (config.max - config.min);
  normalized = Math.max(0, Math.min(1, normalized));

  // Invert for metrics where lower is better
  if (!config.higherIsBetter) {
    normalized = 1 - normalized;
  }

  return normalized;
};

const getColorFromNormalizedValue = (normalizedValue) => {
  if (normalizedValue == null || isNaN(normalizedValue)) return "#999999";

  for (const { min, color } of COLOR_GRADIENT) {
    if (normalizedValue >= min) {
      return color;
    }
  }
  return "#EF4444";
};

const getBandColor = (band) => {
  if (!band) return "#6B7280";
  if (BAND_COLORS[band]) return BAND_COLORS[band];
  
  const bandStr = String(band).trim();
  if (BAND_COLORS[bandStr]) return BAND_COLORS[bandStr];
  if (BAND_COLORS[`n${bandStr}`]) return BAND_COLORS[`n${bandStr}`];
  
  const bandNum = parseInt(bandStr.replace(/[^0-9]/g, ''));
  if (!isNaN(bandNum) && BAND_COLORS[bandNum]) return BAND_COLORS[bandNum];
  
  // Generate consistent color
  const hash = bandStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 50%)`;
};

const getTechnologyColor = (technology) => {
  if (!technology) return "#6B7280";
  if (TECHNOLOGY_COLORS[technology]) return TECHNOLOGY_COLORS[technology];
  
  const techStr = String(technology).trim().toUpperCase();
  
  if (techStr.includes('5G') || techStr.includes('NR')) {
    if (techStr.includes('SA') && !techStr.includes('NSA')) return "#D946EF";
    return "#EC4899";
  }
  if (techStr.includes('LTE') || techStr.includes('4G')) return "#8B5CF6";
  if (techStr.includes('HSPA') || techStr.includes('WCDMA') || techStr.includes('3G') || techStr.includes('UMTS')) return "#22C55E";
  if (techStr.includes('GSM') || techStr.includes('EDGE') || techStr.includes('2G') || techStr.includes('GPRS')) return "#6B7280";
  
  return "#F59E0B";
};

const getColorForMetricValue = (value, metric) => {
  const normalized = normalizeMetricValue(value, metric);
  return getColorFromNormalizedValue(normalized);
};

// Try thresholds first, fall back to normalized
const getColorFromValueOrMetric = (value, thresholds, metric) => {
  if (value == null || isNaN(value)) return "#999999";
  
  // Try thresholds first
  if (thresholds?.length > 0) {
    const threshold = thresholds.find((t) => value >= t.min && value <= t.max);
    if (threshold?.color) {
      return threshold.color;
    }
  }

  // Fall back to metric-based color
  return getColorForMetricValue(value, metric);
};

const getThresholdKey = (metric) => {
  const mapping = {
    dl_tpt: "dl_thpt",
    ul_tpt: "ul_thpt",
    rsrp: "rsrp",
    rsrq: "rsrq",
    sinr: "sinr",
    mos: "mos",
    lte_bler: "lte_bler",
    pci: "pci",
  };
  return mapping[metric?.toLowerCase()] || metric;
};

const getProviderColor = (provider) => {
  if (!provider) return "#6B7280";
  if (PROVIDER_COLORS[provider]) return PROVIDER_COLORS[provider];
  
  const lower = provider.toLowerCase();
  if (lower.includes('jio')) return "#3B82F6";
  if (lower.includes('airtel')) return "#EF4444";
  if (lower.includes('vi') || lower.includes('vodafone')) return "#22C55E";
  if (lower.includes('bsnl')) return "#F59E0B";
  
  return "#6B7280";
};

const getCategoricalColor = (category, type) => {
  const maps = {
    provider: PROVIDER_COLORS,
    band: BAND_COLORS,
    technology: TECHNOLOGY_COLORS,
  };
  return maps[type]?.[category] || "#6C757D";
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
const debounce = (fn, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseWKTToPolygons = (wkt) => {
  if (!wkt?.trim()) return [];
  try {
    const match = wkt.trim().match(/POLYGON\s*\(\(([^)]+)\)\)/i);
    if (!match) return [];

    const points = match[1].split(",").reduce((acc, coord) => {
      const [lng, lat] = coord.trim().split(/\s+/).map(parseFloat);
      if (!isNaN(lat) && !isNaN(lng)) acc.push({ lat, lng });
      return acc;
    }, []);

    return points.length >= 3 ? [{ paths: [points] }] : [];
  } catch {
    return [];
  }
};

const computeBbox = (points) => {
  if (!points?.length) return null;
  return points.reduce(
    (bbox, pt) => ({
      north: Math.max(bbox.north, pt.lat),
      south: Math.min(bbox.south, pt.lat),
      east: Math.max(bbox.east, pt.lng),
      west: Math.min(bbox.west, pt.lng),
    }),
    { north: -90, south: 90, east: -180, west: 180 }
  );
};

const isPointInPolygon = (point, polygon) => {
  const path = polygon?.paths?.[0];
  if (!path?.length) return false;

  const lat = point.lat ?? point.latitude;
  const lng = point.lng ?? point.longitude;
  if (lat == null || lng == null) return false;

  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const { lng: xi, lat: yi } = path[i];
    const { lng: xj, lat: yj } = path[j];
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const calculateMedian = (values) => {
  if (!values?.length) return null;
  const validValues = values.filter(v => v != null && !isNaN(v));
  if (!validValues.length) return null;
  
  const sorted = [...validValues].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const calculateCategoryStats = (points, category, metric) => {
  if (!points?.length) return null;

  const grouped = {};
  points.forEach((pt) => {
    const key = String(pt[category] || "Unknown").trim();
    if (!grouped[key]) grouped[key] = { count: 0, values: [] };
    grouped[key].count++;
    const val = parseFloat(pt[metric]);
    if (!isNaN(val) && val != null) grouped[key].values.push(val);
  });

  const stats = Object.entries(grouped)
    .map(([name, { count, values }]) => {
      const sortedValues = [...values].sort((a, b) => a - b);
      const mid = Math.floor(sortedValues.length / 2);
      const medianValue = sortedValues.length > 0
        ? (sortedValues.length % 2 ? sortedValues[mid] : (sortedValues[mid - 1] + sortedValues[mid]) / 2)
        : null;

      return {
        name,
        count,
        percentage: ((count / points.length) * 100).toFixed(1),
        avgValue: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
        medianValue,
        minValue: values.length ? Math.min(...values) : null,
        maxValue: values.length ? Math.max(...values) : null,
      };
    })
    .sort((a, b) => b.count - a.count); // Sort by count (dominant first)

  return { stats, dominant: stats[0], total: points.length };
};

const parseLogEntry = (log, sessionId) => {
  const latValue = log.lat ?? log.Lat ?? log.latitude ?? log.Latitude ?? log.LAT;
  const lngValue = log.lon ?? log.lng ?? log.Lng ?? log.longitude ?? log.Longitude ?? log.LON ?? log.long ?? log.Long;

  const lat = parseFloat(latValue);
  const lng = parseFloat(lngValue);

  if (isNaN(lat) || isNaN(lng)) return null;
  if (!isFinite(lat) || !isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    lat,
    lng,
    latitude: lat,
    longitude: lng,
    radius: 18,
    timestamp: log.timestamp ?? log.time ?? log.created_at ?? log.Timestamp ?? log.Time,
    rsrp: parseFloat(log.rsrp ?? log.RSRP ?? log.rsrp_dbm ?? log.Rsrp) || null,
    rsrq: parseFloat(log.rsrq ?? log.RSRQ ?? log.Rsrq) || null,
    sinr: parseFloat(log.sinr ?? log.SINR ?? log.Sinr) || null,
    dl_tpt: parseFloat(log.dl_tpt ?? log.dl_thpt ?? log.DL ?? log.dl_throughput ?? log.DlThpt) || null,
    ul_tpt: parseFloat(log.ul_tpt ?? log.ul_thpt ?? log.UL ?? log.ul_throughput ?? log.UlThpt) || null,
    mos: parseFloat(log.mos ?? log.MOS ?? log.Mos) || null,
    lte_bler: parseFloat(log.lte_bler ?? log.LTE_BLER ?? log.LteBler) || null,
    provider: String(log.provider ?? log.Provider ?? log.operator ?? log.Operator ?? "").trim(),
    technology: String(log.network ?? log.technology ?? log.Network ?? log.Technology ?? "").trim(),
    band: String(log.band ?? log.Band ?? "").trim(),
    pci: parseInt(log.pci ?? log.PCI ?? log.Pci) || null,
    session_id: sessionId,
  };
};

const extractLogsFromResponse = (data) => {
  if (Array.isArray(data)) return data;
  if (data?.data && Array.isArray(data.data)) return data.data;
  if (data?.Data && Array.isArray(data.Data)) return data.Data;
  if (data?.logs && Array.isArray(data.logs)) return data.logs;
  if (data?.networkLogs && Array.isArray(data.networkLogs)) return data.networkLogs;
  if (data?.result && Array.isArray(data.result)) return data.result;
  return [];
};

// ============================================
// ZONE TOOLTIP COMPONENT
// ============================================
// ============================================
// ZONE TOOLTIP COMPONENT (UPDATED)
// ============================================
const ZoneTooltip = React.memo(({ polygon, position, selectedMetric }) => {
  if (!polygon || !position) return null;

  const {
    name,
    pointCount,
    fillColor,
    bestProvider,
    bestProviderValue,
    bestBand,
    bestBandValue,
    bestTechnology,
    bestTechnologyValue,
    bestScore,
    providerBreakdown,
    categoryStats,
    medianValue,
  } = polygon;

  const config = METRIC_CONFIG[selectedMetric] || { unit: "", higherIsBetter: true };
  const unit = config.unit || "";

  // Get provider data from either source
  let providers = [];

  if (providerBreakdown && Object.keys(providerBreakdown).length > 0) {
    // Best Network mode
    providers = Object.entries(providerBreakdown)
      .filter(([_, data]) => data && data.count > 0)
      .map(([providerName, data]) => ({
        name: providerName,
        count: data.count,
        color: data.color || getProviderColor(providerName),
        medianScore: data.medianScore,
        metricMedian: data.metrics?.[selectedMetric]?.median,
        isWinner: providerName === bestProvider,
      }))
      .sort((a, b) => (b.medianScore ?? -Infinity) - (a.medianScore ?? -Infinity));
  } else if (categoryStats?.provider?.stats?.length > 0) {
    // Area mode
    providers = categoryStats.provider.stats.map((stat) => ({
      name: stat.name,
      count: stat.count,
      percentage: stat.percentage,
      color: getProviderColor(stat.name),
      avgValue: stat.avgValue,
      medianValue: stat.medianValue,
      metricMedian: stat.medianValue ?? stat.avgValue,
      isWinner: stat.name === bestProvider,
    }));
    
    // Sort by metric value (best first)
    providers.sort((a, b) => {
      const aVal = a.metricMedian ?? -Infinity;
      const bVal = b.metricMedian ?? -Infinity;
      return config.higherIsBetter ? bVal - aVal : aVal - bVal;
    });
  }

  // Get bands data
  let bands = [];
  if (categoryStats?.band?.stats?.length > 0) {
    bands = categoryStats.band.stats.map((stat) => ({
      name: stat.name,
      count: stat.count,
      percentage: stat.percentage,
      color: getBandColor(stat.name),
      metricMedian: stat.medianValue ?? stat.avgValue,
      isWinner: stat.name === bestBand,
    }));
    
    bands.sort((a, b) => {
      const aVal = a.metricMedian ?? -Infinity;
      const bVal = b.metricMedian ?? -Infinity;
      return config.higherIsBetter ? bVal - aVal : aVal - bVal;
    });
  }

  // Get technology data
  let technologies = [];
  if (categoryStats?.technology?.stats?.length > 0) {
    technologies = categoryStats.technology.stats.map((stat) => ({
      name: stat.name,
      count: stat.count,
      percentage: stat.percentage,
      color: getTechnologyColor(stat.name),
      metricMedian: stat.medianValue ?? stat.avgValue,
      isWinner: stat.name === bestTechnology,
    }));
    
    technologies.sort((a, b) => {
      const aVal = a.metricMedian ?? -Infinity;
      const bVal = b.metricMedian ?? -Infinity;
      return config.higherIsBetter ? bVal - aVal : aVal - bVal;
    });
  }

  // No data
  if (!pointCount || pointCount === 0) {
    return (
      <div
        className="fixed z-[1000] bg-white rounded-lg shadow-xl border border-gray-300 p-4"
        style={{
          left: Math.min(position.x + 15, window.innerWidth - 220),
          top: Math.min(position.y - 10, window.innerHeight - 100),
          pointerEvents: "none",
        }}
      >
        <div className="font-semibold text-gray-800 mb-1">{name || "Zone"}</div>
        <div className="text-sm text-gray-500">No data available</div>
      </div>
    );
  }

  const hasBestNetwork = !!polygon.bestProvider && providerBreakdown;

  return (
    <div
      className="fixed z-[1000] bg-white rounded-xl shadow-2xl border-2 overflow-hidden"
      style={{
        left: Math.min(position.x + 15, window.innerWidth - 450),
        top: Math.min(position.y - 10, window.innerHeight - 500),
        pointerEvents: "none",
        borderColor: fillColor || "#3B82F6",
        minWidth: "400px",
        maxWidth: "480px",
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: fillColor || "#3B82F6" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📍</span>
          <span className="font-bold text-white text-sm truncate max-w-[200px]">
            {name || "Zone"}
          </span>
        </div>
        <span className="text-xs text-white bg-white/25 px-2.5 py-1 rounded-full font-medium">
          {pointCount.toLocaleString()} samples
        </span>
      </div>

      {/* Median Value Banner */}
      {medianValue != null && (
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-xs text-blue-700 font-medium">
              Median {selectedMetric.toUpperCase()}
            </span>
            <span className="text-sm font-bold text-blue-800">
              {medianValue.toFixed(1)} {unit}
            </span>
          </div>
        </div>
      )}

      {/* Best Winners Summary */}
      {(bestProvider || bestBand || bestTechnology) && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-2 border-b border-amber-200">
          <div className="text-xs text-amber-700 font-semibold mb-1">🏆 Best by {selectedMetric.toUpperCase()}</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {bestProvider && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getProviderColor(bestProvider) }} />
                <span className="font-medium truncate">{bestProvider}</span>
                <span className="text-gray-500">({bestProviderValue?.toFixed(1)})</span>
              </div>
            )}
            {bestBand && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getBandColor(bestBand) }} />
                <span className="font-medium">B{bestBand}</span>
                <span className="text-gray-500">({bestBandValue?.toFixed(1)})</span>
              </div>
            )}
            {bestTechnology && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getTechnologyColor(bestTechnology) }} />
                <span className="font-medium truncate">{bestTechnology}</span>
                <span className="text-gray-500">({bestTechnologyValue?.toFixed(1)})</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabs for Provider/Band/Technology */}
      <div className="max-h-[280px] overflow-y-auto">
        {/* Providers Section */}
        {providers.length > 0 && (
          <div className="border-b">
            <div className="bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 flex items-center gap-1">
              <span>📡</span> Providers
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 text-[10px]">
                <tr>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-500">Name</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">Samples</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">Share</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">{selectedMetric.toUpperCase()}</th>
                </tr>
              </thead>
              <tbody>
                {providers.slice(0, 5).map((item, index) => (
                  <tr
                    key={item.name}
                    className={`border-t border-gray-100 ${item.isWinner ? "bg-green-50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {item.isWinner && <span className="text-xs">🥇</span>}
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className={`text-xs ${item.isWinner ? "font-bold" : ""} truncate max-w-[80px]`}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center text-xs text-gray-600">{item.count}</td>
                    <td className="py-1.5 px-3 text-center text-xs text-gray-600">{item.percentage}%</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`text-xs font-medium ${item.isWinner ? "text-green-600" : "text-gray-700"}`}>
                        {item.metricMedian?.toFixed(1) ?? "—"} {unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bands Section */}
        {bands.length > 0 && (
          <div className="border-b">
            <div className="bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 flex items-center gap-1">
              <span>📶</span> Bands
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 text-[10px]">
                <tr>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-500">Band</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">Samples</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">Share</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">{selectedMetric.toUpperCase()}</th>
                </tr>
              </thead>
              <tbody>
                {bands.slice(0, 5).map((item, index) => (
                  <tr
                    key={item.name}
                    className={`border-t border-gray-100 ${item.isWinner ? "bg-green-50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {item.isWinner && <span className="text-xs">🥇</span>}
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className={`text-xs ${item.isWinner ? "font-bold" : ""}`}>
                          Band {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center text-xs text-gray-600">{item.count}</td>
                    <td className="py-1.5 px-3 text-center text-xs text-gray-600">{item.percentage}%</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`text-xs font-medium ${item.isWinner ? "text-green-600" : "text-gray-700"}`}>
                        {item.metricMedian?.toFixed(1) ?? "—"} {unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Technologies Section */}
        {technologies.length > 0 && (
          <div>
            <div className="bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-600 flex items-center gap-1">
              <span>🌐</span> Technologies
            </div>
            <table className="w-full">
              <thead className="bg-gray-50 text-[10px]">
                <tr>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-500">Technology</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">Samples</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">Share</th>
                  <th className="text-center py-1.5 px-3 font-semibold text-gray-500">{selectedMetric.toUpperCase()}</th>
                </tr>
              </thead>
              <tbody>
                {technologies.slice(0, 5).map((item, index) => (
                  <tr
                    key={item.name}
                    className={`border-t border-gray-100 ${item.isWinner ? "bg-green-50" : index % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1.5">
                        {item.isWinner && <span className="text-xs">🥇</span>}
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className={`text-xs ${item.isWinner ? "font-bold" : ""} truncate max-w-[80px]`}>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 text-center text-xs text-gray-600">{item.count}</td>
                    <td className="py-1.5 px-3 text-center text-xs text-gray-600">{item.percentage}%</td>
                    <td className="py-1.5 px-3 text-center">
                      <span className={`text-xs font-medium ${item.isWinner ? "text-green-600" : "text-gray-700"}`}>
                        {item.metricMedian?.toFixed(1) ?? "—"} {unit}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-100 border-t">
        <div className="text-[10px] text-gray-500 text-center">
          Ranked by {selectedMetric.toUpperCase()} • {config.higherIsBetter ? "Higher is better" : "Lower is better"}
        </div>
      </div>
    </div>
  );
});

ZoneTooltip.displayName = "ZoneTooltip";

// ============================================
// BEST NETWORK LEGEND
// ============================================
const BestNetworkLegend = React.memo(({ stats, providerColors, enabled }) => {
  if (!enabled || !stats || Object.keys(stats).length === 0) return null;

  const sortedProviders = Object.entries(stats).sort(
    (a, b) => b[1].locationsWon - a[1].locationsWon
  );

  const totalZones = sortedProviders.reduce((sum, [_, d]) => sum + d.locationsWon, 0);

  return (
    <div className="absolute bottom-4 left-4 z-[500] bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-3 min-w-[220px] max-w-[280px]">
      <div className="font-bold text-sm mb-2 text-gray-800 border-b pb-2 flex items-center gap-2">
        <span>🏆</span>
        <span>Best Network by Zone</span>
      </div>
      
      <div className="space-y-1.5">
        {sortedProviders.map(([provider, data], index) => (
          <div key={provider} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs w-4">{index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : ""}</span>
              <div
                className="w-3 h-3 rounded"
                style={{ backgroundColor: data.color || providerColors?.[provider] || getProviderColor(provider) }}
              />
              <span className="text-sm font-medium text-gray-700">{provider}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{data.locationsWon}/{totalZones}</span>
              <span className="text-xs font-bold text-gray-800 min-w-[40px] text-right">
                {data.percentage?.toFixed(0) || 0}%
              </span>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-2 pt-2 border-t text-[10px] text-gray-400 text-center">
        Based on weighted composite score
      </div>
    </div>
  );
});

BestNetworkLegend.displayName = "BestNetworkLegend";

// ============================================
// MAIN COMPONENT
// ============================================
const UnifiedMapView = () => {
  const [searchParams] = useSearchParams();

  // State declarations
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [locations, setLocations] = useState([]);
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [predictionColorSettings, setPredictionColorSettings] = useState([]);

  const [isSideOpen, setIsSideOpen] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("rsrp");
  const [ui, setUi] = useState({ basemapStyle: "roadmap" });
  const [viewport, setViewport] = useState(null);
  const [colorBy, setColorBy] = useState(null);

  const [enableDataToggle, setEnableDataToggle] = useState(true);
  const [dataToggle, setDataToggle] = useState("sample");
  const [enableSiteToggle, setEnableSiteToggle] = useState(false);
  const [siteToggle, setSiteToggle] = useState("NoML");
  const [showSiteMarkers, setShowSiteMarkers] = useState(true);
  const [showSiteSectors, setShowSiteSectors] = useState(true);
  const [showNeighbors, setShowNeighbors] = useState(false);

  const [polygons, setPolygons] = useState([]);
  const [showPolygons, setShowPolygons] = useState(false);
  const [polygonSource, setPolygonSource] = useState("map");
  const [onlyInsidePolygons, setOnlyInsidePolygons] = useState(false);

  const [areaData, setAreaData] = useState([]);
  const [areaEnabled, setAreaEnabled] = useState(false);
  const [hoveredPolygon, setHoveredPolygon] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(null);

  const [bestNetworkEnabled, setBestNetworkEnabled] = useState(false);
  const [bestNetworkWeights, setBestNetworkWeights] = useState(DEFAULT_WEIGHTS);
  const [bestNetworkOptions, setBestNetworkOptions] = useState({
    gridSize: 0.0005,
    minSamples: 3,
    minMetrics: 2,
    removeOutliersEnabled: true,
    calculationMethod: "median",
    percentileValue: 50,
    outlierMultiplier: 1.5,
  });

  const [coverageHoleFilters, setCoverageHoleFilters] = useState(DEFAULT_COVERAGE_FILTERS);
  const [dataFilters, setDataFilters] = useState(DEFAULT_DATA_FILTERS);
  const [enableGrid, setEnableGrid] = useState(false);
  const [gridSizeMeters, setGridSizeMeters] = useState(20);

  const [appSummary, setAppSummary] = useState({});
  const [logArea, setLogArea] = useState(null);

  const mapRef = useRef(null);

  const projectId = useMemo(() => {
    const param = searchParams.get("project_id") ?? searchParams.get("project");
    return param ? Number(param) : null;
  }, [searchParams]);

  const sessionIds = useMemo(() => {
    const param = searchParams.get("sessionId") ?? searchParams.get("session");
    if (!param) return [];
    return param.split(",").map((s) => s.trim()).filter(Boolean);
  }, [searchParams]);

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const { siteData, loading: siteLoading, error: siteError, refetch: refetchSites } = useSiteData({
    enableSiteToggle,
    siteToggle,
    projectId,
    sessionIds,
    autoFetch: true,
  });

  const { allNeighbors, stats: neighborStats, loading: neighborLoading, refetch: refetchNeighbors } = useNeighborCollisions({
    sessionIds,
    enabled: showNeighbors,
  });

  const {
    processedPolygons: bestNetworkPolygons,
    stats: bestNetworkStats,
    providerColors: bestNetworkProviderColors,
  } = useBestNetworkCalculation(
    locations,
    bestNetworkWeights,
    bestNetworkEnabled,
    bestNetworkOptions,
    areaData
  );

  const isLoading = loading || siteLoading || neighborLoading;

  // Load thresholds
  useEffect(() => {
    const load = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        const d = res?.Data;
        if (d) {
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
      } catch (e) {
        console.error("Failed to load thresholds:", e);
      }
    };
    load();
  }, []);

  // Fetch functions
  const fetchSampleData = useCallback(async () => {
    if (!sessionIds.length) {
      toast.warn("No session IDs provided");
      setLocations([]);
      return;
    }

    setLoading(true);
    setError(null);
    setLocations([]);

    const accumulatedLogs = [];

    try {
      const startTime = performance.now();

      for (let i = 0; i < sessionIds.length; i++) {
        const sessionId = sessionIds[i];

        try {
          const response = await mapViewApi.getNetworkLog({ session_id: sessionId });
          const sessionLogs = extractLogsFromResponse(response);

          sessionLogs.forEach((log) => {
            const parsed = parseLogEntry(log, sessionId);
            if (parsed) accumulatedLogs.push(parsed);
          });

          setLocations([...accumulatedLogs]);
        } catch (err) {
          console.error(`Session ${sessionId} failed:`, err.message);
        }

        if (i < sessionIds.length - 1) await delay(100);
      }

      const fetchTime = ((performance.now() - startTime) / 1000).toFixed(2);

      if (accumulatedLogs.length > 0) {
        toast.success(`✅ ${accumulatedLogs.length} points loaded in ${fetchTime}s`);
      } else {
        toast.warn("No valid log data found");
      }
    } catch (err) {
      console.error("Critical error:", err);
      toast.error(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionIds]);

  const fetchPredictionData = useCallback(async () => {
    if (!projectId) {
      toast.warn("No project ID for predictions");
      setLocations([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await mapViewApi.getPredictionLog({
        projectId: Number(projectId),
        metric: selectedMetric.toUpperCase(),
      });

      if (res?.Status === 1 && res?.Data) {
        const { dataList = [], colorSetting = [] } = res.Data;

        const formatted = dataList
          .map((pt) => {
            const lat = parseFloat(pt.lat);
            const lng = parseFloat(pt.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return { lat, lng, latitude: lat, longitude: lng, [selectedMetric]: pt.prm, isPrediction: true };
          })
          .filter(Boolean);

        setLocations(formatted);
        setPredictionColorSettings(colorSetting);
        toast.success(`${formatted.length} prediction points`);
      } else {
        toast.error(res?.Message || "No prediction data");
        setLocations([]);
      }
    } catch (err) {
      console.error("Prediction error:", err);
      toast.error(err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedMetric]);

  const fetchPolygons = useCallback(async () => {
    if (!projectId || !showPolygons) {
      setPolygons([]);
      return;
    }

    try {
      const res = await mapViewApi.getProjectPolygonsV2(projectId, polygonSource);
      const items = res?.Data || res?.data?.Data || (Array.isArray(res) ? res : []);

      const parsed = items.flatMap((item) => {
        const wkt = item.Wkt || item.wkt;
        if (!wkt) return [];
        return parseWKTToPolygons(wkt).map((p, k) => ({
          id: item.Id || item.id,
          name: item.Name || item.name || `Polygon ${item.Id}`,
          source: polygonSource,
          uid: `${polygonSource}-${item.Id}-${k}`,
          paths: p.paths,
          bbox: computeBbox(p.paths[0]),
        }));
      });

      setPolygons(parsed);
      if (parsed.length) toast.success(`${parsed.length} polygon(s) loaded`);
    } catch (err) {
      console.error("Polygon error:", err);
      setPolygons([]);
    }
  }, [projectId, showPolygons, polygonSource]);

  const fetchAreaPolygons = useCallback(async () => {
    if (!projectId || !areaEnabled) {
      setAreaData([]);
      return;
    }

    try {
      const res = await areaBreakdownApi.getAreaPolygons(projectId);

      let zones = [];
      if (res?.data?.ai_zones?.length > 0) zones = res.data.ai_zones;
      else if (Array.isArray(res?.data)) zones = res.data;
      else if (Array.isArray(res)) zones = res;

      if (!zones?.length) {
        toast.warning("No area zones found");
        setAreaData([]);
        return;
      }

      const parsed = zones
        .map((zone, index) => {
          const geometry = zone.geometry || zone.Geometry || zone.wkt || zone.Wkt;
          if (!geometry) return null;

          const poly = parseWKTToPolygons(geometry)[0];
          if (!poly?.paths?.[0]?.length) return null;

          return {
            id: zone.id || zone.Id || index,
            blockId: zone.block_id || zone.blockId,
            name: zone.project_name || zone.name || `Block ${zone.block_id || index}`,
            source: "area",
            uid: `area-${zone.id || zone.Id || index}`,
            paths: poly.paths,
            bbox: computeBbox(poly.paths[0]),
          };
        })
        .filter(Boolean);

      setAreaData(parsed);
      if (parsed.length > 0) toast.success(`${parsed.length} area zone(s) loaded`);
    } catch (err) {
      console.error("Area polygon error:", err);
      toast.error(`Failed to load area zones: ${err.message}`);
      setAreaData([]);
    }
  }, [projectId, areaEnabled]);

  // Effects
  useEffect(() => {
    if (!enableDataToggle && !enableSiteToggle) {
      setLocations([]);
      return;
    }

    if (enableDataToggle) {
      dataToggle === "sample" ? fetchSampleData() : fetchPredictionData();
    } else if (enableSiteToggle && siteToggle === "sites-prediction") {
      fetchPredictionData();
    }
  }, [enableDataToggle, enableSiteToggle, dataToggle, siteToggle, fetchSampleData, fetchPredictionData]);

  useEffect(() => { fetchPolygons(); }, [fetchPolygons]);
  useEffect(() => { fetchAreaPolygons(); }, [fetchAreaPolygons]);

  // Memoized values
  const effectiveThresholds = useMemo(() => {
    if (predictionColorSettings.length && dataToggle === "prediction") {
      return {
        ...thresholds,
        [selectedMetric]: predictionColorSettings.map((s) => ({
          min: parseFloat(s.min),
          max: parseFloat(s.max),
          color: s.color,
        })),
      };
    }
    return thresholds;
  }, [thresholds, predictionColorSettings, selectedMetric, dataToggle]);

  const availableFilterOptions = useMemo(() => {
    const providers = new Set();
    const bands = new Set();
    const technologies = new Set();

    locations.forEach((loc) => {
      if (loc.provider) providers.add(loc.provider);
      if (loc.band) bands.add(loc.band);
      if (loc.technology) technologies.add(loc.technology);
    });

    return {
      providers: [...providers].sort(),
      bands: [...bands].sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)),
      technologies: [...technologies].sort(),
    };
  }, [locations]);

  const filteredLocations = useMemo(() => {
    let result = [...locations];

    const activeCoverageFilters = Object.entries(coverageHoleFilters).filter(([, config]) => config.enabled);

    if (activeCoverageFilters.length > 0) {
      result = result.filter((loc) =>
        activeCoverageFilters.every(([metric, { threshold }]) => {
          const val = parseFloat(loc[metric]);
          return !isNaN(val) && val < threshold;
        })
      );
    }

    const { providers, bands, technologies } = dataFilters;
    if (providers.length) result = result.filter((l) => providers.includes(l.provider));
    if (bands.length) result = result.filter((l) => bands.includes(l.band));
    if (technologies.length) result = result.filter((l) => technologies.includes(l.technology));

    return result;
  }, [locations, coverageHoleFilters, dataFilters]);

  const polygonsWithColors = useMemo(() => {
    if (!showPolygons || !polygons.length) return [];

    if (!onlyInsidePolygons || !locations.length) {
      return polygons.map((p) => ({
        ...p,
        fillColor: "#4285F4",
        fillOpacity: 0.35,
        pointCount: 0,
      }));
    }

    const thresholdKey = getThresholdKey(selectedMetric);
    const currentThresholds = effectiveThresholds[thresholdKey] || [];

    return polygons.map((poly) => {
      const pointsInside = locations.filter((pt) => isPointInPolygon(pt, poly));
      const values = pointsInside.map((p) => parseFloat(p[selectedMetric])).filter((v) => !isNaN(v));

      if (!values.length) {
        return { ...poly, fillColor: "#ccc", fillOpacity: 0.3, pointCount: pointsInside.length };
      }

      const median = calculateMedian(values);
      const fillColor = getColorFromValueOrMetric(median, currentThresholds, selectedMetric);

      return {
        ...poly,
        fillColor,
        fillOpacity: 0.7,
        pointCount: pointsInside.length,
        medianValue: median,
      };
    });
  }, [showPolygons, polygons, onlyInsidePolygons, locations, selectedMetric, effectiveThresholds]);

  // FIXED: Area polygons with proper color calculation
  const areaPolygonsWithColors = useMemo(() => {
  if (!areaEnabled || !areaData.length) return [];

  if (!filteredLocations.length) {
    return areaData.map((p) => ({
      ...p,
      fillColor: "#9333ea",
      fillOpacity: 0.25,
      pointCount: 0,
      medianValue: null,
      categoryStats: null,
      bestProvider: null,
      bestBand: null,
      bestTechnology: null,
    }));
  }

  const thresholdKey = getThresholdKey(selectedMetric);
  const currentThresholds = thresholds[thresholdKey] || [];
  const useCategorical = colorBy && ["provider", "band", "technology"].includes(colorBy);
  const metricConfig = METRIC_CONFIG[selectedMetric] || { higherIsBetter: true };

  return areaData.map((poly) => {
    const pointsInside = filteredLocations.filter((pt) => isPointInPolygon(pt, poly));

    if (!pointsInside.length) {
      return {
        ...poly,
        fillColor: "#ccc",
        fillOpacity: 0.3,
        pointCount: 0,
        medianValue: null,
        categoryStats: null,
        bestProvider: null,
        bestBand: null,
        bestTechnology: null,
      };
    }

    // Calculate category stats with median values
    const providerStats = calculateCategoryStats(pointsInside, "provider", selectedMetric);
    const bandStats = calculateCategoryStats(pointsInside, "band", selectedMetric);
    const technologyStats = calculateCategoryStats(pointsInside, "technology", selectedMetric);

    // Get overall median
    const values = pointsInside
      .map((p) => parseFloat(p[selectedMetric]))
      .filter((v) => !isNaN(v) && v != null);
    const medianValue = calculateMedian(values);

    // Helper function to find best category by metric value
    const findBestByMetric = (stats) => {
      if (!stats?.stats?.length) return { best: null, value: null };
      
      let best = null;
      let bestValue = metricConfig.higherIsBetter ? -Infinity : Infinity;
      
      stats.stats.forEach((stat) => {
        const median = stat.medianValue ?? stat.avgValue;
        if (median != null) {
          const isBetter = metricConfig.higherIsBetter 
            ? median > bestValue
            : median < bestValue;
          
          if (isBetter) {
            bestValue = median;
            best = stat.name;
          }
        }
      });
      
      return { best, value: bestValue === -Infinity || bestValue === Infinity ? null : bestValue };
    };

    // Find best for each category by metric value
    const { best: bestProvider, value: bestProviderValue } = findBestByMetric(providerStats);
    const { best: bestBand, value: bestBandValue } = findBestByMetric(bandStats);
    const { best: bestTechnology, value: bestTechnologyValue } = findBestByMetric(technologyStats);

    // Determine fill color based on colorBy
    let fillColor;
    
    if (useCategorical) {
      switch (colorBy) {
        case "provider":
          if (bestProvider) {
            fillColor = getProviderColor(bestProvider);
            console.log(`Zone "${poly.name}": Best provider by ${selectedMetric} = ${bestProvider} (${bestProviderValue?.toFixed(1)})`);
          } else {
            fillColor = providerStats?.dominant 
              ? getProviderColor(providerStats.dominant.name) 
              : "#ccc";
          }
          break;
          
        case "band":
          if (bestBand) {
            fillColor = getBandColor(bestBand);
            console.log(`Zone "${poly.name}": Best band by ${selectedMetric} = ${bestBand} (${bestBandValue?.toFixed(1)})`);
          } else {
            fillColor = bandStats?.dominant 
              ? getBandColor(bandStats.dominant.name) 
              : "#ccc";
          }
          break;
          
        case "technology":
          if (bestTechnology) {
            fillColor = getTechnologyColor(bestTechnology);
            console.log(`Zone "${poly.name}": Best technology by ${selectedMetric} = ${bestTechnology} (${bestTechnologyValue?.toFixed(1)})`);
          } else {
            fillColor = technologyStats?.dominant 
              ? getTechnologyColor(technologyStats.dominant.name) 
              : "#ccc";
          }
          break;
          
        default:
          fillColor = "#ccc";
      }
    } else {
      // Quality-based coloring (no colorBy selected)
      fillColor = medianValue !== null 
        ? getColorFromValueOrMetric(medianValue, currentThresholds, selectedMetric)
        : "#ccc";
    }

    return {
      ...poly,
      fillColor,
      fillOpacity: 0.7,
      strokeWeight: 2.5,
      pointCount: pointsInside.length,
      medianValue,
      bestProvider,
      bestProviderValue,
      bestBand,
      bestBandValue,
      bestTechnology,
      bestTechnologyValue,
      categoryStats: { 
        provider: providerStats, 
        band: bandStats, 
        technology: technologyStats 
      },
    };
  });
}, [areaEnabled, areaData, filteredLocations, selectedMetric, thresholds, colorBy]);

  const allBestNetworkPolygons = useMemo(() => {
    if (bestNetworkEnabled && bestNetworkPolygons?.length > 0) {
      return bestNetworkPolygons;
    }
    return [];
  }, [bestNetworkEnabled, bestNetworkPolygons]);

  const visiblePolygons = useMemo(() => {
    if (!showPolygons || !polygonsWithColors.length) return [];
    if (!viewport) return polygonsWithColors;

    return polygonsWithColors.filter((poly) => {
      if (!poly.bbox) return true;
      return !(
        poly.bbox.west > viewport.east ||
        poly.bbox.east < viewport.west ||
        poly.bbox.south > viewport.north ||
        poly.bbox.north < viewport.south
      );
    });
  }, [showPolygons, polygonsWithColors, viewport]);

  const mapCenter = useMemo(() => {
    if (!locations.length) return DEFAULT_CENTER;
    const sum = locations.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
    return { lat: sum.lat / locations.length, lng: sum.lng / locations.length };
  }, [locations]);

  const showDataCircles = enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction");
  const shouldShowLegend = enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction");

  const locationsToDisplay = useMemo(() => {
    if (!showDataCircles) return [];

    const hasCoverageFilters = Object.values(coverageHoleFilters).some((f) => f.enabled);
    const hasDataFilters = dataFilters.providers.length > 0 || dataFilters.bands.length > 0 || dataFilters.technologies.length > 0;

    if (hasCoverageFilters || hasDataFilters || onlyInsidePolygons) {
      return filteredLocations;
    }

    return locations;
  }, [showDataCircles, coverageHoleFilters, dataFilters, filteredLocations, locations, onlyInsidePolygons]);

  const debouncedSetViewport = useMemo(() => debounce(setViewport, 150), []);

  const handleMapLoad = useCallback((map) => {
    mapRef.current = map;
    const updateViewport = () => {
      const bounds = map.getBounds();
      if (!bounds) return;
      debouncedSetViewport({
        north: bounds.getNorthEast().lat(),
        south: bounds.getSouthWest().lat(),
        east: bounds.getNorthEast().lng(),
        west: bounds.getSouthWest().lng(),
      });
    };
    map.addListener("idle", updateViewport);
    updateViewport();
  }, [debouncedSetViewport]);

  const reloadData = useCallback(() => {
    if (enableSiteToggle) refetchSites();
    if (enableDataToggle) {
      dataToggle === "sample" ? fetchSampleData() : fetchPredictionData();
    }
    if (showPolygons) fetchPolygons();
    if (areaEnabled) fetchAreaPolygons();
    if (showNeighbors) refetchNeighbors();
  }, [enableDataToggle, enableSiteToggle, dataToggle, showPolygons, areaEnabled, showNeighbors, fetchSampleData, fetchPredictionData, fetchPolygons, fetchAreaPolygons, refetchSites, refetchNeighbors]);

  // Hover handlers
  const handlePolygonMouseOver = useCallback((poly, e) => {
    setHoveredPolygon(poly);
    setHoverPosition({ x: e.domEvent.clientX, y: e.domEvent.clientY });
  }, []);

  const handlePolygonMouseMove = useCallback((e) => {
    setHoverPosition({ x: e.domEvent.clientX, y: e.domEvent.clientY });
  }, []);

  const handlePolygonMouseOut = useCallback(() => {
    setHoveredPolygon(null);
    setHoverPosition(null);
  }, []);

  if (!isLoaded) {
    return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
  }

  if (loadError) {
    return <div className="flex items-center justify-center h-screen text-red-500">Map loading error: {loadError.message}</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-800">
      <UnifiedHeader
        onToggleControls={() => setIsSideOpen(!isSideOpen)}
        onLeftToggle={() => setShowAnalytics(!showAnalytics)}
        isControlsOpen={isSideOpen}
        showAnalytics={showAnalytics}
        projectId={projectId}
        sessionIds={sessionIds}
      />

      {showAnalytics && (
        <UnifiedDetailLogs
          locations={filteredLocations}
          totalLocations={locations.length}
          filteredCount={filteredLocations.length}
          dataToggle={dataToggle}
          enableDataToggle={enableDataToggle}
          selectedMetric={selectedMetric}
          siteData={siteData}
          siteToggle={siteToggle}
          enableSiteToggle={enableSiteToggle}
          showSiteMarkers={showSiteMarkers}
          showSiteSectors={showSiteSectors}
          polygons={polygonsWithColors}
          visiblePolygons={visiblePolygons}
          polygonSource={polygonSource}
          showPolygons={showPolygons}
          onlyInsidePolygons={onlyInsidePolygons}
          coverageHoleFilters={coverageHoleFilters}
          viewport={viewport}
          mapCenter={mapCenter}
          projectId={projectId}
          sessionIds={sessionIds}
          isLoading={isLoading}
          thresholds={effectiveThresholds}
          appSummary={appSummary}
          logArea={logArea}
          dataFilters={dataFilters}
          bestNetworkEnabled={bestNetworkEnabled}
          bestNetworkStats={bestNetworkStats}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      <UnifiedMapSidebar
        open={isSideOpen}
        onOpenChange={setIsSideOpen}
        enableDataToggle={enableDataToggle}
        setEnableDataToggle={setEnableDataToggle}
        dataToggle={dataToggle}
        setDataToggle={setDataToggle}
        enableSiteToggle={enableSiteToggle}
        setEnableSiteToggle={setEnableSiteToggle}
        siteToggle={siteToggle}
        setSiteToggle={setSiteToggle}
        projectId={projectId}
        sessionIds={sessionIds}
        metric={selectedMetric}
        setMetric={setSelectedMetric}
        coverageHoleFilters={coverageHoleFilters}
        setCoverageHoleFilters={setCoverageHoleFilters}
        dataFilters={dataFilters}
        setDataFilters={setDataFilters}
        availableFilterOptions={availableFilterOptions}
        colorBy={colorBy}
        setColorBy={setColorBy}
        ui={ui}
        onUIChange={setUi}
        showPolygons={showPolygons}
        setShowPolygons={setShowPolygons}
        polygonSource={polygonSource}
        setPolygonSource={setPolygonSource}
        onlyInsidePolygons={onlyInsidePolygons}
        setOnlyInsidePolygons={setOnlyInsidePolygons}
        polygonCount={polygons.length}
        showSiteMarkers={showSiteMarkers}
        setShowSiteMarkers={setShowSiteMarkers}
        showSiteSectors={showSiteSectors}
        setShowSiteSectors={setShowSiteSectors}
        loading={isLoading}
        reloadData={reloadData}
        showNeighbors={showNeighbors}
        setShowNeighbors={setShowNeighbors}
        neighborStats={neighborStats}
        areaEnabled={areaEnabled}
        setAreaEnabled={setAreaEnabled}
        enableGrid={enableGrid}
        setEnableGrid={setEnableGrid}
        gridSizeMeters={gridSizeMeters}
        setGridSizeMeters={setGridSizeMeters}
        bestNetworkEnabled={bestNetworkEnabled}
        setBestNetworkEnabled={setBestNetworkEnabled}
        bestNetworkWeights={bestNetworkWeights}
        setBestNetworkWeights={setBestNetworkWeights}
        bestNetworkOptions={bestNetworkOptions}
        setBestNetworkOptions={setBestNetworkOptions}
        bestNetworkStats={bestNetworkStats}
      />

      <div className="flex-grow relative overflow-hidden">
        {shouldShowLegend && !bestNetworkEnabled && (
          <MapLegend
            thresholds={effectiveThresholds}
            selectedMetric={selectedMetric}
            colorBy={colorBy}
            showOperators={colorBy === "provider"}
            showBands={colorBy === "band"}
            showTechnologies={colorBy === "technology"}
            showSignalQuality={!colorBy || colorBy === "metric"}
            availableFilterOptions={availableFilterOptions}
          />
        )}

        <BestNetworkLegend
          stats={bestNetworkStats}
          providerColors={bestNetworkProviderColors}
          enabled={bestNetworkEnabled}
        />

        <div className="relative h-full w-full">
          {isLoading && locations.length === 0 && siteData.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <Spinner />
            </div>
          ) : error || siteError ? (
            <div className="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-700">
              <div className="text-center space-y-2">
                {error && <p className="text-red-500">Data Error: {error}</p>}
                {siteError && <p className="text-red-500">Site Error: {siteError.message}</p>}
              </div>
            </div>
          ) : (
            <MapWithMultipleCircles
              isLoaded={isLoaded}
              loadError={loadError}
              locations={locationsToDisplay}
              thresholds={effectiveThresholds}
              selectedMetric={selectedMetric}
              colorBy={colorBy}
              activeMarkerIndex={null}
              onMarkerClick={() => {}}
              options={{ mapTypeId: ui.basemapStyle }}
              center={mapCenter}
              defaultZoom={13}
              fitToLocations={locationsToDisplay.length > 0}
              onLoad={handleMapLoad}
              pointRadius={5}
              projectId={projectId}
              polygonSource={polygonSource}
              enablePolygonFilter={true}
              showPolygonBoundary={true}
              enableGrid={enableGrid}
              gridSizeMeters={gridSizeMeters}
              areaEnabled={areaEnabled}
            >
              {showPolygons && visiblePolygons.map((poly) => (
                <Polygon
                  key={poly.uid}
                  paths={poly.paths[0]}
                  options={{
                    fillColor: poly.fillColor || "#4285F4",
                    fillOpacity: poly.fillOpacity || 0.35,
                    strokeColor: onlyInsidePolygons ? poly.fillColor : "#2563eb",
                    strokeWeight: 2,
                    strokeOpacity: 0.9,
                    clickable: true,
                    zIndex: 50,
                  }}
                />
              ))}

              {areaEnabled && !bestNetworkEnabled && areaPolygonsWithColors.map((poly) => (
                <Polygon
                  key={poly.uid}
                  paths={poly.paths[0]}
                  options={{
                    fillColor: poly.fillColor || "#9333ea",
                    fillOpacity: poly.fillOpacity || 0.7,
                    strokeColor: poly.fillColor || "#7c3aed",
                    strokeWeight: 2.5,
                    strokeOpacity: 0.9,
                    clickable: true,
                    zIndex: 60,
                  }}
                  onMouseOver={(e) => handlePolygonMouseOver(poly, e)}
                  onMouseMove={handlePolygonMouseMove}
                  onMouseOut={handlePolygonMouseOut}
                />
              ))}

              {bestNetworkEnabled && allBestNetworkPolygons.map((poly) => (
                <Polygon
                  key={poly.uid}
                  paths={poly.paths[0]}
                  options={{
                    fillColor: poly.fillColor || "#3B82F6",
                    fillOpacity: poly.fillOpacity || 0.65,
                    strokeColor: poly.fillColor || "#1E40AF",
                    strokeWeight: poly.strokeWeight || 2,
                    strokeOpacity: 0.95,
                    clickable: true,
                    zIndex: 70,
                  }}
                  onMouseOver={(e) => handlePolygonMouseOver(poly, e)}
                  onMouseMove={handlePolygonMouseMove}
                  onMouseOut={handlePolygonMouseOut}
                />
              ))}

              {enableSiteToggle && showSiteMarkers && (
                <SiteMarkers sites={siteData} showMarkers={showSiteMarkers} circleRadius={0} viewport={viewport} />
              )}

              {showNeighbors && allNeighbors.length > 0 && (
                <NeighborHeatmapLayer
                  allNeighbors={allNeighbors}
                  showNeighbors={showNeighbors}
                  selectedMetric={selectedMetric}
                  useHeatmap={true}
                  radius={35}
                  opacity={0.7}
                />
              )}

              {enableSiteToggle && showSiteSectors && (
                <NetworkPlannerMap
                  defaultRadius={10}
                  scale={0.2}
                  showSectors={showSiteSectors}
                  viewport={viewport}
                  options={{ zIndex: 100 }}
                  projectId={projectId}
                  minSectors={3}
                />
              )}
            </MapWithMultipleCircles>
          )}
        </div>
      </div>

      {hoveredPolygon && hoverPosition && (
        <ZoneTooltip polygon={hoveredPolygon} position={hoverPosition} selectedMetric={selectedMetric} />
      )}
    </div>
  );
};

export default UnifiedMapView;