// src/pages/LogsCirclesPage.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, useJsApiLoader } from "@react-google-maps/api";
import LogCirclesLayer from "@/components/map/layers/LogCirclesLayer";
import MapLegend from "@/components/map/MapLegend";
import { settingApi } from "@/api/apiEndpoints";
import { GOOGLE_MAPS_LOADER_OPTIONS } from "@/lib/googleMapsLoader";

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID;
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };
const MAP_CONTAINER_STYLE = { height: "100vh", width: "100%" };

export default function LogsCirclesPage() {
  // Use the same loader options as everywhere else
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const [map, setMap] = useState(null);
  const [thresholds, setThresholds] = useState({});
  const [selectedMetric, setSelectedMetric] = useState("rsrp");
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 1),
    endDate: new Date(),
    provider: "ALL",
    technology: "ALL",
    band: "ALL",
  });

  const idleTimerRef = useRef(null);
  const [visibleBounds, setVisibleBounds] = useState(null);

  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        if (res?.Data) {
          const d = res.Data;
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
      } catch {}
    };
    fetchThresholds();
  }, []);

  const onMapLoad = useCallback((m) => {
    setMap(m);
    m.addListener("idle", () => {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        const b = m.getBounds?.();
        if (b) {
          const ne = b.getNorthEast();
          const sw = b.getSouthWest();
          setVisibleBounds({
            north: ne.lat(),
            east: ne.lng(),
            south: sw.lat(),
            west: sw.lng(),
          });
        }
      }, 120);
    });
  }, []);

  if (loadError) return <div>Error loading Google Maps.</div>;
  if (!isLoaded) return <div style={{ padding: 16 }}>Loading map…</div>;

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      <div style={{
        position: "absolute", top: 16, left: 16, zIndex: 10,
        background: "white", borderRadius: 8, padding: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.15)"
      }}>
        <label>
          Metric:
          <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value)} style={{ marginLeft: 4 }}>
            <option value="rsrp">RSRP</option>
            <option value="rsrq">RSRQ</option>
            <option value="sinr">SINR</option>
            <option value="dl-throughput">DL Throughput</option>
            <option value="ul-throughput">UL Throughput</option>
            <option value="mos">MOS</option>
            <option value="lte-bler">LTE BLER</option>
          </select>
        </label>
      </div>

      <GoogleMap
        mapContainerStyle={MAP_CONTAINER_STYLE}
        center={DEFAULT_CENTER}
        zoom={13}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          mapId: MAP_ID,
          gestureHandling: "greedy",
        }}
      >
        <LogCirclesLayer
          map={map}
          filters={filters}
          selectedMetric={selectedMetric}
          thresholds={thresholds}
          showCircles={true}
          showHeatmap={false}
          visibleBounds={visibleBounds}
          renderVisibleOnly={true}
          canvasRadiusPx={(zoom) => Math.max(3, Math.min(7, Math.floor(zoom / 2)))}
          maxDraw={70000}
        />
      </GoogleMap>

      <MapLegend thresholds={thresholds} selectedMetric={selectedMetric} />
    </div>
  );
}