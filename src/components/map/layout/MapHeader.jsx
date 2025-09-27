import React from 'react';
import { Pin } from 'lucide-react';
// 1. Import your new PlaceAutocomplete component
import PlaceAutocomplete from '../PlaceAutocomplete'; // Adjust path if necessary

const MapHeader = ({ map }) => {
    const goToMyLocation = () => {
        if (navigator.geolocation && map) {
            navigator.geolocation.getCurrentPosition(position => {
                const newPos = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                map.panTo(newPos);
                map.setZoom(15);
            });
        }
    };

    // 2. Create a handler function to receive the selected place
    const handlePlaceSelect = (place) => {
        if (!map || !place.geometry?.location) {
            console.error("Invalid place object or map not loaded.");
            return;
        }

        const newCenter = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
        };

        map.panTo(newCenter);
        map.setZoom(15);
    };

    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-full max-w-md  flex items-center space-x-2">
            <div className="flex-grow">
                {/* 3. Replace the old Autocomplete with your new component */}
                <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} />
            </div>
            <button 
                onClick={goToMyLocation}
                className="p-2.5 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
                title="Go to my location"
            >
                <Pin className="h-5 w-5 text-blue-600" />
            </button>
        </div>
    );
};

export default MapHeader;