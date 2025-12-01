// src/utils/localStorageProvider.js

const CACHE_KEY = 'swr-cache';
const CACHE_VERSION = 'v1';
const MAX_CACHE_SIZE = 10 * 1024 * 1024; // 10MB limit
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Enhanced LocalStorage Provider for SWR
 * - Handles errors gracefully
 * - Includes cache expiration
 * - Size management
 * - Fallback to memory if localStorage fails
 */
export const localStorageProvider = () => {
  let map = new Map();
  let saveTimeout = null;
  
  // Load cache from localStorage
  const loadCache = () => {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (!stored) return new Map();
      
      const parsed = JSON.parse(stored);
      
      // Check version
      if (parsed.version !== CACHE_VERSION) {
        localStorage.removeItem(CACHE_KEY);
        return new Map();
      }
      
      // Filter expired entries
      const now = Date.now();
      const validEntries = (parsed.data || []).filter(([key, value]) => {
        const timestamp = value?.timestamp || 0;
        return now - timestamp < CACHE_EXPIRY;
      });
      
      return new Map(validEntries);
    } catch (error) {
      console.warn('Failed to load SWR cache:', error);
      return new Map();
    }
  };
  
  // Save cache to localStorage with debounce
  const saveCache = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(() => {
      try {
        const cacheData = {
          version: CACHE_VERSION,
          data: Array.from(map.entries()),
          savedAt: Date.now()
        };
        
        const serialized = JSON.stringify(cacheData);
        
        // Check size before saving
        if (serialized.length > MAX_CACHE_SIZE) {
          pruneCache();
          return saveCache();
        }
        
        localStorage.setItem(CACHE_KEY, serialized);
      } catch (error) {
        if (error.name === 'QuotaExceededError') {
          pruneCache();
          saveCache();
        } else {
          console.warn('Failed to save SWR cache:', error);
        }
      }
    }, 1000); // Debounce 1 second
  };
  
  // Remove oldest entries when cache is too large
  const pruneCache = () => {
    const entries = Array.from(map.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => {
      const timeA = a[1]?.timestamp || 0;
      const timeB = b[1]?.timestamp || 0;
      return timeA - timeB;
    });
    
    // Remove oldest 25%
    const removeCount = Math.ceil(entries.length * 0.25);
    for (let i = 0; i < removeCount; i++) {
      map.delete(entries[i][0]);
    }
  };
  
  // Initialize
  map = loadCache();
  
  // Create proxy to intercept set operations
  const originalSet = map.set.bind(map);
  map.set = (key, value) => {
    // Add timestamp to value
    const wrappedValue = {
      ...value,
      timestamp: Date.now()
    };
    originalSet(key, wrappedValue);
    saveCache();
    return map;
  };
  
  // Save on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (saveTimeout) clearTimeout(saveTimeout);
      
      try {
        const cacheData = {
          version: CACHE_VERSION,
          data: Array.from(map.entries()),
          savedAt: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      } catch {
        // Ignore errors on unload
      }
    });
  }
  
  return map;
};

/**
 * Clear all SWR cache
 */
export const clearSWRCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // Ignore errors
  }
};

/**
 * Get cache stats
 */
export const getCacheStats = () => {
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    if (!stored) return { size: 0, entries: 0 };
    
    const parsed = JSON.parse(stored);
    return {
      size: stored.length,
      sizeFormatted: formatBytes(stored.length),
      entries: parsed.data?.length || 0,
      savedAt: parsed.savedAt ? new Date(parsed.savedAt).toISOString() : null,
      version: parsed.version
    };
  } catch {
    return { size: 0, entries: 0 };
  }
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};