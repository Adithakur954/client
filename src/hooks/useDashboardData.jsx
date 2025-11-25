// src/hooks/useDashboardData.js
import useSWR, { useSWRConfig } from 'swr';
import { useMemo, useCallback, useRef, useEffect } from 'react';
import { adminApi } from '../api/apiEndpoints';
import { 
  buildQueryString, 
  groupOperatorSamplesByNetwork, 
  buildRanking,
  canonicalOperatorName,
  toNumber,
  ensureNegative
} from '../utils/dashboardUtils';
import { localStorageProvider } from '../utils/localStorageProvider';

// ============================================
// DEBUG MODE CONTROL
// ============================================
const DEBUG_MODE = true; // ✅ Set to false to disable all logging

const log = (emoji, label, data) => {
  if (DEBUG_MODE) {
    console.log(`${emoji} [${label}]`, data);
  }
};

const logGroup = (label, callback) => {
  if (DEBUG_MODE) {
    console.group(`📦 ${label}`);
    callback();
    console.groupEnd();
  }
};

// ============================================
// OPTIMIZED SWR CONFIG
// ============================================
const SWR_CONFIG = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  shouldRetryOnError: true,
  errorRetryCount: 2,
  errorRetryInterval: 2000,
  dedupingInterval: 1000,
  focusThrottleInterval: 5000,
   
  loadingTimeout: 5000,
  onLoadingSlow: (key) => {
    console.warn(`⏱️ Slow loading (>5s): ${key}`);
  },
  onError: (error, key) => {
    console.error(`❌ SWR Error [${key}]:`, error?.message || error);
  },
  onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
    if (error?.response?.status === 500) {
      console.error(`🚫 Not retrying 500 error for ${key}`);
      return;
    }
    
    if (retryCount >= 2) return;
    
    setTimeout(() => revalidate({ retryCount }), 2000 * (retryCount + 1));
  },
};

const CACHE_TIME = {
  SHORT: 1 * 60 * 1000,
  MEDIUM: 3 * 60 * 1000,
  LONG: 10 * 60 * 1000,
};

// ============================================
// IMPROVED CACHE KEY GENERATION
// ============================================
const createCacheKey = (base, filters) => {
  if (!filters) return base;
  
  const normalizedFilters = Object.keys(filters)
    .sort()
    .reduce((acc, key) => {
      const value = filters[key];
      
      if (value === undefined || value === null || value === '') {
        return acc;
      }
      
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
  
  const hasFilters = Object.keys(normalizedFilters).length > 0;
  const key = hasFilters ? `${base}::${JSON.stringify(normalizedFilters)}` : base;
  
  log('🔑', 'Cache Key Generated', { base, filters: normalizedFilters, key });
  
  return key;
};

// ============================================
// IMPROVED SAFE FETCH WITH TIMEOUT
// ============================================
const safeFetch = async (apiFn, fallback = [], timeout = 60000, endpointName = 'Unknown') => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  const startTime = Date.now();
  log('🚀', `API Call Start: ${endpointName}`, { timeout: `${timeout/1000}s` });
  
  try {
    const resp = await apiFn();
    clearTimeout(timeoutId);
    
    const duration = Date.now() - startTime;
    
    logGroup(`API Response: ${endpointName} (${duration}ms)`, () => {
      console.log('⏱️ Duration:', `${duration}ms`);
      console.log('📥 Raw Response:', resp);
      console.log('📊 Response Type:', typeof resp);
      console.log('📏 Response Length:', Array.isArray(resp) ? resp.length : 'N/A');
      
      if (resp?.Data) console.log('📦 resp.Data:', resp.Data);
      if (resp?.data) console.log('📦 resp.data:', resp.data);
      if (resp?.Status !== undefined) console.log('✅ Status:', resp.Status);
      if (resp?.Message) console.log('💬 Message:', resp.Message);
    });
    
    if (!resp) {
      console.warn(`⚠️ [${endpointName}] API returned null/undefined response`);
      return fallback;
    }
    
    const extractedData = resp?.Data ?? resp?.data ?? resp ?? fallback;
    log('✅', `Extracted Data: ${endpointName}`, { 
      type: typeof extractedData,
      length: Array.isArray(extractedData) ? extractedData.length : 'N/A',
      sample: Array.isArray(extractedData) ? extractedData[0] : extractedData
    });
    
    return extractedData;
  } catch (error) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    
    logGroup(`API Error: ${endpointName} (${duration}ms)`, () => {
      console.error('❌ Error:', error);
      console.error('📛 Error Name:', error.name);
      console.error('💬 Error Message:', error.message);
      console.error('🔢 Status Code:', error.response?.status);
      console.error('📦 Error Response:', error.response?.data);
      console.error('🔄 Returning Fallback:', fallback);
    });
    
    if (error.name === 'AbortError') {
      console.error(`⏱️ [${endpointName}] Request timeout after ${timeout / 1000} seconds`);
    } else if (error.response?.status === 500) {
      console.error(`💥 [${endpointName}] Server error (500):`, error.response?.data?.message || error.message);
    } else if (error.code === 'ECONNABORTED') {
      console.error(`🔌 [${endpointName}] Connection aborted`);
    }
    
    return fallback;
  }
};

