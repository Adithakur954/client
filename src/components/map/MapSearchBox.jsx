import React, { useState } from 'react';
import { StandaloneSearchBox, useGoogleMap } from '@react-google-maps/api';
import { Input } from "@/components/ui/input";

const MapSearchBox = () => {
    const map = useGoogleMap();
    const [searchBox, setSearchBox] = useState(null);

    const onPlacesChanged = () => {
        const places = searchBox.getPlaces();
        const place = places[0];
        if (place && place.geometry && place.geometry.location) {
            const newCenter = {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng(),
            };
            map.panTo(newCenter);
            map.setZoom(15);
        }
    };

    return (
        <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)' }}>
            <StandaloneSearchBox
                onLoad={setSearchBox}
                onPlacesChanged={onPlacesChanged}
            > <PlaceAutocomplete onPlaceSelect={handlePlaceSelect} />
                <Input
                    type="text"
                    placeholder="Search location"
                    className="w-80 bg-white/80"
                />
            </StandaloneSearchBox>
        </div>
    );
};

export default MapSearchBox;