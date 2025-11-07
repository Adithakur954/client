// src/components/map/layers/LogCirclesLayer.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { mapViewApi } from "@/api/apiEndpoints";
import CanvasPointsOverlay from "@/components/map/overlays/CanvasPointsOverlay";
import { resolveMetricConfig, getColorForMetric } from "@/utils/metrics";
import { toYmdLocal, fitMapToMostlyLogs } from "@/utils/maps";
import { getLogColor } from "@/components/map/layout/MapSidebarFloating";

export default function LogCirclesLayer({
  map,
  filters,
  selectedMetric,
  thresholds,
  onLogsLoaded,
  setIsLoading,
  showCircles = true,
  showHeatmap = false,
  visibleBounds = null,
  renderVisibleOnly = true,
  canvasRadiusPx = (zoom) => Math.max(3, Math.min(7, Math.floor(zoom / 2))),
  maxDraw = 60000,
  coverageHoleOnly = false,
  colorBy = null,
}) {
  const [logs, setLogs] = useState([]);
  const [keys,setKeys] = useState([]);
  const heatmapRef = useRef(null);
  const { field } = resolveMetricConfig(selectedMetric);

  // Keep a stable ref for onLogsLoaded to avoid effect dependency loops
  const onLogsLoadedRef = useRef(onLogsLoaded);
  useEffect(() => {
    onLogsLoadedRef.current = onLogsLoaded;
  }, [onLogsLoaded]);

  // Build a stable signature for filters so effect only runs when actual values change
  const filterSignature = useMemo(() => {
    if (!filters) return null;
    return JSON.stringify({
      StartDate: toYmdLocal(filters.startDate),
      EndDate: toYmdLocal(filters.endDate),
      Provider: filters.provider && filters.provider !== "ALL" ? filters.provider : undefined,
      Technology: filters.technology && filters.technology !== "ALL" ? filters.technology : undefined,
      Band: filters.band && filters.band !== "ALL" ? filters.band : undefined,
    });
  }, [
    filters?.startDate,
    filters?.endDate,
    filters?.provider,
    filters?.technology,
    filters?.band,
  ]);

  // Fetch logs when map or filterSignature changes
  useEffect(() => {
    if (!filters || !map || !filterSignature) return;

    let cancelled = false;

    const fetchAndDrawLogs = async () => {
      setIsLoading?.(true);
      try {
        const apiParams = JSON.parse(filterSignature);

        const fetched = await mapViewApi.getLogsByDateRange(apiParams);

        if (cancelled) return;

        if (!Array.isArray(fetched) || fetched.length === 0) {
          toast.warn("No logs found for the selected filters.");
          setLogs([]);
          onLogsLoadedRef.current?.([]);
          if (heatmapRef.current) heatmapRef.current.setMap(null);
          return;
        }

        setKeys(fetched.map((item)=>item.id))

        setLogs(fetched);
        onLogsLoadedRef.current?.(fetched);

        // Fit map to logs
        const pts = [];
        for (const log of fetched) {
          const lat = parseFloat(log.lat);
          const lng = parseFloat(log.lon ?? log.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
        }
        fitMapToMostlyLogs(map, pts);

        toast.info(`Loaded ${fetched.length} logs.`);
      } catch (e) {
        if (cancelled) return;
        toast.error(`Failed to fetch logs: ${e?.message || "Unknown error"}`);
        setLogs([]);
        onLogsLoadedRef.current?.([]);
        if (heatmapRef.current) heatmapRef.current.setMap(null);
      } finally {
        if (!cancelled) setIsLoading?.(false);
      }
    };

    fetchAndDrawLogs();
    return () => {
      cancelled = true;
    };
  }, [map, filterSignature, setIsLoading]);

  // Filter logs for coverage holes if checkbox is enabled
  const filteredLogs = useMemo(() => {
    if (!coverageHoleOnly) {
      return logs;
    }

    const threshold = thresholds.coveragehole || -110;
    const filtered = logs.filter((log) => {
      const rsrp = parseFloat(log.rsrp);
      return !isNaN(rsrp) && rsrp < threshold;
    });

    return filtered;
  }, [logs, coverageHoleOnly, thresholds]);

  // Show info toast when coverage hole filter is active
  useEffect(() => {
    if (coverageHoleOnly && filteredLogs.length > 0 && logs.length > 0) {
      const threshold = thresholds.coveragehole || -110;
      toast.info(
        `Showing ${filteredLogs.length} coverage holes (RSRP < ${threshold} dBm) out of ${logs.length} total logs`,
        { autoClose: 3000 }
      );
    }
  }, [coverageHoleOnly, filteredLogs.length, logs.length, thresholds.coveragehole]);

  // Helper function to determine color for a log
  const getColorForLog = useCallback(
    (log, metricValue) => {
      // If colorBy mode is active, use category colors
      if (colorBy === "provider") {
        // Use the provider field for provider coloring
        const providerValue = log.provider || log.Provider;
        return getLogColor("provider", providerValue);
      }
      
      if (colorBy === "technology") {
        // Use 'network' field for technology (based on your data structure)
        const techValue = log.network || log.Network;
        return getLogColor("technology", techValue);
      }
      
      if (colorBy === "band") {
        // Use 'band' field
        const bandValue = log.band || log.Band;
        return getLogColor("band", bandValue);
      }

      // Otherwise, use metric-based colors (default behavior)
      return getColorForMetric(selectedMetric, metricValue, thresholds);
    },
    [colorBy, selectedMetric, thresholds]
  );

  // Parse & prep (use filteredLogs)
  const processed = useMemo(() => {
    return (filteredLogs || [])
      .map((l, i) => {
        const lat = parseFloat(l.lat);
        const lng = parseFloat(l.lon ?? l.lng);
        const val = parseFloat(l?.[field]);
        return {
          id: l.id ?? `log-${i}`,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          value: Number.isFinite(val) ? val : undefined,
          raw: l,
        };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }, [filteredLogs, field]);

  // Viewport filter
  const visibleProcessed = useMemo(() => {
    if (!renderVisibleOnly || !visibleBounds) return processed;
    const { north, south, east, west } = visibleBounds;
    const crossesAntimeridian = east < west;
    return processed.filter((p) => {
      const latOk = p.lat <= north && p.lat >= south;
      const lngOk = crossesAntimeridian
        ? p.lng >= west || p.lng <= east
        : p.lng <= east && p.lng >= west;
      return latOk && lngOk;
    });
  }, [processed, renderVisibleOnly, visibleBounds]);

  // Color points based on colorBy mode or selected metric
  const pointsForCanvas = useMemo(() => {
    return visibleProcessed.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      color: getColorForLog(p.raw, p.value),
    }));
  }, [visibleProcessed, getColorForLog]);

  // Heatmap layer
  useEffect(() => {
    if (!map || !showHeatmap) {
      if (heatmapRef.current) heatmapRef.current.setMap(null);
      return;
    }
    const g = window.google;
    if (!g?.maps?.visualization) return;

    const points = processed.map((p) => new g.maps.LatLng(p.lat, p.lng));
    if (!heatmapRef.current) {
      heatmapRef.current = new g.maps.visualization.HeatmapLayer({
        data: points,
        radius: 24,
      });
      heatmapRef.current.setMap(map);
    } else {
      heatmapRef.current.setData(points);
      heatmapRef.current.setMap(map);
    }
    return () => heatmapRef.current?.setMap(null);
  }, [showHeatmap, processed, map]);

  if (!showCircles && !showHeatmap) return null;

  return showCircles ? (
    <CanvasPointsOverlay
      map={map}
      points={pointsForCanvas}
      getRadiusPx={canvasRadiusPx}
      maxDraw={maxDraw}
      padding={80}
      opacity={0.9}
    />
  ) : null;
}