// ============================================
// DATA PROCESSING UTILITIES
// ============================================
const processMetricData = (rawData, metric) => {
  logGroup(`Processing Metric Data: ${metric}`, () => {
    console.log('📥 Raw Data:', rawData);
    console.log('📊 Raw Data Type:', typeof rawData);
    console.log('📏 Raw Data Length:', Array.isArray(rawData) ? rawData.length : 'N/A');
  });
  
  if (!Array.isArray(rawData) || rawData.length === 0) {
    console.warn(`⚠️ No data to process for metric: ${metric}`);
    return [];
  }
  
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
  
  const processed = Array.from(merged.values())
    .map(item => ({
      name: item.name,
      value: ['rsrp', 'rsrq'].includes(metric) ? ensureNegative(item.value) : item.value
    }))
    .sort((a, b) => {
      const isNegative = ['rsrp', 'rsrq'].includes(metric);
      return isNegative ? a.value - b.value : b.value - a.value;
    });
  
  logGroup(`Processed Metric Data: ${metric}`, () => {
    console.log('📤 Processed Data:', processed);
    console.log('📏 Processed Length:', processed.length);
    console.log('🎯 Sample:', processed[0]);
  });
  
  return processed;
};

const processOperatorMetrics = (rawData, metric) => {
  logGroup(`Processing Operator Metrics: ${metric}`, () => {
    console.log('📥 Raw Data:', rawData);
    console.log('📏 Raw Data Length:', Array.isArray(rawData) ? rawData.length : 'N/A');
  });
  
  if (!Array.isArray(rawData) || rawData.length === 0) return [];
  
  if (metric === 'samples') {
    const result = groupOperatorSamplesByNetwork(rawData);
    log('✅', `Grouped Samples by Network`, result);
    return result;
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
  const sorted = result.sort((a, b) => 
    isNegativeMetric ? a.total - b.total : b.total - a.total
  );
  
  log('✅', `Processed Operator Metrics: ${metric}`, sorted);
  
  return sorted;
};

// ============================================
// HOOKS: BASIC DATA
// ============================================

export const useTotals = () => {
  return useSWR(
    'totals',
    async () => {
      const data = await safeFetch(() => adminApi.getTotalsV2?.(), {}, 60000, 'getTotalsV2');
      log('📊', 'Totals Data', data);
      return data;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      refreshInterval: 60000,
      onSuccess: (data) => log('✅', 'useTotals Success', data),
      onError: (err) => console.error('❌ useTotals Error', err)
    }
  );
};

export const useMonthlySamples = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('monthlySamples', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      log('🔍', 'Monthly Samples Query', { filters, queryString });
      
      const data = await safeFetch(
        () => adminApi.getMonthlySamplesV2?.(queryString), 
        [], 
        60000, 
        'getMonthlySamplesV2'
      );
      
      log('📊', 'Monthly Samples Data', data);
      return data;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      revalidateIfStale: true,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useMonthlySamples Success', { count: data?.length }),
      onError: (err) => console.error('❌ useMonthlySamples Error', err)
    }
  );
};

