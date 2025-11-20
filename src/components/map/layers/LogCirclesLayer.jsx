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
  setAppSummary = () => {},
  appSummary,
  setIsLoading,
  showCircles = true,
  showHeatmap = false,
  visibleBounds = null,
  renderVisibleOnly = true,
  canvasRadiusPx = (zoom) => Math.max(3, Math.min(7, Math.floor(zoom / 2))),
  maxDraw = 60000,
  coverageHoleOnly = false,
  colorBy = null,
  showNeighbours = false,
}) {
  const [logs, setLogs] = useState([]);
  const [keys, setKeys] = useState([]);
  const [session, setSession] = useState([]);
  const [neighbours, setNeighbours] = useState([]);
 
  const heatmapRef = useRef(null);
  const { field } = resolveMetricConfig(selectedMetric);

  const onLogsLoadedRef = useRef(onLogsLoaded);
  useEffect(() => {
    onLogsLoadedRef.current = onLogsLoaded;
  }, [onLogsLoaded]);

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

  useEffect(() => {
    if (!filters || !map || !filterSignature) return;

    let cancelled = false;

    const fetchAndDrawLogs = async () => {
      setIsLoading?.(true);
      try {
        const apiParams = JSON.parse(filterSignature);
        console.log("🚀 API Request Params:", apiParams);
        console.log("📊 Provider value being sent:", apiParams.Provider);

        const response = await mapViewApi.getLogsByDateRange(apiParams);
        
        const fetched = response?.data || response || [];
        const appSummaryData = response?.app_summary || null;
        
        console.log("✅ API Response:", response);
        console.log("✅ Fetched logs count:", fetched.length);
        console.log("📱 App Summary:", appSummaryData);

        if (fetched?.length > 0) {
          console.log("📋 Sample log providers:", 
            [...new Set(fetched.slice(0, 10).map(l => l.provider || l.Provider))]
          );
          console.log("📋 Sample log structure:", fetched[0]);
        }

        if (cancelled) return;

        if (!Array.isArray(fetched) || fetched.length === 0) {
          toast.warn("No logs found for the selected filters.");
          setLogs([]);
          setKeys([]);
          setSession([]);
          setNeighbours([]);
          setAppSummary(null);
          onLogsLoadedRef.current?.([], null);
          if (heatmapRef.current) heatmapRef.current.setMap(null);
          return;
        }

        const sessionIds = [...new Set(
          fetched
            .map(item => item.session_id)
            .filter(id => id != null && id !== '')
        )];

        console.log("📊 Extracted session IDs:", sessionIds);

        setKeys(fetched.map((item) => item.id));
        setSession(sessionIds);
        setLogs(fetched);
        setAppSummary(appSummaryData);

        const pts = [];
        for (const log of fetched) {
          const lat = parseFloat(log.lat);
          const lng = parseFloat(log.lon ?? log.lng);
          if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push({ lat, lng });
        }
        
        if (pts.length > 0) {
          fitMapToMostlyLogs(map, pts);
        }

        toast.info(`Loaded ${fetched.length} logs from ${sessionIds.length} sessions.`);
      } catch (e) {
        if (cancelled) return;
        console.error("❌ Error fetching logs:", e);
        toast.error(`Failed to fetch logs: ${e?.message || "Unknown error"}`);
        setLogs([]);
        setKeys([]);
        setSession([]);
        setNeighbours([]);
        setAppSummary(null);
        onLogsLoadedRef.current?.([], null);
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

  useEffect(() => {
    console.log("Keys:", keys);
    console.log("Sessions:", session);
  }, [keys, session]);

  useEffect(() => {
    if (!showNeighbours || session.length === 0) {
      setNeighbours([]);
      return;
    }

    let cancelled = false;

    const fetchNeighbours = async () => {
      try {
        console.log("🔍 Fetching neighbours for sessions:", session);
        
        const responses = await Promise.all(
          session.map(id => mapViewApi.getNeighbours(id))
        );
        
        if (cancelled) return;

        const allData = responses.flatMap(response => {
          if (response?.data?.data && Array.isArray(response.data.data)) {
            return response.data.data;
          }
          if (response?.data && Array.isArray(response.data)) {
            return response.data;
          }
          if (Array.isArray(response)) {
            return response;
          }
          return [];
        });
        
        console.log("✅ Neighbours fetched:", allData.length);
        if (allData.length > 0) {
          console.log("📋 Sample neighbour structure:", allData[0]);
        }
        
        setNeighbours(allData);
        
        if (allData.length > 0) {
          toast.success(`Loaded ${allData.length} neighbour records for ${session.length} sessions`);
        } else {
          toast.info("No neighbour data found for selected sessions");
        }
      } catch (error) {
        if (cancelled) return;
        console.error("❌ Error fetching neighbours:", error);
        toast.error(`Failed to fetch neighbours: ${error?.message || "Unknown error"}`);
        setNeighbours([]);
      }
    };

    fetchNeighbours();

    return () => {
      cancelled = true;
    };
  }, [session, showNeighbours]);

  useEffect(() => {
    if (neighbours.length > 0) {
      console.log("Neighbours data:", neighbours);
    }
  }, [neighbours]);

  const logsWithNeighbours = useMemo(() => {
    if (!showNeighbours || neighbours.length === 0) {
      return logs;
    }

    const neighbourCountMap = new Map();
    
    neighbours.forEach((neighbour) => {
      const logId = neighbour.log_id || neighbour.id || neighbour.session_id;
      if (logId) {
        neighbourCountMap.set(logId, (neighbourCountMap.get(logId) || 0) + 1);
      }
    });

    console.log("📊 Neighbour count map:", Object.fromEntries(neighbourCountMap));

    const merged = logs.map((log) => ({
      ...log,
      neighbour_count: neighbourCountMap.get(log.id) || 
                       neighbourCountMap.get(log.session_id) || 0,
    }));

    const logsWithNeighbors = merged.filter(l => l.neighbour_count > 0);
    console.log(`✅ Merged: ${logsWithNeighbors.length} logs have neighbours`);

    return merged;
  }, [logs, neighbours, showNeighbours]);

  useEffect(() => {
    onLogsLoadedRef.current?.(logsWithNeighbours, appSummary);
  }, [logsWithNeighbours, appSummary]);

  const filteredLogs = useMemo(() => {
    if (!coverageHoleOnly) {
      return logsWithNeighbours;
    }

    const threshold = thresholds.coveragehole || -110;
    const filtered = logsWithNeighbours.filter((log) => {
      const rsrp = parseFloat(log.rsrp);
      return !isNaN(rsrp) && rsrp < threshold;
    });

    return filtered;
  }, [logsWithNeighbours, coverageHoleOnly, thresholds]);

  useEffect(() => {
    if (coverageHoleOnly && filteredLogs.length > 0 && logsWithNeighbours.length > 0) {
      const threshold = thresholds.coveragehole || -110;
      toast.info(
        `Showing ${filteredLogs.length} coverage holes (RSRP < ${threshold} dBm) out of ${logsWithNeighbours.length} total logs`,
        { autoClose: 3000 }
      );
    }
  }, [coverageHoleOnly, filteredLogs.length, logsWithNeighbours.length, thresholds.coveragehole]);

  const getColorForLog = useCallback(
    (log, metricValue) => {
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

      return getColorForMetric(selectedMetric, metricValue, thresholds);
    },
    [colorBy, selectedMetric, thresholds]
  );

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

  const pointsForCanvas = useMemo(() => {
    return visibleProcessed.map((p) => ({
      lat: p.lat,
      lng: p.lng,
      color: getColorForLog(p.raw, p.value),
      label: showNeighbours && p.raw.neighbour_count > 0 
        ? p.raw.neighbour_count.toString() 
        : "",
    }));
  }, [visibleProcessed, getColorForLog, showNeighbours]);

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
      neigh={showNeighbours}
      getRadiusPx={canvasRadiusPx}
      maxDraw={maxDraw}
      padding={80}
      opacity={0.9}
      showLabels={showNeighbours}
      labelStyle={{
        font: "bold 11px Arial",
        color: "#000",
        strokeColor: "#fff",
        strokeWidth: 3,
      }}
    />
  ) : null;
}