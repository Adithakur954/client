// src/hooks/useDashboardData.js
import useSWR, { useSWRConfig } from 'swr';
import { useMemo, useCallback, useRef } from 'react';
import { adminApi } from '../api/apiEndpoints';
import { 
  buildQueryString, 
  groupOperatorSamplesByNetwork, 
  buildRanking,
  canonicalOperatorName,
  toNumber,
  ensureNegative
} from '../utils/dashboardUtils';

// ============================================
// SWR CONFIGURATION
// ============================================
const SWR_CONFIG = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  shouldRetryOnError: false,
  errorRetryCount: 1,
  dedupingInterval: 5000,
  focusThrottleInterval: 30000,
  loadingTimeout: 10000,
  keepPreviousData: true, // ✅ Always keep previous data
  revalidateIfStale: true,
};

const CACHE_TIME = {
  SHORT: 2 * 60 * 1000,
  MEDIUM: 5 * 60 * 1000,
  LONG: 15 * 60 * 1000,
};

const METRIC_ENDPOINT_MAP = {
  rsrp: 'getAvgRsrpV2',
  rsrq: 'getAvgRsrqV2',
  sinr: 'getAvgSinrV2',
  mos: 'getAvgMosV2',
  jitter: 'getAvgJitterV2',
  latency: 'getAvgLatencyV2',
  packetLoss: 'getAvgPacketLossV2',
  dlTpt: 'getAvgDlTptV2',
  ulTpt: 'getAvgUlTptV2',
};

const NEGATIVE_METRICS = ['rsrp', 'rsrq'];

// ============================================
// UTILITY FUNCTIONS
// ============================================
const createCacheKey = (base, filters) => {
  if (!filters || Object.keys(filters).length === 0) return base;
  
  const normalized = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      const value = filters[key];
      if (value === undefined || value === null || value === '') return acc;
      
      if (value instanceof Date) {
        acc[key] = value.toISOString();
      } else if (Array.isArray(value)) {
        acc[key] = value.sort().join(',');
      } else if (typeof value === 'object') {
        acc[key] = JSON.stringify(value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});
  
  return Object.keys(normalized).length > 0 
    ? `${base}::${JSON.stringify(normalized)}` 
    : base;
};

/**
 * Extract data from various API response formats
 */
const extractData = (response, fallback = []) => {
  if (response === null || response === undefined) return fallback;
  
  // Direct array
  if (Array.isArray(response)) return response;
  
  // Response with Status check
  if (response?.Status === 0) return fallback;
  
  // Common wrapper formats
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Result)) return response.Result;
  if (Array.isArray(response?.result)) return response.result;
  
  // Object response (not array)
  if (typeof response === 'object' && !Array.isArray(response)) {
    // Check if it's a data wrapper
    if (response.Data !== undefined) return response.Data;
    if (response.data !== undefined) return response.data;
    
    // Return as-is for objects like totals
    return response;
  }
  
  return fallback;
};

/**
 * Safe API fetch with fallback
 */
const safeFetch = async (apiFn, fallback = []) => {
  try {
    const response = await apiFn();
    const data = extractData(response, fallback);
    return data;
  } catch {
    return fallback;
  }
};

/**
 * Fetch with session storage fallback - ALWAYS returns cached data on error
 */
const fetchWithFallback = async (apiFn, cacheKey, fallback = []) => {
  // ✅ Try to get cached data first
  const cachedData = getCachedData(cacheKey, null);
  
  try {
    const response = await apiFn();
    const data = extractData(response, null);
    
    // ✅ Valid data - cache and return
    if (data !== null && data !== undefined) {
      const isValidArray = Array.isArray(data) && data.length > 0;
      const isValidObject = !Array.isArray(data) && typeof data === 'object' && Object.keys(data).length > 0;
      const isValidNumber = typeof data === 'number';
      
      if (isValidArray || isValidObject || isValidNumber) {
        try {
          sessionStorage.setItem(`cache_${cacheKey}`, JSON.stringify(data));
        } catch {
          // Storage full - ignore
        }
        return data;
      }
    }
    
    // ✅ No valid new data - return cached data if available, otherwise fallback
    return cachedData !== null ? cachedData : fallback;
  } catch {
    // ✅ API error - ALWAYS return cached data if available
    return cachedData !== null ? cachedData : fallback;
  }
};