export const useOperatorSamples = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('operatorSamples', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      log('🔍', 'Operator Samples Query', { filters, queryString });
      
      const data = await safeFetch(
        () => adminApi.getOperatorSamplesV2?.(queryString), 
        [], 
        60000, 
        'getOperatorSamplesV2'
      );
      
      const grouped = groupOperatorSamplesByNetwork(data);
      log('📊', 'Operator Samples Grouped', grouped);
      
      return grouped;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useOperatorSamples Success', { count: data?.length }),
      onError: (err) => console.error('❌ useOperatorSamples Error', err)
    }
  );
};

export const useNetworkDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('networkDist', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      log('🔍', 'Network Distribution Query', { filters, queryString });
      
      const data = await safeFetch(
        () => adminApi.getNetworkTypeDistributionV2?.(queryString), 
        [], 
        60000, 
        'getNetworkTypeDistributionV2'
      );
      
      log('📊', 'Network Distribution Data', data);
      return data;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useNetworkDistribution Success', { count: data?.length }),
      onError: (err) => console.error('❌ useNetworkDistribution Error', err)
    }
  );
};

// ============================================
// HOOKS: METRICS
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
    
    log('🎯', `Metric Data Fetch: ${metric}`, { endpoint, filters });
    
    if (!endpoint || !adminApi[endpoint]) {
      console.warn(`⚠️ No endpoint found for metric: ${metric}`);
      return [];
    }
    
    const queryString = buildQueryString(filters);
    const rawData = await safeFetch(
      () => adminApi[endpoint](queryString), 
      [], 
      60000, 
      endpoint
    );
    
    const processed = processMetricData(rawData, metric);
    log('✅', `Processed Metric: ${metric}`, processed);
    
    return processed;
  }, [metric, filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', `useMetricData(${metric}) Success`, { count: data?.length }),
      onError: (err) => console.error(`❌ useMetricData(${metric}) Error`, err)
    }
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
    
    log('🎯', `Operator Metric Fetch: ${metric}`, { endpoint, filters });
    
    if (!endpoint || !adminApi[endpoint]) {
      console.warn(`⚠️ No endpoint found for operator metric: ${metric}`);
      return [];
    }
    
    const queryString = buildQueryString(filters);
    const rawData = await safeFetch(
      () => adminApi[endpoint](queryString), 
      [], 
      60000, 
      endpoint
    );
    
    const processed = processOperatorMetrics(rawData, metric);
    log('✅', `Processed Operator Metric: ${metric}`, processed);
    
    return processed;
  }, [metric, filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', `useOperatorMetrics(${metric}) Success`, { count: data?.length }),
      onError: (err) => console.error(`❌ useOperatorMetrics(${metric}) Error`, err)
    }
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
      log('🔍', 'Band Distribution Raw Query', { filters, queryString });
      
      const data = await safeFetch(
        () => adminApi.getBandDistributionV2?.(queryString), 
        [], 
        60000, 
        'getBandDistributionV2'
      );
      
      log('📊', 'Band Distribution Raw Data', data);
      return data;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useBandDistributionRaw Success', { count: data?.length }),
      onError: (err) => console.error('❌ useBandDistributionRaw Error', err)
    }
  );
};

export const useBandDistribution = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('bandDist', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      log('🔍', 'Band Distribution Query', { filters, queryString });
      
      const rawData = await safeFetch(
        () => adminApi.getBandDistributionV2?.(queryString), 
        [], 
        60000, 
        'getBandDistributionV2'
      );
      
      if (!Array.isArray(rawData) || rawData.length === 0) {
        log('⚠️', 'No band distribution data', rawData);
        return [];
      }
      
      const merged = new Map();
      for (const item of rawData) {
        const band = `Band ${item?.band || 'Unknown'}`;
        const count = toNumber(item?.count);
        merged.set(band, (merged.get(band) || 0) + count);
      }
      
      const processed = Array.from(merged.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      
      log('✅', 'Band Distribution Processed', processed);
      
      return processed;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useBandDistribution Success', { count: data?.length }),
      onError: (err) => console.error('❌ useBandDistribution Error', err)
    }
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
      log('🔍', 'Indoor Count Query', { filters, queryString });
      
      const resp = await safeFetch(
        () => adminApi.getIndoorCount?.(queryString), 
        {}, 
        60000, 
        'getIndoorCount'
      );
      
      if (resp?.Status === 0) {
        console.error('❌ Indoor count API error:', resp?.Message);
        return 0;
      }
      
      const count = Number(resp?.Count || resp?.count || 0);
      log('📊', 'Indoor Count', count);
      
      return count;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useIndoorCount Success', data),
      onError: (err) => console.error('❌ useIndoorCount Error', err)
    }
  );
};

