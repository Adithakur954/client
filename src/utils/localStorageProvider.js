// src/utils/localStorageProvider.js

export const localStorageProvider = () => {
  // Store cache in LocalStorage
  const map = new Map(JSON.parse(localStorage.getItem('swr-cache') || '[]'));

  // Save cache to LocalStorage on every change
  window.addEventListener('beforeunload', () => {
    const appCache = JSON.stringify(Array.from(map.entries()));
    localStorage.setItem('swr-cache', appCache);
  });

  // Periodically save cache (every 30 seconds)
  setInterval(() => {
    const appCache = JSON.stringify(Array.from(map.entries()));
    localStorage.setItem('swr-cache', appCache);
  }, 30000);

  return map;
};