// src/hooks/useNeighborCollisions.js (enhanced version)

import { useState, useEffect, useCallback, useRef } from 'react';
import { mapViewApi } from '../api/apiEndpoints';
import { detectPCICollisions } from '../utils/pciCollisionUtils';
import { toast } from 'react-toastify';

export function useNeighborCollisions({ 
  sessionIds, 
  enabled = false,
  selectedMetric = 'rsrp',
  cacheTimeout = 5 * 60 * 1000 // 5 minutes
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    collisions: [],
    allNeighbors: [],
    stats: { total: 0, collisions: 0, uniquePCIs: 0 }
  });
  const [error, setError] = useState(null);
  
  // Cache management
  const cache = useRef(new Map());
  const lastFetchKey = useRef(null);

  const getCacheKey = useCallback((ids) => {
    return ids ? [...ids].sort().join('-') : '';
  }, []);

  const fetchNeighborData = useCallback(async () => {
    if (!enabled || !sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      console.log('⏭️ Skipping neighbor fetch:', { enabled, sessionIds });
      setData({
        collisions: [],
        allNeighbors: [],
        stats: { total: 0, collisions: 0, uniquePCIs: 0 }
      });
      return;
    }

    const cacheKey = getCacheKey(sessionIds);
    
    // Check if we're fetching the same data
    if (cacheKey === lastFetchKey.current && !error) {
      console.log('📌 Same session IDs, skipping duplicate fetch');
      return;
    }

    // Check cache
    const cached = cache.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cacheTimeout) {
      console.log('📦 Using cached data for sessions:', sessionIds);
      setData(cached.data);
      lastFetchKey.current = cacheKey;
      return;
    }

    setLoading(true);
    setError(null);
    lastFetchKey.current = cacheKey;

    try {
      console.log('🔄 Fetching neighbor data for sessions:', sessionIds);
      
      const promises = sessionIds.map(sessionId => 
        mapViewApi.getNeighbours(sessionId)
          .then(result => ({ sessionId, result, success: true }))
          .catch(error => ({ sessionId, error, success: false }))
      );
      
      const results = await Promise.all(promises);
      
      const successfulResults = results
        .filter(r => r.success && r.result)
        .map(r => r.result);
      
      const failedSessions = results
        .filter(r => !r.success)
        .map(r => r.sessionId);
      
      if (failedSessions.length > 0) {
        console.warn('⚠️ Failed sessions:', failedSessions);
      }

      if (successfulResults.length === 0) {
        throw new Error('No successful neighbor data fetched');
      }

      // Merge and process data
      const mergedData = {
        Status: 1,
        sessionId: sessionIds[0],
        primaries: successfulResults.flatMap(r => r?.primaries || []),
      };

      const processed = detectPCICollisions(mergedData, selectedMetric);
      
      // Update cache
      cache.current.set(cacheKey, {
        data: processed,
        timestamp: Date.now()
      });
      
      setData(processed);

      // Notify user
      if (processed.collisions.length > 0) {
        toast.warning(
          `Found ${processed.collisions.length} PCI collision(s)`,
          { 
            autoClose: 3000,
            position: "top-right"
          }
        );
      }

    } catch (err) {
      console.error('❌ Error fetching neighbor data:', err);
      setError(err);
      toast.error(`Failed to fetch neighbor data: ${err.message}`);
      
      setData({
        collisions: [],
        allNeighbors: [],
        stats: { total: 0, collisions: 0, uniquePCIs: 0 }
      });
    } finally {
      setLoading(false);
    }
  }, [sessionIds, enabled, selectedMetric, cacheTimeout, getCacheKey, error]);

  useEffect(() => {
    fetchNeighborData();
  }, [fetchNeighborData]);

  // Clear cache on unmount
  useEffect(() => {
    return () => {
      cache.current.clear();
    };
  }, []);

  return {
    collisions: data.collisions,
    allNeighbors: data.allNeighbors,
    stats: data.stats,
    loading,
    error,
    refetch: fetchNeighborData,
    clearCache: () => {
      cache.current.clear();
      lastFetchKey.current = null;
    }
  };
}