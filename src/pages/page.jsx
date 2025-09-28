// src/pages/MapView.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-toastify';

import MapWithMultipleCircles from '../components/MapwithMultipleCircle';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../lib/googleMapsLoader';

// Adjust these to your actual paths
import { mapViewApi, settingApi } from '../api/apiEndpoints';

const METRICS = [
  { value: 'rsrp', label: 'RSRP' },
  { value: 'rsrq', label: 'RSRQ' },
  { value: 'sinr', label: 'SINR' },
  { value: 'dl-throughput', label: 'DL Throughput' },
  { value: 'ul-throughput', label: 'UL Throughput' },
  { value: 'mos', label: 'MOS' },
  { value: 'lte-bler', label: 'LTE BLER' },
];

const defaultThresholds = {
  rsrp: [],
  rsrq: [],
  sinr: [],
  dl_thpt: [],
  ul_thpt: [],
  mos: [],
  lte_bler: [],
};

export default function MapView() {
  const [rawLocations, setRawLocations] = useState([]);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeMarker, setActiveMarker] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('rsrp');
  const [colorMode, setColorMode] = useState('thresholds'); // 'thresholds' | 'path'

  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => searchParams.get('session'), [searchParams]);

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  // Load thresholds
  useEffect(() => {
    const run = async () => {
      try {
        const res = await settingApi.getThresholdSettings();
        const d = res?.Data;
        if (d) {
          setThresholds({
            rsrp: JSON.parse(d.rsrp_json || '[]'),
            rsrq: JSON.parse(d.rsrq_json || '[]'),
            sinr: JSON.parse(d.sinr_json || '[]'),
            dl_thpt: JSON.parse(d.dl_thpt_json || '[]'),
            ul_thpt: JSON.parse(d.ul_thpt_json || '[]'),
            mos: JSON.parse(d.mos_json || '[]'),
            lte_bler: JSON.parse(d.lte_bler_json || '[]'),
          });
        }
      } catch {
        // use fallback colors automatically
      }
    };
    run();
  }, []);

  // Load session logs
  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided.');
      setLoading(false);
      return;
    }

    const fetchSessionLogs = async () => {
      try {
        setLoading(true);
        const resp = await mapViewApi.getNetworkLog({ session_id: sessionId }, { limit: 10000 });
        const rows = resp?.Data ?? resp?.data ?? resp ?? [];

        if (!Array.isArray(rows) || rows.length === 0) {
          toast.warn('No location data found for this session.');
          setRawLocations([]);
          return;
        }

        const formatted = rows
          .map((log) => {
            const lat = parseFloat(log.lat ?? log.Lat ?? log.latitude ?? log.Latitude);
            const lng = parseFloat(
              log.lon ?? log.lng ?? log.Lng ?? log.longitude ?? log.Longitude
            );
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

            return {
              lat,
              lng,
              radius: 18,
              timestamp: log.timestamp ?? log.time ?? log.created_at ?? log.createdAt,
              rsrp: log.rsrp ?? log.RSRP ?? log.rsrp_dbm,
              rsrq: log.rsrq ?? log.RSRQ,
              sinr: log.sinr ?? log.SINR,
              dl_thpt: log.dl_thpt ?? log.dl_tpt ?? log.DL ?? log.download ?? log.download_throughput,
              ul_thpt: log.ul_thpt ?? log.ul_tpt ?? log.UL ?? log.upload ?? log.upload_throughput,
              mos: log.mos ?? log.MOS,
              lte_bler: log.lte_bler ?? log.LTE_BLER ?? log.bler,
            };
          })
          .filter(Boolean);

        setRawLocations(formatted);
      } catch (err) {
        console.error(err);
        toast.error(`Failed to fetch session data: ${err?.message || 'Unknown error'}`);
        setError(`Failed to load data for session ID: ${sessionId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionLogs();
  }, [sessionId]);

  // Apply color mode (thresholds vs path start/end)
  const locations = useMemo(() => {
    if (colorMode !== 'path') return rawLocations;

    // Override color: start green, end red, middle blue
    return rawLocations.map((loc, index, arr) => {
      let color = '#007BFF'; // middle
      if (index === 0) color = '#28a745'; // start
      if (index === arr.length - 1) color = '#dc3545'; // end
      return { ...loc, color };
    });
  }, [rawLocations, colorMode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-900" />
      </div>
    );
  }
  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;
  }

  return (
    <div className="p-6 h-screen flex flex-col gap-4">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Drive Session Map View</h1>
          <p className="text-sm text-gray-500">Session ID: {sessionId}</p>
        </div>
        <Link to="/drive-test-sessions" className="text-blue-500 hover:underline">
          ← Back to Sessions
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Metric</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            {METRICS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Color mode</label>
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setColorMode('thresholds')}
              className={`px-3 py-1 text-sm border rounded-l ${colorMode === 'thresholds' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              title="Color by metric thresholds"
            >
              Thresholds
            </button>
            <button
              type="button"
              onClick={() => setColorMode('path')}
              className={`px-3 py-1 text-sm border rounded-r ${colorMode === 'path' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              title="Start = green, End = red"
            >
              Path
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-600">
          {colorMode === 'thresholds'
            ? <>Colors reflect <span className="font-semibold">{METRICS.find(m => m.value === selectedMetric)?.label}</span> thresholds.</>
            : <>The path starts <span className="text-green-600 font-semibold">green</span> and ends <span className="text-red-600 font-semibold">red</span>.</>}
        </div>
      </div>

      <div className="flex-grow rounded-lg border shadow-sm overflow-hidden">
        {locations.length > 0 ? (
          <MapWithMultipleCircles
            isLoaded={isLoaded}
            loadError={loadError}
            locations={locations}
            thresholds={thresholds}
            selectedMetric={selectedMetric}
            activeMarkerIndex={activeMarker}
            onMarkerClick={setActiveMarker}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p>No valid location data to display.</p>
          </div>
        )}
      </div>
    </div>
  );
}