export const useOutdoorCount = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('outdoorCount', filters), [filters]);
  
  return useSWR(
    cacheKey,
    async () => {
      const queryString = buildQueryString(filters);
      log('🔍', 'Outdoor Count Query', { filters, queryString });
      
      const resp = await safeFetch(
        () => adminApi.getOutdoorCount?.(queryString), 
        {}, 
        60000, 
        'getOutdoorCount'
      );
      
      if (resp?.Status === 0) {
        console.error('❌ Outdoor count API error:', resp?.Message);
        return 0;
      }
      
      const count = Number(resp?.Count || resp?.count || 0);
      log('📊', 'Outdoor Count', count);
      
      return count;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useOutdoorCount Success', data),
      onError: (err) => console.error('❌ useOutdoorCount Error', err)
    }
  );
};

// ============================================
// HOOKS: RANKINGS
// ============================================

export const useCoverageRanking = (rsrpMin = -95, rsrpMax = 0) => {
  const cacheKey = useMemo(() => 
    createCacheKey('coverageRank', { min: rsrpMin, max: rsrpMax }), 
    [rsrpMin, rsrpMax]
  );
  
  return useSWR(
    cacheKey,
    async () => {
      log('🔍', 'Coverage Ranking Query', { rsrpMin, rsrpMax });
      
      try {
        const payload = await safeFetch(
          () => adminApi.getOperatorCoverageRanking({ min: rsrpMin, max: rsrpMax }),
          [],
          60000,
          'getOperatorCoverageRanking'
        );
        
        const ranking = buildRanking(payload, { nameKey: 'name', countKey: 'count' });
        log('✅', 'Coverage Ranking Built', ranking);
        
        return ranking;
      } catch (error) {
        console.error('❌ Coverage ranking error:', error);
        return [];
      }
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      keepPreviousData: true,
      shouldRetryOnError: false,
      onSuccess: (data) => log('✅', 'useCoverageRanking Success', { count: data?.length }),
      onError: (err) => console.error('❌ useCoverageRanking Error', err)
    }
  );
};

export const useQualityRanking = (rsrqMin = -10, rsrqMax = 0) => {
  const cacheKey = useMemo(() => 
    createCacheKey('qualityRank', { min: rsrqMin, max: rsrqMax }), 
    [rsrqMin, rsrqMax]
  );
  
  return useSWR(
    cacheKey,
    async () => {
      log('🔍', 'Quality Ranking Query', { rsrqMin, rsrqMax });
      
      try {
        const payload = await safeFetch(
          () => adminApi.getOperatorQualityRanking({ min: rsrqMin, max: rsrqMax }),
          [],
          60000,
          'getOperatorQualityRanking'
        );
        
        const ranking = buildRanking(payload, { nameKey: 'name', countKey: 'count' });
        log('✅', 'Quality Ranking Built', ranking);
        
        return ranking;
      } catch (error) {
        console.error('❌ Quality ranking error (DB timeout):', error);
        return [];
      }
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      keepPreviousData: true,
      shouldRetryOnError: false,
      onSuccess: (data) => log('✅', 'useQualityRanking Success', { count: data?.length }),
      onError: (err) => console.error('❌ useQualityRanking Error (likely DB timeout)', err)
    }
  );
};

// ============================================
// HOOKS: HANDSET PERFORMANCE
// ============================================

