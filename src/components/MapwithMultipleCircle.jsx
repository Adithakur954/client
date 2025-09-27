import React, { useCallback, useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader, Circle, InfoWindow } from '@react-google-maps/api'; // Import InfoWindow

const mapContainerStyle = { height: "100%", width: "100%" };
const LIBRARIES = ["places"];


const MapWithMultipleCircles = ({ locations, onMarkerClick, activeMarkerIndex }) => {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  const [map, setMap] = useState(null);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  useEffect(() => {
    if (map && locations && locations.length > 0) {
      const bounds = new window.google.maps.LatLngBounds();
      locations.forEach(loc => {
        bounds.extend(new window.google.maps.LatLng(loc.lat, loc.lng));
      });
      map.fitBounds(bounds);

      const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
        if (map.getZoom() > 17) map.setZoom(17);
      });
      return () => {
        window.google.maps.event.removeListener(listener);
      }
    }
  }, [map, locations]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return <div className="flex h-full w-full items-center justify-center">Loading Map...</div>;
  
  // --- NEW: Helper to format the timestamp for display ---
  const formatInfoTime = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleTimeString();
  };

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      zoom={8}
      onLoad={onMapLoad}
      // --- NEW: When clicking the map, close any open InfoWindow ---
      onClick={() => onMarkerClick(null)} 
    >
      {locations.map((location, index) => (
        <React.Fragment key={`marker-wrapper-${index}`}>
          <Circle
            center={{ lat: location.lat, lng: location.lng }}
            // --- NEW: Added onClick handler ---
            onClick={() => onMarkerClick(index)} 
            options={{
              strokeWeight: 0,
              fillColor: location.color || '#FF0000',
              fillOpacity: 0.7,
              radius: location.radius || 30,
            }}
          />
          {/* --- NEW: Conditionally render InfoWindow if this marker is active --- */}
          {activeMarkerIndex === index && (
            <InfoWindow
              position={{ lat: location.lat, lng: location.lng }}
              onCloseClick={() => onMarkerClick(null)} // Handler to close the window
            >
              <div style={{ padding: '5px' }}>
                <h4 style={{ fontWeight: 'bold', marginBottom: '5px' }}>Point Info</h4>
                <p><strong>Time:</strong> {formatInfoTime(location.timestamp)}</p>
                <p><strong>RSRP:</strong> {location.rsrp || 'N/A'}</p>
                <p><strong>RSRQ:</strong> {location.rsrq || 'N/A'}</p>
                <p><strong>SINR:</strong> {location.sinr || 'N/A'}</p>
              </div>
            </InfoWindow>
          )}
        </React.Fragment>
      ))}
    </GoogleMap>
  );
};

export default MapWithMultipleCircles;