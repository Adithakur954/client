// src/pages/SessionMapDebug.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Circle } from '@react-google-maps/api';
import { mapViewApi } from '../api/apiEndpoints';
import Spinner from '../components/common/Spinner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '@/lib/googleMapsLoader';
import { toast } from 'react-toastify';

const containerStyle = {
  width: '100%',
  height: '100%',
  position: 'absolute',
  top: 0,
  left: 0
};

const DEFAULT_CENTER = {
  lat: 28.6139,
  lng: 77.2090
};

const SessionMapDebug = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [map, setMap] = useState(null);
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0 });

  // ✅ Parse session IDs - supports both single and comma-separated values
  const sessionIdParam = searchParams.get('sessionId') || searchParams.get('sessionIds');
  
  const sessionIds = React.useMemo(() => {
    if (!sessionIdParam) return [];
    // Split by comma and filter out empty values
    return sessionIdParam
      .split(',')
      .map(id => id.trim())
      .filter(id => id && id !== 'undefined' && id !== 'null');
  }, [sessionIdParam]);

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  // ✅ Fetch Data for Multiple Sessions
  useEffect(() => {
    const fetchAllSessionsData = async () => {
      if (sessionIds.length === 0) {
        setError('No session ID(s) provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setFetchProgress({ current: 0, total: sessionIds.length });
        
        console.log("📡 Fetching logs for sessions:", sessionIds);
        
        const allValidPoints = [];
        const errors = [];

        // Fetch logs for each session ID
        for (let i = 0; i < sessionIds.length; i++) {
          const sessionId = sessionIds[i];
          setFetchProgress({ current: i + 1, total: sessionIds.length });
          
          try {
            console.log(`📍 Fetching session ${i + 1}/${sessionIds.length}: ${sessionId}`);
            
            const response = await mapViewApi.getNetworkLog({ session_id: sessionId });
            
            let rawData = [];
            if (Array.isArray(response)) {
              rawData = response;
            } else if (response?.data) {
              rawData = Array.isArray(response.data) ? response.data : 
                       Array.isArray(response.data.Data) ? response.data.Data : 
                       [];
            } else if (response?.Data) {
              rawData = Array.isArray(response.Data) ? response.Data : [];
            }
            
            const validPoints = rawData
              .map((log, index) => {
                const lat = parseFloat(log.lat || log.Lat || log.latitude); 
                const lng = parseFloat(log.lon || log.lng || log.Lng || log.longitude);
                const rsrp = parseFloat(log.rsrp || log.RSRP || -120);
                
                return {
                  lat,
                  lng,
                  rsrp,
                  sessionId, // ✅ Track which session this point belongs to
                  id: log.id || `session-${sessionId}-point-${index}`,
                };
              })
              .filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng));

            allValidPoints.push(...validPoints);
            console.log(`✅ Session ${sessionId}: ${validPoints.length} points`);
            
          } catch (err) {
            console.error(`❌ Error fetching session ${sessionId}:`, err);
            errors.push(`Session ${sessionId}: ${err.message}`);
          }
        }

        if (allValidPoints.length === 0) {
          if (errors.length > 0) {
            setError(`Failed to load data:\n${errors.join('\n')}`);
          } else {
            setError('No valid location data found for the selected session(s)');
          }
        } else {
          if (errors.length > 0) {
            toast.warning(`Loaded ${allValidPoints.length} points, but some sessions failed`);
          } else {
            toast.success(`Loaded ${allValidPoints.length} points from ${sessionIds.length} session(s)`);
          }
        }
        
        setLogs(allValidPoints);
        
      } catch (err) {
        console.error("❌ Error fetching logs:", err);
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchAllSessionsData();
  }, [sessionIds]);

  // ✅ Auto-fit map to points
  useEffect(() => {
    if (map && logs.length > 0 && window.google?.maps) {
      const bounds = new window.google.maps.LatLngBounds();
      logs.forEach(pt => bounds.extend({ lat: pt.lat, lng: pt.lng }));
      map.fitBounds(bounds, { padding: 50 });
    }
  }, [map, logs]);

  const onLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const getColorForRSRP = (rsrp) => {
    if (rsrp >= -80) return '#00FF00'; 
    if (rsrp >= -90) return '#FFFF00'; 
    if (rsrp >= -100) return '#FFA500'; 
    if (rsrp >= -110) return '#FF6600'; 
    return '#FF0000'; 
  };

  // ✅ Loading state with progress
  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900">
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-white">
            {loading 
              ? fetchProgress.total > 1 
                ? `Loading session ${fetchProgress.current} of ${fetchProgress.total}...`
                : 'Loading session data...'
              : 'Loading map...'}
          </p>
          {sessionIds.length > 1 && (
            <p className="mt-2 text-gray-400 text-sm">
              {sessionIds.length} sessions selected
            </p>
          )}
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error Loading Maps</h2>
          <p className="text-red-400">{loadError.message}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Error</h2>
          <p className="text-red-400 whitespace-pre-line">{error}</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={logs.length > 0 ? { lat: logs[0].lat, lng: logs[0].lng } : DEFAULT_CENTER}
        zoom={12}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={{
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
        }}
      >
        {logs.map((pt, idx) => (
          <Circle
            key={pt.id || idx}
            center={{ lat: pt.lat, lng: pt.lng }}
            radius={15}
            options={{
              strokeColor: getColorForRSRP(pt.rsrp),
              strokeOpacity: 0.8,
              strokeWeight: 2,
              fillColor: getColorForRSRP(pt.rsrp),
              fillOpacity: 0.5,
              clickable: true,
            }}
          />
        ))}
      </GoogleMap>
      
      
      
      <Button
        onClick={() => navigate(-1)}
        className="absolute bg-white top-3 right-15 z-10"
        variant="secondary"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Sessions
      </Button>
    </div>
  );
};

export default SessionMapDebug;