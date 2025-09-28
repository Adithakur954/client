
import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { mapViewApi, settingApi } from '../api/apiEndpoints';
import { toast } from 'react-toastify';
import Spinner from '../components/common/Spinner';
import MapWithMultipleCircles from '../components/MapwithMultipleCircle';
import { useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '@/lib/googleMapsLoader';


const MapView = () => {
  const [locations, setLocations] = useState([]);
  const [thresholds, setThresholds] = useState({
    rsrp: [], rsrq: [], sinr: [], dl_thpt: [], ul_thpt: [], mos: [], lte_bler: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchParams] = useSearchParams();
  const [activeMarker, setActiveMarker] = useState(null);

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
        // fallback colors will be used automatically
      }
    };
    run();
  }, []);

  useEffect(() => {
    if (!sessionId) {
      setError('No session ID provided.');
      setLoading(false);
      return;
    }

    const fetchSessionLogs = async () => {
      try {
        setLoading(true);
        // use bulletproof endpoint (accepts object or id and extra params)
        const resp = await mapViewApi.getNetworkLog({ session_id: sessionId }, { limit: 10000 });
        const rows = resp?.Data ?? resp?.data ?? resp ?? [];

        if (!Array.isArray(rows) || rows.length === 0) {
          toast.warn('No location data found for this session.');
          setLocations([]);
          return;
        }

        // normalize points for the map
        const formattedLocations = rows
          .map((log) => {
            const lat = parseFloat(log.lat ?? log.Lat ?? log.latitude ?? log.Latitude);
            const lng = parseFloat(log.lon ?? log.lng ?? log.Lng ?? log.longitude ?? log.Longitude);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
            return {
              lat, lng,
              radius: 18,
              timestamp: log.timestamp ?? log.time ?? log.created_at ?? log.createdAt,
              rsrp: log.rsrp ?? log.RSRP ?? log.rsrp_dbm,
              rsrq: log.rsrq ?? log.RSRQ,
              sinr: log.sinr ?? log.SINR,
              // You can add dl/ul/mos/bler here if you want to switch metrics later
            };
          })
          .filter(Boolean);

        setLocations(formattedLocations);
      } catch (err) {
        console.error(err);
        toast.error(`Failed to fetch session data: ${err.message || 'Unknown error'}`);
        setError(`Failed to load data for session ID: ${sessionId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSessionLogs();
  }, [sessionId]);

  if (loading) return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
  if (error) return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">
          Drive Session Map View (ID: {sessionId})
        </h1>
        <Link to="/drive-test-sessions" className="text-blue-500 hover:underline">
          ← Back to Sessions
        </Link>
      </div>

      <p className="mb-4 text-muted-foreground">
        Showing {locations.length} recorded locations. Colors reflect RSRP thresholds.
      </p>

      <div className="flex-grow rounded-lg border shadow-sm overflow-hidden">
        {locations.length > 0 ? (
          <MapWithMultipleCircles

            isLoaded={isLoaded}
            loadError={loadError}
            locations={locations}
            thresholds={thresholds}
            selectedMetric="rsrp"              // RSRP by default
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
};

export default MapView;