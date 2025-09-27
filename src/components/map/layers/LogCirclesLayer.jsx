// src/components/map/layers/LogCirclesLayer.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { mapViewApi } from "@/api/apiEndpoints";
import CanvasPointsOverlay from "@/components/map/overlays/CanvasPointsOverlay";
import { resolveMetricConfig, getColorForMetric } from "@/utils/metrics";
import { toYmdLocal, fitMapToMostlyLogs } from "@/utils/maps";

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
}) {
  const [logs, setLogs] = useState([]);
  const heatmapRef = useRef(null);
  const { field } = resolveMetricConfig(selectedMetric);

  // Fetch logs
  useEffect(() => {
    if (!filters || !map) return;

    const fetchAndDrawLogs = async () => {
      setIsLoading?.(true);
      try {
        const apiParams = {
          StartDate: toYmdLocal(filters.startDate),
          EndDate: toYmdLocal(filters.endDate),
        };
        if (filters.provider && filters.provider !== "ALL") apiParams.Provider = filters.provider;
        if (filters.technology && filters.technology !== "ALL") apiParams.Technology = filters.technology;
        if (filters.band && filters.band !== "ALL") apiParams.Band = filters.band;

        const fetched = await mapViewApi.getLogsByDateRange(apiParams);
        if (!Array.isArray(fetched) || fetched.length === 0) {
          toast.warn("No logs found for the selected filters.");
          setLogs([]);
          onLogsLoaded?.([]);
          if (heatmapRef.current) heatmapRef.current.setMap(null);
          return;
        }

        setLogs(fetched);
        onLogsLoaded?.(fetched);

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
        toast.error(`Failed to fetch logs: ${e?.message || "Unknown error"}`);
        setLogs([]);
        onLogsLoaded?.([]);
        if (heatmapRef.current) heatmapRef.current.setMap(null);
      } finally {
        setIsLoading?.(false);
      }
    };

    fetchAndDrawLogs();
    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [filters, map]); 

  // Parse & prep
  const processed = useMemo(() => {
    return (logs || [])
      .map((l, i) => {
        const lat = parseFloat(l.lat);
        const lng = parseFloat(l.lon ?? l.lng);
        const val = parseFloat(l?.[field]);
        return {
          id: l.id ?? `log-${i}`,
          lat: Number.isFinite(lat) ? lat : null,
          lng: Number.isFinite(lng) ? lng : null,
          value: Number.isFinite(val) ? val : undefined,
        };
      })
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  }, [logs, field]);

  // Viewport filter
  const visibleProcessed = useMemo(() => {
    if (!renderVisibleOnly || !visibleBounds) return processed;
    const { north, south, east, west } = visibleBounds;
    const crossesAntimeridian = east < west;
    return processed.filter((p) => {
      const latOk = p.lat <= north && p.lat >= south;
      let lngOk = false;
      if (crossesAntimeridian) lngOk = p.lng >= west || p.lng <= east;
      else lngOk = p.lng <= east && p.lng >= west;
      return latOk && lngOk;
    });
  }, [processed, renderVisibleOnly, visibleBounds]);

  const pointsForCanvas = useMemo(() => {
    return visibleProcessed.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      color: getColorForMetric(selectedMetric, p.value, thresholds),
    }));
  }, [visibleProcessed, selectedMetric, thresholds]);

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
      heatmapRef.current = new g.maps.visualization.HeatmapLayer({ data: points, radius: 24 });
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