export const useHandsetPerformance = () => {
  return useSWR(
    'handsetAvg',
    async () => {
      log('🔄', 'Fetching handset performance data...', {});
      
      const resp = await safeFetch(
        () => adminApi.getDashboardGraphData(), 
        {}, 
        60000, 
        'getDashboardGraphData'
      );
      
      logGroup('Handset Performance Response Analysis', () => {
        console.log('📦 Full Response:', resp);
        console.log('🔑 Response Keys:', Object.keys(resp || {}));
        console.log('📊 handsetWiseAvg_bar:', resp?.handsetWiseAvg_bar);
        console.log('📊 HandsetWiseAvg_bar:', resp?.HandsetWiseAvg_bar);
      });
      
      const rawData = resp?.handsetWiseAvg_bar || resp?.HandsetWiseAvg_bar || [];
      
      if (!Array.isArray(rawData)) {
        console.error('❌ Invalid handset data structure:', typeof rawData);
        return [];
      }
      
      if (rawData.length === 0) {
        console.warn('⚠️ No handset performance data available');
        return [];
      }
      
      const processedData = rawData.map(item => {
        const make = item?.Make || item?.make || 'Unknown';
        const avg = ensureNegative(toNumber(item?.Avg || item?.avg || 0));
        const samples = toNumber(item?.Samples || item?.samples || 0);
        
        return {
          Make: make,
          Avg: avg,
          Samples: samples
        };
      });
      
      log('✅', 'Handset Performance Processed', {
        count: processedData.length,
        sample: processedData[0],
        data: processedData
      });
      
      return processedData;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      keepPreviousData: true,
      revalidateOnMount: true,
      onSuccess: (data) => {
        log('✅', 'useHandsetPerformance Success', {
          count: data?.length || 0,
          items: data
        });
      },
      onError: (error) => {
        console.error('❌ Handset performance fetch failed:', error.message);
      }
    }
  );
};

// ============================================
// HOOKS: OPERATORS & NETWORKS
// ============================================

// ============================================
// HOOKS: OPERATORS & NETWORKS
// ============================================

