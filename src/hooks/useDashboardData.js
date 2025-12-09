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
// SWR CONFIGURATION (Single Source of Truth)
// ============================================
const SWR_CONFIG = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  shouldRetryOnError: true,        // ✅ Let SWR handle retries
  errorRetryCount: 2,              // ✅ Reasonable retry count
  errorRetryInterval: 3000,        // ✅ Wait before retry
  dedupingInterval: 5000,
  focusThrottleInterval: 30000,
  loadingTimeout: 10000,
  keepPreviousData: true,
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
// UTILITY FUNCTIONS (Simplified)
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
 * ✅ SIMPLIFIED: Extract data from various API response formats
 * No more manual caching - let SWR handle it
 */
const extractData = (response, fallback = []) => {
  if (response === null || response === undefined) return fallback;
  
  if (Array.isArray(response)) return response;
  
  if (response?.Status === 0) return fallback;
  
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Result)) return response.Result;
  if (Array.isArray(response?.result)) return response.result;
  
  if (typeof response === 'object' && !Array.isArray(response)) {
    if (response.Data !== undefined) return response.Data;
    if (response.data !== undefined) return response.data;
    return response;
  }
  
  return fallback;
};

/**
 * ✅ SIMPLIFIED: Standard fetcher that throws on error
 * SWR will handle error states and caching
 */
const createFetcher = (apiFn, fallback = []) => {
  return async () => {
    try {
      const response = await apiFn();
      const data = extractData(response, fallback);
      
      // Return valid data or fallback
      if (data !== null && data !== undefined) {
        const isValidArray = Array.isArray(data) && data.length > 0;
        const isValidObject = !Array.isArray(data) && typeof data === 'object' && Object.keys(data).length > 0;
        const isValidNumber = typeof data === 'number';
        
        if (isValidArray || isValidObject || isValidNumber) {
          return data;
        }
      }
      
      return fallback;
    } catch (error) {
      // ✅ Throw error so SWR can handle it properly
      // SWR's keepPreviousData will show old data while error state is active
      throw error;
    }
  };
};

// ============================================
// DATA PROCESSING FUNCTIONS (Unchanged)
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

