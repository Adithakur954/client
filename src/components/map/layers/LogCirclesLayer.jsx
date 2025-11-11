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
  showNeighbours = false, // NEW PROP
}) {
  const [logs, setLogs] = useState([]);
  const [keys, setKeys] = useState([]);
  const [session, setSession] = useState([]);
  const [neighbours, setNeighbours] = useState([]);
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
        console.log("🚀 API Request Params:", apiParams);
    console.log("📊 Provider value being sent:", apiParams.Provider)

        const fetched = await mapViewApi.getLogsByDateRange(apiParams);
         console.log("✅ Fetched logs count:", fetched);

           if (fetched?.length > 0) {
      console.log("📋 Sample log providers:", 
        [...new Set(fetched.slice(0, 10).map(l => l.provider || l.Provider))]
      );
    }

        if (cancelled) return;

        if (!Array.isArray(fetched) || fetched.length === 0) {
          toast.warn("No logs found for the selected filters.");
          setLogs([]);
          setKeys([]);
          setSession([]);
          onLogsLoadedRef.current?.([]);
          if (heatmapRef.current) heatmapRef.current.setMap(null);
          return;
        }

        setKeys(fetched.map((item) => item.id));
        setSession([...new Set(fetched.map(item => item.session_id))]);

        setLogs(fetched);
        onLogsLoadedRef.current?.(fetched);

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
        setKeys([]);
        setSession([]);
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

  // Debug log for keys and sessions
  useEffect(() => {
    console.log("Keys:", keys);
    console.log("Sessions:", session);
  }, [keys, session]);

  // Fetch neighbours when sessions change and showNeighbours is true
  useEffect(() => {
    if (!showNeighbours || session.length === 0) {
      setNeighbours([]);
      return;
    }

    let cancelled = false;

    const fetchNeighbours = async () => {
      try {
        console.log("Fetching neighbours for sessions:", session);
        
        const responses = await Promise.all(
          session.map(id => mapViewApi.getNeighbours(id))
        );
        
        if (cancelled) return;

        // Flatten all responses
        const allData = responses.flatMap(r => r?.data || r || []);
        
        console.log("Neighbours fetched:", allData);
        setNeighbours(allData);
        
        if (allData.length > 0) {
          toast.success(`Loaded neighbour data for ${session.length} sessions`);
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error fetching neighbours:", error);
        toast.error(`Failed to fetch neighbours: ${error?.message || "Unknown error"}`);
        setNeighbours([]);
      }
    };

    fetchNeighbours();

    return () => {
      cancelled = true;
    };
  }, [session, showNeighbours]);

  // Debug log for neighbours
  useEffect(() => {
    if (neighbours.length > 0) {
      console.log("Neighbours data:", neighbours);
    }
  }, [neighbours]);

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
        const providerValue = log.provider || log.Provider;
        return getLogColor("provider", providerValue);
      }
      
      if (colorBy === "technology") {
        const techValue = log.network || log.Network;
        return getLogColor("technology", techValue);
      }
      
      if (colorBy === "band") {
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
      label: showNeighbours ? (p.raw.neighbour_count?.toString() || "") : "",
    }));
  }, [visibleProcessed, getColorForLog, showNeighbours]);

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
      neigh={showNeighbours} // PASS THE NEIGH PROP
      getRadiusPx={canvasRadiusPx}
      maxDraw={maxDraw}
      padding={80}
      opacity={0.9}
      showLabels={true} 
      labelStyle={{
        font: "bold 11px Arial",
        color: "#000",
        strokeColor: "#fff",
        strokeWidth: 3,
      }}
    />
  ) : null;
}