export const useOperatorsAndNetworks = () => {
  const { 
    data: rawOperators = [], 
    isLoading: operatorsLoading, 
    error: operatorsError 
  } = useSWR(
    'operators',
    async () => {
      log('🔄', 'Fetching operators...', {});
      
      const resp = await safeFetch(
        () => adminApi.getOperatorsV2?.(), 
        [], 
        60000, 
        'getOperatorsV2'
      );
      
      logGroup('Operators Response Analysis', () => {
        console.log('📦 Response:', resp);
        console.log('📊 Type:', typeof resp);
        console.log('📏 Is Array:', Array.isArray(resp));
        console.log('📏 Length:', Array.isArray(resp) ? resp.length : 'N/A');
        console.log('🎯 Sample:', Array.isArray(resp) ? resp[0] : resp);
      });
      
      // Handle different response formats
      let data;
      if (Array.isArray(resp)) {
        data = resp;
      } else if (resp?.Data && Array.isArray(resp.Data)) {
        data = resp.Data;
      } else if (resp?.data && Array.isArray(resp.data)) {
        data = resp.data;
      } else {
        console.warn('⚠️ Unexpected operators response format:', resp);
        data = [];
      }
      
      log('📊', 'Raw Operators Data', data);
      return data;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.LONG,
      revalidateOnMount: true, // ✅ Changed from false to true
      onSuccess: (data) => log('✅', 'Operators Loaded', { count: data?.length }),
      onError: (err) => console.error('❌ Operators Error', err)
    }
  );

  const { 
    data: rawNetworks = [], 
    isLoading: networksLoading, 
    error: networksError 
  } = useSWR(
    'networks',
    async () => {
      log('🔄', 'Fetching networks...', {});
      
      const resp = await safeFetch(
        () => adminApi.getNetworksV2?.(), 
        [], 
        60000, 
        'getNetworksV2'
      );
      
      logGroup('Networks Response Analysis', () => {
        console.log('📦 Response:', resp);
        console.log('📊 Type:', typeof resp);
        console.log('📏 Is Array:', Array.isArray(resp));
        console.log('📏 Length:', Array.isArray(resp) ? resp.length : 'N/A');
      });
      
      // Handle different response formats
      let data;
      if (Array.isArray(resp)) {
        data = resp;
      } else if (resp?.Data && Array.isArray(resp.Data)) {
        data = resp.Data;
      } else if (resp?.data && Array.isArray(resp.data)) {
        data = resp.data;
      } else {
        console.warn('⚠️ Unexpected networks response format:', resp);
        data = [];
      }
      
      log('📊', 'Networks Data', data);
      return data;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.LONG,
      revalidateOnMount: true, // ✅ Changed from false to true
      onSuccess: (data) => log('✅', 'Networks Loaded', { count: data?.length }),
      onError: (err) => console.error('❌ Networks Error', err)
    }
  );

  // ✅ Improved operator processing
  const operators = useMemo(() => {
    if (!rawOperators || !Array.isArray(rawOperators) || rawOperators.length === 0) {
      log('⚠️', 'No raw operators to process', rawOperators);
      return [];
    }
    
    const uniqueOperators = new Set();
    
    rawOperators.forEach(op => {
      // Handle different data formats
      let operatorName;
      
      if (typeof op === 'string') {
        operatorName = op;
      } else if (typeof op === 'object' && op !== null) {
        // Try different property names
        operatorName = op?.operatorName || op?.OperatorName || op?.name || op?.Name || op?.operator || op?.Operator;
      }
      
      if (operatorName) {
        const canonical = canonicalOperatorName(operatorName);
        if (canonical && canonical !== 'Unknown') {
          uniqueOperators.add(canonical);
        }
      }
    });
    
    const result = Array.from(uniqueOperators).sort();
    log('✅', 'Unique Operators Processed', { count: result.length, operators: result });
    
    return result;
  }, [rawOperators]);

  // ✅ Improved networks processing
  const networks = useMemo(() => {
    if (!rawNetworks || !Array.isArray(rawNetworks) || rawNetworks.length === 0) {
      log('⚠️', 'No raw networks to process', rawNetworks);
      return [];
    }
    
    const uniqueNetworks = new Set();
    
    rawNetworks.forEach(net => {
      let networkName;
      
      if (typeof net === 'string') {
        networkName = net;
      } else if (typeof net === 'object' && net !== null) {
        networkName = net?.network || net?.Network || net?.networkType || net?.NetworkType || net?.name || net?.Name;
      }
      
      if (networkName && networkName !== 'Unknown') {
        uniqueNetworks.add(networkName);
      }
    });
    
    const result = Array.from(uniqueNetworks).sort();
    log('✅', 'Unique Networks Processed', { count: result.length, networks: result });
    
    return result;
  }, [rawNetworks]);

  const operatorCount = operators.length;

  // ✅ Debug logging
  log('📊', 'useOperatorsAndNetworks Result', {
    operatorCount,
    operators,
    networks,
    isLoading: operatorsLoading || networksLoading
  });

  return { 
    operators, 
    networks, 
    operatorCount,
    isLoading: operatorsLoading || networksLoading,
    error: operatorsError || networksError
  };
};

// ============================================
// HOOKS: PARALLEL DASHBOARD DATA
// ============================================