const processUniqueList = (rawData, keyOptions) => {
  if (!rawData) return [];
  
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
// ✅ HOOKS: BASIC DATA (Using simplified fetcher)
// ============================================
export const useTotals = () => {
  return useSWR(
    'totals',
    createFetcher(() => adminApi.getTotalsV2?.(), {}),
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
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  return useSWR(
    cacheKey,
    createFetcher(() => adminApi.getMonthlySamplesV2?.(query), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

export const useOperatorSamples = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('operatorSamples', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    createFetcher(() => adminApi.getOperatorSamplesV2?.(query), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: [] }
  );
  
  // ✅ Memoize the processing
  const processedData = useMemo(
    () => groupOperatorSamplesByNetwork(rawData || []),
    [rawData]
  );
  
  return { data: processedData, ...rest };
};

export const useNetworkDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('networkDist', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  return useSWR(
    cacheKey,
    createFetcher(() => adminApi.getNetworkTypeDistributionV2?.(query), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

// ============================================
// ✅ HOOKS: METRICS (With memoized processing)
// ============================================
export const useMetricData = (metric, filters) => {
  const cacheKey = useMemo(() => createCacheKey(`metric_${metric}`, filters), [metric, filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    async () => {
      const endpoint = METRIC_ENDPOINT_MAP[metric];
      if (!endpoint || !adminApi[endpoint]) return [];
      
      const response = await adminApi[endpoint](query);
      return extractData(response, []);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: [] }
  );
  
  // ✅ Memoize processing to prevent re-computation
  const processedData = useMemo(
    () => processMetricData(rawData || [], metric),
    [rawData, metric]
  );
  
  return { data: processedData, ...rest };
};

export const useOperatorMetrics = (metric, filters) => {
  const cacheKey = useMemo(() => createCacheKey(`opMetric_${metric}`, filters), [metric, filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    async () => {
      const endpointMap = { samples: 'getOperatorSamplesV2', ...METRIC_ENDPOINT_MAP };
      const endpoint = endpointMap[metric];
      if (!endpoint || !adminApi[endpoint]) return [];
      
      const response = await adminApi[endpoint](query);
      return extractData(response, []);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: [] }
  );
  
  // ✅ Memoize processing
  const processedData = useMemo(
    () => processOperatorMetrics(rawData || [], metric),
    [rawData, metric]
  );
  
  return { data: processedData, ...rest };
};

// ============================================
// ✅ HOOKS: BAND DISTRIBUTION
// ============================================
export const useBandDistributionRaw = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('bandDistRaw', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  return useSWR(
    cacheKey,
    createFetcher(() => adminApi.getBandDistributionV2?.(query), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

export const useBandDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('bandDist', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    createFetcher(() => adminApi.getBandDistributionV2?.(query), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
  
  // ✅ Memoize processing
  const processedData = useMemo(
    () => processBandDistribution(rawData || []),
    [rawData]
  );
  
  return { data: processedData, ...rest };
};

export const useBandCount = () => {
  const { data: rawData, ...rest } = useSWR(
    'bandCount',
    createFetcher(() => adminApi.getBandDistributionV2?.(''), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
  
  // ✅ Memoize count calculation
  const count = useMemo(() => {
    if (!Array.isArray(rawData) || rawData.length === 0) return 0;
    
    const uniqueBands = new Set();
    rawData.forEach(item => {
      const band = item?.band ?? item?.Band ?? item?.bandNumber;
      if (band !== undefined && band !== null) {
        uniqueBands.add(band);
      }
    });
    
    return uniqueBands.size;
  }, [rawData]);
  
  return { data: count, ...rest };
};

// ============================================
// ✅ HOOKS: INDOOR/OUTDOOR COUNTS
// ============================================
export const useIndoorCount = (filters = {}) => {
  const cacheKey = useMemo(() => createCacheKey('indoorCount', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const response = await adminApi.getIndoorCount?.(query);
      const resp = extractData(response, {});
      
      if (typeof resp === 'number') return resp;
      if (resp?.Status === 0) return 0;
      
      return Number(resp?.Count ?? resp?.count ?? resp?.total ?? resp?.data ?? 0);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: 0 }
  );
};

export const useOutdoorCount = (filters = {}) => {
  const cacheKey = useMemo(() => createCacheKey('outdoorCount', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const response = await adminApi.getOutdoorCount?.(query);
      const resp = extractData(response, {});
      
      if (typeof resp === 'number') return resp;
      if (resp?.Status === 0) return 0;
      
      return Number(resp?.Count ?? resp?.count ?? resp?.total ?? resp?.data ?? 0);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: 0 }
  );
};

// ============================================
// ✅ HOOKS: RANKINGS
// ============================================
export const useCoverageRanking = (rsrpMin = -95, rsrpMax = 0) => {
  const cacheKey = useMemo(
    () => createCacheKey('coverageRank', { min: rsrpMin, max: rsrpMax }), 
    [rsrpMin, rsrpMax]
  );
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    createFetcher(
      () => adminApi.getOperatorCoverageRanking({ min: rsrpMin, max: rsrpMax }),
      []
    ),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
  
  // ✅ Memoize ranking
  const ranking = useMemo(
    () => buildRanking(rawData || [], { nameKey: 'name', countKey: 'count' }),
    [rawData]
  );
  
  return { data: ranking, ...rest };
};

export const useQualityRanking = (rsrqMin = -10, rsrqMax = 0) => {
  const cacheKey = useMemo(
    () => createCacheKey('qualityRank', { min: rsrqMin, max: rsrqMax }), 
    [rsrqMin, rsrqMax]
  );
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    createFetcher(
      () => adminApi.getOperatorQualityRanking({ min: rsrqMin, max: rsrqMax }),
      []
    ),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
  
  // ✅ Memoize ranking
  const ranking = useMemo(
    () => buildRanking(rawData || [], { nameKey: 'name', countKey: 'count' }),
    [rawData]
  );
  
  return { data: ranking, ...rest };
};

// ============================================
// ✅ HOOKS: HANDSET
// ============================================
// In src/hooks/useDashboardData.js

// ✅ Make sure this hook is configured correctly
// src/hooks/useDashboardData.js

export const useHandsetPerformance = () => {
  const { data: rawData, ...rest } = useSWR(
    'handsetAvg',
    async () => {
      console.log('🔄 Fetching handset performance data...');
      const startTime = performance.now();
      
      try {
        const response = await adminApi.getHandsetDistributionV2();
        const endTime = performance.now();
        console.log(`✅ Handset data fetched in ${(endTime - startTime).toFixed(2)}ms`);
        console.log('Raw response:', response);
        
        // ✅ extractData will return the Data array
        return extractData(response, []);
      } catch (error) {
        console.error('❌ Handset fetch failed:', error);
        throw error;
      }
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      revalidateOnMount: true,
      fallbackData: [] 
    }
  );
  
  // ✅ FIXED: Map new API fields to expected component fields
  const processedData = useMemo(() => {
    console.log('📊 useHandsetPerformance processing:', rawData);
    
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      console.log('⚠️ No handset data to process');
      return [];
    }

    const processed = rawData.map(item => ({
      // ✅ Map new field names to component-expected names
      Make: item?.name || 'Unknown',
      Avg: ensureNegative(toNumber(item?.avg_rsrp || 0)),
      Samples: toNumber(item?.value || 0),
      // ✅ Include additional metrics for tooltips/future use
      AvgRsrq: toNumber(item?.avg_rsrq || 0),
      AvgSinr: toNumber(item?.avg_sinr || 0),
    }));

    console.log(`✅ Processed ${processed.length} handset records:`, processed.slice(0, 2));
    return processed;
  }, [rawData]);
  
  return { data: processedData, ...rest };
};

export const useHandsetDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('handsetDist', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  return useSWR(
    cacheKey,
    createFetcher(() => adminApi.getHandsetDistributionV2?.(query), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
};

// ============================================
// ✅ HOOKS: OPERATORS & NETWORKS
// ============================================
export const useOperatorsAndNetworks = () => {
  const { 
    data: rawOperators = [], 
    isLoading: operatorsLoading, 
    error: operatorsError 
  } = useSWR(
    'operators',
    createFetcher(() => adminApi.getOperatorsV2?.(), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.LONG, fallbackData: [] }
  );

  const { 
    data: rawNetworks = [], 
    isLoading: networksLoading, 
    error: networksError 
  } = useSWR(
    'networks',
    createFetcher(() => adminApi.getNetworksV2?.(), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.LONG, fallbackData: [] }
  );

  // ✅ Memoize operators processing
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

  // ✅ Memoize networks processing
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
// ✅ HOOKS: PARALLEL DATA FETCHING
// ============================================
export const useDashboardDataParallel = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('dashboardAll', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    async () => {
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
        adminApi.getTotalsV2?.().then(r => extractData(r, {})).catch(() => ({})),
        adminApi.getOperatorSamplesV2?.(query).then(r => extractData(r, [])).catch(() => []),
        adminApi.getNetworkTypeDistributionV2?.(query).then(r => extractData(r, [])).catch(() => []),
        adminApi.getMonthlySamplesV2?.(query).then(r => extractData(r, [])).catch(() => []),
        adminApi.getAvgRsrpV2?.(query).then(r => extractData(r, [])).catch(() => []),
        adminApi.getAvgRsrqV2?.(query).then(r => extractData(r, [])).catch(() => []),
        adminApi.getAvgSinrV2?.(query).then(r => extractData(r, [])).catch(() => []),
        adminApi.getBandDistributionV2?.(query).then(r => extractData(r, [])).catch(() => []),
      ]);
      
      return {
        totals,
        monthlySamples,
        operatorSamples,
        networkDist,
        rsrpData,
        rsrqData,
        sinrData,
        bandDist,
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
        rsrpData: [],
        rsrqData: [],
        sinrData: [],
        bandDist: [],
      }
    }
  );

  // ✅ Memoize all processing
  const processedData = useMemo(() => ({
    totals: rawData?.totals || {},
    monthlySamples: rawData?.monthlySamples || [],
    operatorSamples: groupOperatorSamplesByNetwork(rawData?.operatorSamples || []),
    networkDist: rawData?.networkDist || [],
    rsrp: processMetricData(rawData?.rsrpData || [], 'rsrp'),
    rsrq: processMetricData(rawData?.rsrqData || [], 'rsrq'),
    sinr: processMetricData(rawData?.sinrData || [], 'sinr'),
    bandDist: processBandDistribution(rawData?.bandDist || []),
  }), [rawData]);
  
  return { data: processedData, ...rest };
};

export const useParallelMetrics = (metrics = [], filters) => {
  const cacheKey = useMemo(
    () => createCacheKey(`parallel_${[...metrics].sort().join('_')}`, filters),
    [metrics, filters]
  );
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  const { data: rawData, ...rest } = useSWR(
    metrics.length > 0 ? cacheKey : null, // ✅ Conditional fetching
    async () => {
      const results = await Promise.all(
        metrics.map(async (metric) => {
          const endpoint = METRIC_ENDPOINT_MAP[metric];
          if (!endpoint || !adminApi[endpoint]) return [metric, []];
          
          try {
            const response = await adminApi[endpoint](query);
            return [metric, extractData(response, [])];
          } catch {
            return [metric, []];
          }
        })
      );
      
      return Object.fromEntries(results);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT, fallbackData: {} }
  );

  // ✅ Memoize processing for each metric
  const processedData = useMemo(() => {
    if (!rawData || Object.keys(rawData).length === 0) return {};
    
    const result = {};
    for (const [metric, data] of Object.entries(rawData)) {
      result[metric] = processMetricData(data, metric);
    }
    return result;
  }, [rawData]);
  
  return { data: processedData, ...rest };
};

// ============================================
// ✅ HOOKS: APP DATA
// ============================================
export const useAppData = () => {
  const { data: rawData, ...rest } = useSWR(
    'appData',
    createFetcher(() => adminApi.getAppValue(), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM, fallbackData: [] }
  );
  
  // ✅ Memoize processing
  const processedData = useMemo(() => {
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
  }, [rawData]);
  
  return { data: processedData, ...rest };
};

// ============================================
// ✅ CACHE MANAGEMENT (Simplified)
// ============================================
export const usePrefetchDashboard = (filters) => {
  const prefetchRef = useRef(false);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  return useCallback(() => {
    if (prefetchRef.current) return;
    
    Promise.allSettled([
      adminApi.getTotalsV2?.(),
      adminApi.getOperatorsV2?.(),
      adminApi.getNetworksV2?.(),
      adminApi.getOperatorSamplesV2?.(query),
    ]).finally(() => {
      prefetchRef.current = true;
    });
  }, [query]);
};

/**
 * ✅ Clear only SWR cache - no more sessionStorage to clear
 */
export const useClearDashboardCache = () => {
  const { cache, mutate } = useSWRConfig();
  
  return useCallback(() => {
    // Clear SWR cache
    if (cache instanceof Map) {
      cache.clear();
    }
    
    // Revalidate all
    mutate(() => true, undefined, { revalidate: true });
  }, [cache, mutate]);
};

/**
 * ✅ Soft refresh - revalidate without clearing cache
 */
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