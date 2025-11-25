// src/hooks/usePersistedFilters.js

import { useState, useEffect } from 'react';

/**
 * Hook to persist chart filters in localStorage
 * @param {string} chartKey - Unique identifier for the chart
 * @param {object} initialFilters - Default filter values
 * @returns {[object, function]} - [filters, setFilters]
 */
export const usePersistedFilters = (chartKey, initialFilters = {}) => {
  const storageKey = `chart_filters_${chartKey}`;
  
  // Initialize from localStorage or use initial values
  const [filters, setFilters] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        console.log(`📥 Loaded filters for ${chartKey}:`, parsed);
        return parsed;
      }
    } catch (error) {
      console.error(`❌ Failed to load filters for ${chartKey}:`, error);
    }
    return initialFilters;
  });

  // Save to localStorage whenever filters change
  useEffect(() => {
    try {
      if (Object.keys(filters).length > 0) {
        localStorage.setItem(storageKey, JSON.stringify(filters));
        console.log(`💾 Saved filters for ${chartKey}:`, filters);
      } else {
        // Remove from localStorage if filters are empty
        localStorage.removeItem(storageKey);
        console.log(`🗑️ Cleared filters for ${chartKey}`);
      }
    } catch (error) {
      console.error(`❌ Failed to save filters for ${chartKey}:`, error);
    }
  }, [filters, storageKey, chartKey]);

  return [filters, setFilters];
};

/**
 * Clear all persisted filters
 */
export const clearAllPersistedFilters = () => {
  const keys = Object.keys(localStorage).filter(key => key.startsWith('chart_filters_'));
  keys.forEach(key => localStorage.removeItem(key));
  console.log(`🗑️ Cleared ${keys.length} persisted filter sets`);
};