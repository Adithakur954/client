import useSWR from 'swr';
import { useMemo, useCallback } from 'react';
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
// SWR GLOBAL CONFIG
// ============================================
const SWR_CONFIG = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  dedupingInterval: 2000, // Prevent duplicate requests within 2s
  focusThrottleInterval: 5000,
};

const CACHE_TIME = {
  SHORT: 2 * 60 * 1000,   // 2 min
  MEDIUM: 5 * 60 * 1000,  // 5 min
  LONG: 15 * 60 * 1000,   // 15 min
};

// ============================================
// HELPER: Stable Cache Key Generation
// ============================================
const createCacheKey = (base, filters) => {
  if (!filters) return base;
  
  // Sort keys for stable cache key
  const sortedFilters = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
        acc[key] = filters[key];
      }
      return acc;
    }, {});
  
  return Object.keys(sortedFilters).length > 0
    ? [base, JSON.stringify(sortedFilters)]
    : base;
};

// ============================================
// SAFE API WRAPPER with Error Handling
// ============================================
const safeFetch = async (apiFn, fallback = []) => {
  try {
    const resp = await apiFn();
    if (!resp) return fallback;
    
    // Handle different response structures
    return resp?.Data ?? resp?.data ?? resp ?? fallback;
  } catch (error) {
    console.error('API Error:', error);
    return fallback;
  }
};

// ============================================
// DATA PROCESSING UTILITIES
// ============================================
const processMetricData = (rawData, metric) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  
  const merged = new Map();
  
  for (const item of rawData) {
    const op = canonicalOperatorName(item?.operatorName || item?.name);
    if (!op || op === 'Unknown') continue;
    
    const val = toNumber(item?.value);
    
    if (!merged.has(op)) {
      merged.set(op, { name: op, value: val, count: 1 });
    } else {
      const existing = merged.get(op);
      existing.value = ((existing.value * existing.count) + val) / (existing.count + 1);
      existing.count++;
    }
  }
  
  return Array.from(merged.values())
    .map(item => ({
      name: item.name,
      value: ['rsrp', 'rsrq'].includes(metric) ? ensureNegative(item.value) : item.value
    }))
    .sort((a, b) => {
      const isNegative = ['rsrp', 'rsrq'].includes(metric);
      return isNegative ? a.value - b.value : b.value - a.value;
    });
};

const processOperatorMetrics = (rawData, metric) => {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  
  if (metric === 'samples') {
    return groupOperatorSamplesByNetwork(rawData);
  }
  
  const grouped = {};
  
  rawData.forEach(item => {
    const operatorName = canonicalOperatorName(item?.operatorName || item?.name);
    const network = item?.network;
    const value = toNumber(item?.value);
    
    if (!operatorName || !network || operatorName === 'Unknown') return;
    
    if (!grouped[operatorName]) {
      grouped[operatorName] = { name: operatorName };
    }
    
    grouped[operatorName][network] = ['rsrp', 'rsrq'].includes(metric) 
      ? ensureNegative(value) 
      : value;
  });
  
  const result = Object.values(grouped).map(item => {
    const networks = Object.keys(item).filter(k => k !== 'name');
    const total = networks.length > 0 
      ? networks.reduce((sum, net) => sum + (item[net] || 0), 0) / networks.length
      : 0;
    return { ...item, total };
  });
  
  const isNegativeMetric = ['rsrp', 'rsrq'].includes(metric);
  return result.sort((a, b) => 
    isNegativeMetric ? a.total - b.total : b.total - a.total
  );
};

// ============================================
// HOOKS: BASIC DATA
// ============================================

export const useTotals = () => {
  return useSWR(
    'totals',
    () => safeFetch(() => adminApi.getTotalsV2?.(), {}),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT }
  );
};

export const useMonthlySamples = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('monthlySamples', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      return safeFetch(() => adminApi.getMonthlySamplesV2?.(queryString), []);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM }
  );
};

export const useOperatorSamples = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('operatorSamples', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      const data = await safeFetch(() => adminApi.getOperatorSamplesV2?.(queryString), []);
      return groupOperatorSamplesByNetwork(data);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT }
  );
};

export const useNetworkDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('networkDist', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      return safeFetch(() => adminApi.getNetworkTypeDistributionV2?.(queryString), []);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM }
  );
};

// ============================================
// HOOKS: METRICS (Optimized with Memoization)
// ============================================

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