export const useDashboardDataParallel = (filters) => {
  const cacheKey = useMemo(() => createCacheKey('dashboardAll', filters), [filters]);
  
  const fetcher = useCallback(async () => {
    const queryString = buildQueryString(filters);
    
    log('🚀', 'Starting Parallel Dashboard Fetch', { filters, queryString });
    console.time('⏱️ Dashboard Parallel Fetch');
    
    try {
      const results = await Promise.allSettled([
        safeFetch(() => adminApi.getTotalsV2?.(), {}, 60000, 'getTotalsV2'),
        safeFetch(() => adminApi.getMonthlySamplesV2?.(queryString), [], 60000, 'getMonthlySamplesV2'),
        safeFetch(() => adminApi.getOperatorSamplesV2?.(queryString), [], 60000, 'getOperatorSamplesV2'),
        safeFetch(() => adminApi.getNetworkTypeDistributionV2?.(queryString), [], 60000, 'getNetworkTypeDistributionV2'),
        safeFetch(() => adminApi.getAvgRsrpV2?.(queryString), [], 60000, 'getAvgRsrpV2'),
        safeFetch(() => adminApi.getAvgRsrqV2?.(queryString), [], 60000, 'getAvgRsrqV2'),
        safeFetch(() => adminApi.getAvgSinrV2?.(queryString), [], 60000, 'getAvgSinrV2'),
        safeFetch(() => adminApi.getBandDistributionV2?.(queryString), [], 60000, 'getBandDistributionV2'),
      ]);
      
      logGroup('Parallel Fetch Results', () => {
        results.forEach((result, index) => {
          const endpoints = ['getTotalsV2', 'getMonthlySamplesV2', 'getOperatorSamplesV2', 
                           'getNetworkTypeDistributionV2', 'getAvgRsrpV2', 'getAvgRsrqV2', 
                           'getAvgSinrV2', 'getBandDistributionV2'];
          
          if (result.status === 'fulfilled') {
            console.log(`✅ [${index}] ${endpoints[index]}:`, result.value);
          } else {
            console.error(`❌ [${index}] ${endpoints[index]}:`, result.reason);
          }
        });
      });
      
      const [
        totals,
        monthlySamples,
        operatorSamples,
        networkDist,
        rsrpData,
        rsrqData,
        sinrData,
        bandDist,
      ] = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`❌ Promise ${index} rejected:`, result.reason);
          return index === 0 ? {} : [];
        }
      });
      
      console.timeEnd('⏱️ Dashboard Parallel Fetch');
      
      const finalData = {
        totals,
        monthlySamples,
        operatorSamples: groupOperatorSamplesByNetwork(operatorSamples),
        networkDist,
        rsrp: processMetricData(rsrpData, 'rsrp'),
        rsrq: processMetricData(rsrqData, 'rsrq'),
        sinr: processMetricData(sinrData, 'sinr'),
        bandDist,
      };
      
      log('✅', 'Parallel Dashboard Data Complete', finalData);
      
      return finalData;
    } catch (error) {
      console.error('❌ Dashboard parallel fetch failed:', error);
      throw error;
    }
  }, [filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      revalidateOnMount: true,
      keepPreviousData: true,
      suspense: false,
      onSuccess: (data) => log('✅', 'useDashboardDataParallel Success', data),
      onError: (err) => console.error('❌ useDashboardDataParallel Error', err)
    }
  );
};

export const useParallelMetrics = (metrics = [], filters) => {
  const cacheKey = useMemo(
    () => createCacheKey(`parallel_${metrics.sort().join('_')}`, filters),
    [metrics, filters]
  );
  
  const fetcher = useCallback(async () => {
    if (!Array.isArray(metrics) || metrics.length === 0) return {};
    
    const queryString = buildQueryString(filters);
    
    log('🚀', 'Starting Parallel Metrics Fetch', { metrics, filters });
    
    const results = await Promise.allSettled(
      metrics.map(async (metric) => {
        const endpoint = METRIC_ENDPOINT_MAP[metric];
        if (!endpoint || !adminApi[endpoint]) {
          console.warn(`⚠️ No endpoint for metric: ${metric}`);
          return [metric, []];
        }
        
        const rawData = await safeFetch(() => adminApi[endpoint](queryString), [], 60000, endpoint);
        const processed = processMetricData(rawData, metric);
        
        return [metric, processed];
      })
    );
    
    const finalData = Object.fromEntries(
      results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value)
    );
    
    log('✅', 'Parallel Metrics Complete', finalData);
    
    return finalData;
  }, [metrics, filters]);
  
  return useSWR(
    cacheKey,
    fetcher,
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.SHORT,
      keepPreviousData: true,
      onSuccess: (data) => log('✅', 'useParallelMetrics Success', data),
      onError: (err) => console.error('❌ useParallelMetrics Error', err)
    }
  );
};

// ============================================
// CACHE MANAGEMENT
// ============================================

