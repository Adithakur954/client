// src/lib/googleMapsLoader.js
// Works with Vite (VITE_GOOGLE_MAPS_API_KEY) or CRA (REACT_APP_GOOGLE_MAPS_API_KEY)
const apiKey =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    import.meta.env.VITE_GOOGLE_MAPS_API_KEY) ||
  process.env.REACT_APP_GOOGLE_MAPS_API_KEY ||
  '';

export const GOOGLE_MAPS_LOADER_OPTIONS = {
  id: 'google-map-script',
  googleMapsApiKey: apiKey,
  libraries: ['places', 'geometry', 'visualization'],
};