export const useMetricData = (metric, filters) => {
  const cacheKey = useMemo(() => createCacheKey(`metric_${metric}`, filters), [metric, filters]);
  
  const fetcher = useCallback(async () => {
    const endpoint = METRIC_ENDPOINT_MAP[metric];
    if (!endpoint || !adminApi[endpoint]) return [];
    
    const queryString = buildQueryString(filters);
    const rawData = await safeFetch(() => adminApi[endpoint](queryString), []);
    
    return processMetricData(rawData, metric);
  }, [metric, filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT }
  );
};

export const useOperatorMetrics = (metric, filters) => {
  const cacheKey = useMemo(() => createCacheKey(`opMetric_${metric}`, filters), [metric, filters]);
  
  const fetcher = useCallback(async () => {
    const endpointMap = {
      samples: 'getOperatorSamplesV2',
      ...METRIC_ENDPOINT_MAP
    };
    
    const endpoint = endpointMap[metric];
    if (!endpoint || !adminApi[endpoint]) return [];
    
    const queryString = buildQueryString(filters);
    const rawData = await safeFetch(() => adminApi[endpoint](queryString), []);
    
    return processOperatorMetrics(rawData, metric);
  }, [metric, filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT }
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
      const queryString = buildQueryString(filters);
      return safeFetch(() => adminApi.getBandDistributionV2?.(queryString), []);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM }
  );
};

export const useBandDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('bandDist', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      const rawData = await safeFetch(() => adminApi.getBandDistributionV2?.(queryString), []);
      
      if (!Array.isArray(rawData)) return [];
      
      const merged = new Map();
      for (const item of rawData) {
        const band = `Band ${item?.band || ''}`;
        const count = toNumber(item?.count);
        merged.set(band, (merged.get(band) || 0) + count);
      }
      
      return Array.from(merged.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM }
  );
};

// ============================================
// HOOKS: INDOOR/OUTDOOR COUNTS
// ============================================

export const useIndoorCount = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('indoorCount', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await safeFetch(() => adminApi.getIndoorCount?.(queryString), {});
      
      if (resp?.Status === 0) {
        console.error('Indoor count API error:', resp?.Message);
        return 0;
      }
      
      return Number(resp?.Count) || 0;
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT }
  );
};

export const useOutdoorCount = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('outdoorCount', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await safeFetch(() => adminApi.getOutdoorCount?.(queryString), {});
      
      if (resp?.Status === 0) {
        console.error('Outdoor count API error:', resp?.Message);
        return 0;
      }
      
      return Number(resp?.Count) || 0;
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT }
  );
};

// ============================================
// HOOKS: RANKINGS
// ============================================

export const useCoverageRanking = (rsrpMin = -95, rsrpMax = 0) => {
  const cacheKey = useMemo(() => ['coverageRank', rsrpMin, rsrpMax], [rsrpMin, rsrpMax]);
  
  return useSWR(
    cacheKey,
    async () => {
      const payload = await safeFetch(
        () => adminApi.getOperatorCoverageRanking({ min: rsrpMin, max: rsrpMax }),
        []
      );
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM }
  );
};

export const useQualityRanking = (rsrqMin = -10, rsrqMax = 0) => {
  const cacheKey = useMemo(() => ['qualityRank', rsrqMin, rsrqMax], [rsrqMin, rsrqMax]);
  
  return useSWR(
    cacheKey,
    async () => {
      const payload = await safeFetch(
        () => adminApi.getOperatorQualityRanking({ min: rsrqMin, max: rsrqMax }),
        []
      );
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM }
  );
};

// ============================================
// HOOKS: HANDSET PERFORMANCE
// ============================================

export const useHandsetPerformance = () => {
  return useSWR(
    'handsetAvg',
    async () => {
      const resp = await safeFetch(() => adminApi.getDashboardGraphData(), {});
      const data = resp?.handsetWiseAvg_bar || [];
      
      return data.map(item => ({
        Make: item?.Make || '',
        Avg: ensureNegative(item?.Avg || 0),
        Samples: toNumber(item?.Samples || 0)
      }));
    },
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.MEDIUM }
  );
};

// ============================================
// HOOKS: OPERATORS & NETWORKS (Optimized)
// ============================================