export const usePrefetchDashboard = (filters) => {
  const { mutate } = useSWRConfig();
  const prefetchRef = useRef(false);
  
  const prefetch = useCallback(() => {
    if (prefetchRef.current) return;
    
    const queryString = buildQueryString(filters);
    
    log('🚀', 'Prefetching dashboard data...', { filters });
    
    Promise.allSettled([
      adminApi.getTotalsV2?.(),
      adminApi.getOperatorSamplesV2?.(queryString),
      adminApi.getNetworkTypeDistributionV2?.(queryString),
    ]).then(() => {
      log('✅', 'Prefetch complete', {});
      prefetchRef.current = true;
    });
  }, [filters]);
  
  return prefetch;
};

export const useClearDashboardCache = () => {
  const { cache, mutate } = useSWRConfig();
  
  const clearCache = useCallback(() => {
    log('🗑️', 'Clearing dashboard cache...', {});
    
    const keysToDelete = [];
    
    if (cache instanceof Map) {
      cache.forEach((_, key) => {
        if (
          typeof key === 'string' && (
            key.startsWith('dashboard') ||
            key.startsWith('metric_') ||
            key.startsWith('opMetric_') ||
            key.startsWith('parallel_') ||
            key === 'handsetAvg'
          )
        ) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => cache.delete(key));
      log('✅', `Cleared ${keysToDelete.length} cache entries`, keysToDelete);
    }
    
    mutate(() => true, undefined, { revalidate: true });
  }, [cache, mutate]);
  
  return clearCache;
};

export const useDebugDashboard = () => {
  const { cache } = useSWRConfig();
  
  useEffect(() => {
    const interval = setInterval(() => {
      if (cache instanceof Map) {
        const keys = Array.from(cache.keys()).filter(k => typeof k === 'string');
        
        logGroup('SWR Cache Status', () => {
          console.log('📊 Cache Size:', cache.size);
          console.log('🔑 Cache Keys:', keys);
          console.log('🎯 Has handsetAvg:', keys.includes('handsetAvg'));
          console.log('📦 Cache Entries:', Array.from(cache.entries()));
        });
      }
    }, 10000);
    
    return () => clearInterval(interval);
  }, [cache]);
};

// ============================================
// HOOKS: APP DATA
// ============================================

export const useAppData = () => {
  return useSWR(
    'appData',
    async () => {
      log('🔄', 'Fetching app data...', {});
      
      const resp = await safeFetch(
        () => adminApi.getAppValue(), 
        [], // ✅ Changed fallback to array instead of object
        60000, 
        'getAppValue'
      );
      
      logGroup('App Data Response Analysis', () => {
        console.log('📦 Response from safeFetch:', resp);
        console.log('📊 Response Type:', typeof resp);
        console.log('📏 Is Array:', Array.isArray(resp));
        console.log('📏 Response Length:', Array.isArray(resp) ? resp.length : 'N/A');
      });
      
      // ✅ FIX: safeFetch already extracts Data/data, so resp IS the data
      // Handle both cases: resp could be array (already extracted) or object (needs extraction)
      let rawData;
      if (Array.isArray(resp)) {
        rawData = resp;
      } else if (resp && typeof resp === 'object') {
        rawData = resp?.Data || resp?.data || [];
      } else {
        rawData = [];
      }
      
      log('📊', 'Raw Data Extracted', { 
        isArray: Array.isArray(rawData), 
        length: rawData.length,
        sample: rawData[0]
      });
      
      if (!Array.isArray(rawData)) {
        console.error('❌ Invalid app data structure:', typeof rawData, rawData);
        return [];
      }
      
      if (rawData.length === 0) {
        console.warn('⚠️ No app data available');
        return [];
      }
      
      const processedData = rawData.map(item => ({
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
      
      log('✅', 'App Data Processed', {
        count: processedData.length,
        sample: processedData[0],
      });
      
      return processedData;
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      keepPreviousData: true,
      revalidateOnMount: true,
      onSuccess: (data) => log('✅', 'useAppData Success', { count: data?.length }),
      onError: (err) => console.error('❌ useAppData Error', err)
    }
  );
};

export { SWR_CONFIG, CACHE_TIME };