const getCachedData = (cacheKey, fallback) => {
  try {
    const cached = sessionStorage.getItem(`cache_${cacheKey}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed !== null && parsed !== undefined) {
        return parsed;
      }
    }
  } catch {
    // Parse error - ignore
  }
  return fallback;
};

// ============================================
// DATA PROCESSING FUNCTIONS
// ============================================
const processMetricData = (rawData, metric) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  
  const merged = new Map();
  const isNegative = NEGATIVE_METRICS.includes(metric);
  
  for (const item of rawData) {
    const name = canonicalOperatorName(item?.operatorName || item?.name || item?.operator);
    if (!name || name === 'Unknown') continue;
    
    const value = toNumber(item?.value ?? item?.avg ?? item?.average);
    
    if (!merged.has(name)) {
      merged.set(name, { name, value, count: 1 });
    } else {
      const existing = merged.get(name);
      existing.value = ((existing.value * existing.count) + value) / (existing.count + 1);
      existing.count++;
    }
  }
  
  return Array.from(merged.values())
    .map(({ name, value }) => ({
      name,
      value: isNegative ? ensureNegative(value) : value
    }))
    .sort((a, b) => isNegative ? a.value - b.value : b.value - a.value);
};

const processOperatorMetrics = (rawData, metric) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  
  if (metric === 'samples') {
    return groupOperatorSamplesByNetwork(rawData);
  }
  
  const isNegative = NEGATIVE_METRICS.includes(metric);
  const grouped = {};
  
  rawData.forEach(item => {
    const operatorName = canonicalOperatorName(item?.operatorName || item?.name || item?.operator);
    const network = item?.network || item?.networkType;
    const value = toNumber(item?.value ?? item?.avg);
    
    if (!operatorName || !network || operatorName === 'Unknown') return;
    
    if (!grouped[operatorName]) {
      grouped[operatorName] = { name: operatorName };
    }
    
    grouped[operatorName][network] = isNegative ? ensureNegative(value) : value;
  });
  
  return Object.values(grouped)
    .map(item => {
      const networks = Object.keys(item).filter(k => k !== 'name');
      const total = networks.length > 0 
        ? networks.reduce((sum, net) => sum + (item[net] || 0), 0) / networks.length
        : 0;
      return { ...item, total };
    })
    .sort((a, b) => isNegative ? a.total - b.total : b.total - a.total);
};

const processBandDistribution = (rawData) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  
  const merged = new Map();
  
  for (const item of rawData) {
    // Handle different API response formats
    const bandValue = item?.band ?? item?.Band ?? item?.bandNumber ?? item?.name;
    const band = bandValue !== undefined ? `Band ${bandValue}` : 'Unknown';
    const count = toNumber(item?.count ?? item?.Count ?? item?.samples ?? item?.value ?? 1);
    
    if (band !== 'Unknown') {
      merged.set(band, (merged.get(band) || 0) + count);
    }
  }
  
  return Array.from(merged.entries())
    .map(([name, value]) => ({ name, value }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);
};

/**
 * Process unique list from various data formats
 */
const processUniqueList = (rawData, keyOptions) => {
  if (!rawData) return [];
  
  // If it's already a simple array of strings
  if (Array.isArray(rawData) && rawData.length > 0 && typeof rawData[0] === 'string') {
    return [...new Set(rawData)].filter(Boolean).sort();
  }
  
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  
  const unique = new Set();
  
  rawData.forEach(item => {
    if (!item) return;
    
    let value;
    
    if (typeof item === 'string') {
      value = item;
    } else if (typeof item === 'object') {
      // Try each key option
      for (const key of keyOptions) {
        if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
          value = item[key];
          break;
        }
      }
    }
    
    if (value && value !== 'Unknown' && value !== 'unknown') {
      unique.add(String(value).trim());
    }
  });
  
  return Array.from(unique).sort();
};

// ============================================
// HOOKS: BASIC DATA
// ============================================
export const useTotals = () => {
  return useSWR(
    'totals',
    async () => {
      const data = await fetchWithFallback(
        () => adminApi.getTotalsV2?.(), 
        'totals', 
        {}
      );
      return data;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT, 
      refreshInterval: 60000,
      fallbackData: {}
    }
  );
};

export const useMonthlySamples = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('monthlySamples', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      return fetchWithFallback(
        () => adminApi.getMonthlySamplesV2?.(query), 
        cacheKey, 
        []
      );
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

export const useOperatorSamples = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('operatorSamples', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      const data = await fetchWithFallback(
        () => adminApi.getOperatorSamplesV2?.(query), 
        cacheKey, 
        []
      );
      return groupOperatorSamplesByNetwork(data);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: [] }
  );
};

export const useNetworkDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('networkDist', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      return fetchWithFallback(
        () => adminApi.getNetworkTypeDistributionV2?.(query), 
        cacheKey, 
        []
      );
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

// ============================================
// HOOKS: METRICS
// ============================================
export const useMetricData = (metric, filters) => {
  const cacheKey = useMemo(() => createCacheKey(`metric_${metric}`, filters), [metric, filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const endpoint = METRIC_ENDPOINT_MAP[metric];
      if (!endpoint || !adminApi[endpoint]) return [];
      
      const query = buildQueryString(filters);
      const rawData = await fetchWithFallback(
        () => adminApi[endpoint](query), 
        cacheKey, 
        []
      );
      return processMetricData(rawData, metric);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: [] }
  );
};

export const useOperatorMetrics = (metric, filters) => {
  const cacheKey = useMemo(() => createCacheKey(`opMetric_${metric}`, filters), [metric, filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const endpointMap = { samples: 'getOperatorSamplesV2', ...METRIC_ENDPOINT_MAP };
      const endpoint = endpointMap[metric];
      if (!endpoint || !adminApi[endpoint]) return [];
      
      const query = buildQueryString(filters);
      const rawData = await fetchWithFallback(
        () => adminApi[endpoint](query), 
        cacheKey, 
        []
      );
      return processOperatorMetrics(rawData, metric);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: [] }
  );
};

// ============================================
// HOOKS: BAND DISTRIBUTION
// ============================================
export const useBandDistributionRaw = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('bandDistRaw', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      return fetchWithFallback(
        () => adminApi.getBandDistributionV2?.(query), 
        cacheKey, 
        []
      );
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

export const useBandDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('bandDist', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      const rawData = await fetchWithFallback(
        () => adminApi.getBandDistributionV2?.(query), 
        cacheKey, 
        []
      );
      return processBandDistribution(rawData);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

// ============================================
// HOOKS: BAND COUNT (Separate hook for KPI)
// ============================================
export const useBandCount = () => {
  return useSWR(
    'bandCount',
    async () => {
      const rawData = await fetchWithFallback(
        () => adminApi.getBandDistributionV2?.(''), 
        'bandCount', 
        []
      );
      
      if (!Array.isArray(rawData) || rawData.length === 0) return 0;
      
      // Get unique band numbers
      const uniqueBands = new Set();
      rawData.forEach(item => {
        const band = item?.band ?? item?.Band ?? item?.bandNumber;
        if (band !== undefined && band !== null) {
          uniqueBands.add(band);
        }
      });
      
      return uniqueBands.size;
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: 0 }
  );
};

// ============================================
// HOOKS: INDOOR/OUTDOOR COUNTS
// ============================================
export const useIndoorCount = (filters = {}) => {
  const cacheKey = useMemo(() => createCacheKey('indoorCount', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      const resp = await fetchWithFallback(
        () => adminApi.getIndoorCount?.(query), 
        cacheKey, 
        {}
      );
      
      // Handle different response formats
      if (typeof resp === 'number') return resp;
      if (resp?.Status === 0) return 0;
      
      return Number(resp?.Count ?? resp?.count ?? resp?.total ?? resp?.data ?? 0);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: 0 }
  );
};

export const useOutdoorCount = (filters = {}) => {
  const cacheKey = useMemo(() => createCacheKey('outdoorCount', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      const resp = await fetchWithFallback(
        () => adminApi.getOutdoorCount?.(query), 
        cacheKey, 
        {}
      );
      
      // Handle different response formats
      if (typeof resp === 'number') return resp;
      if (resp?.Status === 0) return 0;
      
      return Number(resp?.Count ?? resp?.count ?? resp?.total ?? resp?.data ?? 0);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: 0 }
  );
};

// ============================================
// HOOKS: RANKINGS
// ============================================
export const useCoverageRanking = (rsrpMin = -95, rsrpMax = 0) => {
  const cacheKey = useMemo(
    () => createCacheKey('coverageRank', { min: rsrpMin, max: rsrpMax }), 
    [rsrpMin, rsrpMax]
  );
  
  return useSWR(
    cacheKey,
    async () => {
      const payload = await fetchWithFallback(
        () => adminApi.getOperatorCoverageRanking({ min: rsrpMin, max: rsrpMax }),
        cacheKey,
        []
      );
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

export const useQualityRanking = (rsrqMin = -10, rsrqMax = 0) => {
  const cacheKey = useMemo(
    () => createCacheKey('qualityRank', { min: rsrqMin, max: rsrqMax }), 
    [rsrqMin, rsrqMax]
  );
  
  return useSWR(
    cacheKey,
    async () => {
      const payload = await fetchWithFallback(
        () => adminApi.getOperatorQualityRanking({ min: rsrqMin, max: rsrqMax }),
        cacheKey,
        []
      );
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

// ============================================
// HOOKS: HANDSET
// ============================================
export const useHandsetPerformance = () => {
  return useSWR(
    'handsetAvg',
    async () => {
      const resp = await fetchWithFallback(
        () => adminApi.getDashboardGraphData(), 
        'handsetAvg', 
        {}
      );
      
      const rawData = resp?.handsetWiseAvg_bar || resp?.HandsetWiseAvg_bar || [];
      
      if (!Array.isArray(rawData) || rawData.length === 0) return [];
      
      return rawData.map(item => ({
        Make: item?.Make || item?.make || 'Unknown',
        Avg: ensureNegative(toNumber(item?.Avg || item?.avg || 0)),
        Samples: toNumber(item?.Samples || item?.samples || 0)
      }));
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

export const useHandsetDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('handsetDist', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      return fetchWithFallback(
        () => adminApi.getHandsetDistributionV2?.(query), 
        cacheKey, 
        []
      );
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

// ============================================
// HOOKS: OPERATORS & NETWORKS
// ============================================
export const useOperatorsAndNetworks = () => {
  // Fetch operators
  const { 
    data: rawOperators = [], 
    isLoading: operatorsLoading, 
    error: operatorsError 
  } = useSWR(
    'operators',
    async () => {
      const data = await fetchWithFallback(
        () => adminApi.getOperatorsV2?.(), 
        'operators', 
        []
      );
      return data;
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.LONG, fallbackData: [] }
  );

  // Fetch networks
  const { 
    data: rawNetworks = [], 
    isLoading: networksLoading, 
    error: networksError 
  } = useSWR(
    'networks',
    async () => {
      const data = await fetchWithFallback(
        () => adminApi.getNetworksV2?.(), 
        'networks', 
        []
      );
      return data;
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.LONG, fallbackData: [] }
  );

  // Process operators
  const operators = useMemo(() => {
    if (!rawOperators || (Array.isArray(rawOperators) && rawOperators.length === 0)) {
      return [];
    }
    
    const operatorKeys = [
      'operatorName', 'OperatorName', 
      'operator', 'Operator',
      'name', 'Name',
      'carrier', 'Carrier'
    ];
    
    const list = processUniqueList(rawOperators, operatorKeys);
    
    return list
      .map(op => canonicalOperatorName(op))
      .filter(op => op && op !== 'Unknown' && op !== 'unknown');
  }, [rawOperators]);

  // Process networks
  const networks = useMemo(() => {
    if (!rawNetworks || (Array.isArray(rawNetworks) && rawNetworks.length === 0)) {
      return [];
    }
    
    const networkKeys = [
      'network', 'Network',
      'networkType', 'NetworkType',
      'type', 'Type',
      'name', 'Name'
    ];
    
    return processUniqueList(rawNetworks, networkKeys);
  }, [rawNetworks]);

  return { 
    operators, 
    networks, 
    operatorCount: operators.length,
    networkCount: networks.length,
    isLoading: operatorsLoading || networksLoading,
    error: operatorsError || networksError
  };
};

// ============================================
// HOOKS: PARALLEL DATA FETCHING
// ============================================
export const useDashboardDataParallel = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('dashboardAll', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const query = buildQueryString(filters);
      
      const [
        totals,
        operatorSamples,
        networkDist,
        monthlySamples,
        rsrpData,
        rsrqData,
        sinrData,
        bandDist,
      ] = await Promise.all([
        fetchWithFallback(() => adminApi.getTotalsV2?.(), 'totals', {}),
        fetchWithFallback(() => adminApi.getOperatorSamplesV2?.(query), 'operatorSamples', []),
        fetchWithFallback(() => adminApi.getNetworkTypeDistributionV2?.(query), 'networkDist', []),
        fetchWithFallback(() => adminApi.getMonthlySamplesV2?.(query), 'monthlySamples', []),
        fetchWithFallback(() => adminApi.getAvgRsrpV2?.(query), 'rsrp', []),
        fetchWithFallback(() => adminApi.getAvgRsrqV2?.(query), 'rsrq', []),
        fetchWithFallback(() => adminApi.getAvgSinrV2?.(query), 'sinr', []),
        fetchWithFallback(() => adminApi.getBandDistributionV2?.(query), 'bandDist', []),
      ]);
      
      return {
        totals,
        monthlySamples,
        operatorSamples: groupOperatorSamplesByNetwork(operatorSamples),
        networkDist,
        rsrp: processMetricData(rsrpData, 'rsrp'),
        rsrq: processMetricData(rsrqData, 'rsrq'),
        sinr: processMetricData(sinrData, 'sinr'),
        bandDist: processBandDistribution(bandDist),
      };
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      fallbackData: {
        totals: {},
        monthlySamples: [],
        operatorSamples: [],
        networkDist: [],
        rsrp: [],
        rsrq: [],
        sinr: [],
        bandDist: [],
      }
    }
  );
};

export const useParallelMetrics = (metrics = [], filters) => {
  const cacheKey = useMemo(
    () => createCacheKey(`parallel_${[...metrics].sort().join('_')}`, filters),
    [metrics, filters]
  );
  
  return useSWR(
    cacheKey,
    async () => {
      if (!Array.isArray(metrics) || metrics.length === 0) return {};
      
      const query = buildQueryString(filters);
      
      const results = await Promise.all(
        metrics.map(async (metric) => {
          const endpoint = METRIC_ENDPOINT_MAP[metric];
          if (!endpoint || !adminApi[endpoint]) return [metric, []];
          
          const rawData = await fetchWithFallback(
            () => adminApi[endpoint](query), 
            `metric_${metric}`, 
            []
          );
          return [metric, processMetricData(rawData, metric)];
        })
      );
      
      return Object.fromEntries(results);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: {} }
  );
};

// ============================================
// HOOKS: APP DATA
// ============================================
export const useAppData = () => {
  return useSWR(
    'appData',
    async () => {
      const rawData = await fetchWithFallback(
        () => adminApi.getAppValue(), 
        'appData', 
        []
      );
      
      if (!Array.isArray(rawData) || rawData.length === 0) return [];
      
      return rawData.map(item => ({
        appName: item?.appName || item?.AppName || 'Unknown',
        avgDlTptMbps: toNumber(item?.avgDlTptMbps || item?.AvgDlTptMbps),
        avgUlTptMbps: toNumber(item?.avgUlTptMbps || item?.AvgUlTptMbps),
        avgMos: toNumber(item?.avgMos || item?.AvgMos),
        sampleCount: toNumber(item?.sampleCount || item?.SampleCount),
        avgRsrp: toNumber(item?.avgRsrp || item?.AvgRsrp),
        avgRsrq: toNumber(item?.avgRsrq || item?.AvgRsrq),
        avgSinr: toNumber(item?.avgSinr || item?.AvgSinr),
        avgDuration: toNumber(item?.durationMinutes || item?.DurationMinutes) / 60,
      }));
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

// ============================================
// CACHE MANAGEMENT
// ============================================
export const usePrefetchDashboard = (filters) => {
  const prefetchRef = useRef(false);
  
  return useCallback(() => {
    if (prefetchRef.current) return;
    
    const query = buildQueryString(filters);
    
    Promise.allSettled([
      adminApi.getTotalsV2?.(),
      adminApi.getOperatorsV2?.(),
      adminApi.getNetworksV2?.(),
      adminApi.getOperatorSamplesV2?.(query),
    ]).finally(() => {
      prefetchRef.current = true;
    });
  }, [filters]);
};

export const useClearDashboardCache = () => {
  const { cache, mutate } = useSWRConfig();
  
  return useCallback(() => {
    // Clear SWR cache
    if (cache instanceof Map) {
      cache.clear();
    }
    
    // Clear session storage cache
    const keysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('cache_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key));
    
    // Revalidate all
    mutate(() => true, undefined, { revalidate: true });
  }, [cache, mutate]);
};

export const useRefreshDashboard = () => {
  const { mutate } = useSWRConfig();
  
  return useCallback(() => {
    mutate(() => true, undefined, { revalidate: true });
  }, [mutate]);
};

// ============================================
// EXPORTS
// ============================================
export { SWR_CONFIG, CACHE_TIME };