export const useOperatorsAndNetworks = () => {
  const { data: rawOperators = [], isLoading: operatorsLoading, error: operatorsError } = useSWR(
    'operators',
    () => safeFetch(() => adminApi.getOperatorsV2?.(), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.LONG }
  );

  const { data: networks = [], isLoading: networksLoading, error: networksError } = useSWR(
    'networks',
    () => safeFetch(() => adminApi.getNetworksV2?.(), []),
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.LONG }
  );

  // Memoized operators deduplication
  const operators = useMemo(() => {
    if (!Array.isArray(rawOperators) || rawOperators.length === 0) return [];
    
    const uniqueOperators = new Set();
    
    rawOperators.forEach(op => {
      const canonical = canonicalOperatorName(op);
      if (canonical && canonical !== 'Unknown') {
        uniqueOperators.add(canonical);
      }
    });
    
    return Array.from(uniqueOperators).sort();
  }, [rawOperators]);

  const operatorCount = operators.length;

  return { 
    operators, 
    networks: networks || [], 
    operatorCount,
    isLoading: operatorsLoading || networksLoading,
    error: operatorsError || networksError
  };
};

// ============================================
// HOOKS: PARALLEL DASHBOARD DATA (NEW!)
// ============================================

/**
 * Fetch multiple metrics in parallel for performance optimization
 */
export const useParallelMetrics = (metrics = [], filters) => {
  const cacheKey = useMemo(
    () => createCacheKey(`parallel_${metrics.join('_')}`, filters),
    [metrics, filters]
  );
  
  const fetcher = useCallback(async () => {
    if (!Array.isArray(metrics) || metrics.length === 0) return {};
    
    const queryString = buildQueryString(filters);
    const promises = metrics.map(async (metric) => {
      const endpoint = METRIC_ENDPOINT_MAP[metric];
      if (!endpoint || !adminApi[endpoint]) return [metric, []];
      
      const rawData = await safeFetch(() => adminApi[endpoint](queryString), []);
      return [metric, processMetricData(rawData, metric)];
    });
    
    const results = await Promise.all(promises);
    return Object.fromEntries(results);
  }, [metrics, filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { ...SWR_CONFIG, dedupingInterval: CACHE_TIME.SHORT }
  );
};

/**
 * Fetch all dashboard data in one go (most optimized)
 */
export const useDashboardDataParallel = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('dashboardAll', filters), [filters]);
  
  const fetcher = useCallback(async () => {
    const queryString = buildQueryString(filters);
    
    // Execute all API calls in parallel
    const [
      totals,
      monthlySamples,
      operatorSamples,
      networkDist,
      rsrpData,
      rsrqData,
      sinrData,
      bandDist,
    ] = await Promise.all([
      safeFetch(() => adminApi.getTotalsV2?.(), {}),
      safeFetch(() => adminApi.getMonthlySamplesV2?.(queryString), []),
      safeFetch(() => adminApi.getOperatorSamplesV2?.(queryString), []),
      safeFetch(() => adminApi.getNetworkTypeDistributionV2?.(queryString), []),
      safeFetch(() => adminApi.getAvgRsrpV2?.(queryString), []),
      safeFetch(() => adminApi.getAvgRsrqV2?.(queryString), []),
      safeFetch(() => adminApi.getAvgSinrV2?.(queryString), []),
      safeFetch(() => adminApi.getBandDistributionV2?.(queryString), []),
    ]);
    
    return {
      totals,
      monthlySamples,
      operatorSamples: groupOperatorSamplesByNetwork(operatorSamples),
      networkDist,
      rsrp: processMetricData(rsrpData, 'rsrp'),
      rsrq: processMetricData(rsrqData, 'rsrq'),
      sinr: processMetricData(sinrData, 'sinr'),
      bandDist,
    };
  }, [filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      revalidateOnMount: true 
    }
  );
};

// ============================================
// HOOKS: PREFETCH FOR PERFORMANCE
// ============================================

/**
 * Prefetch commonly needed data
 */
export const usePrefetchDashboard = (filters) => {
  const { mutate } = useSWR();
  
  const prefetch = useCallback(() => {
    const queryString = buildQueryString(filters);
    
    // Prefetch in background
    Promise.all([
      adminApi.getTotalsV2?.(),
      adminApi.getOperatorSamplesV2?.(queryString),
      adminApi.getNetworkTypeDistributionV2?.(queryString),
    ]);
  }, [filters, mutate]);
  
  return prefetch;
};

// ============================================
// EXPORT CONFIG FOR APP-LEVEL USE
// ============================================

export { SWR_CONFIG, CACHE_TIME };