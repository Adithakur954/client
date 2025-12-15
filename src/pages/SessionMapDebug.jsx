// src/pages/SessionMapDebug.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { GoogleMap, useJsApiLoader, Circle } from '@react-google-maps/api';
import { mapViewApi } from '../api/apiEndpoints';
import Spinner from '../components/common/Spinner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
// 1. IMPORT THE SHARED OPTIONS
import { GOOGLE_MAPS_LOADER_OPTIONS } from '@/lib/googleMapsLoader'; 

// Explicit container style
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

  const sessionId = searchParams.get('sessionId');

  // 3. USE THE IMPORTED SHARED OPTIONS
  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  // ✅ Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        console.log("📡 Fetching logs for session:", sessionId);
        
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
            const lat = parseFloat(log.lat || log.Lat || log.latitude); //yeh madagasar ke liye hai 
            const lng = parseFloat(log.lon || log.lng || log.Lng || log.longitude);
            const rsrp = parseFloat(log.rsrp || log.RSRP || -120);
            
            return {
              lat,
              lng,
              rsrp,
              id: log.id || `point-${index}`,
            };
          })
          .filter(pt => !isNaN(pt.lat) && !isNaN(pt.lng));

        if (validPoints.length === 0) {
          setError('No valid location data found for this session');
        }
        
        setLogs(validPoints);
        
      } catch (err) {
        console.error("❌ Error fetching logs:", err);
        setError(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [sessionId]);

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

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-gray-900">
        <div className="text-center">
          <Spinner />
          <p className="mt-4 text-white">
            {loading ? 'Loading session data...' : 'Loading map...'}
          </p>
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
          <p className="text-red-400">{error}</p>
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