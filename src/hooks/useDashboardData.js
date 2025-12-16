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
// CONFIGURATION
// ============================================

const SWR_CONFIG = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  revalidateOnMount: true,
  shouldRetryOnError: true,       
  errorRetryCount: 2,              
  errorRetryInterval: 3000,
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
// METRIC FIELD MAPPING
// ============================================

const METRIC_TO_FIELD = {
  samples: 'value',
  rsrp: 'avg_rsrp',
  rsrq: 'avg_rsrq', 
  sinr: 'avg_sinr',
  mos: 'avg_mos',
  jitter: 'avg_jitter',
  latency: 'avg_latency',
  packetLoss: 'avg_packet_loss',
  dlTpt: 'avg_dl_tpt',
  ulTpt: 'avg_ul_tpt',
};

const METRIC_FIELD_FALLBACKS = {
  samples: ['value', 'count', 'samples', 'sampleCount'],
  rsrp: ['avg_rsrp', 'avgRsrp', 'rsrp', 'RSRP'],
  rsrq: ['avg_rsrq', 'avgRsrq', 'rsrq', 'RSRQ'],
  sinr: ['avg_sinr', 'avgSinr', 'sinr', 'SINR'],
  mos: ['avg_mos', 'avgMos', 'mos', 'MOS'],
  jitter: ['avg_jitter', 'avgJitter', 'jitter'],
  latency: ['avg_latency', 'avgLatency', 'latency'],
  packetLoss: ['avg_packet_loss', 'avgPacketLoss', 'packet_loss'],
  dlTpt: ['avg_dl_tpt', 'avgDlTpt', 'dl_tpt', 'downloadSpeed'],
  ulTpt: ['avg_ul_tpt', 'avgUlTpt', 'ul_tpt', 'uploadSpeed'],
};

// ============================================
// HELPER FUNCTIONS
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

const extractData = (response, fallback = []) => {
  console.log('[extractData] Received response:', { 
    type: typeof response, 
    isArray: Array.isArray(response),
    hasData: response?.Data ? 'yes' : 'no',
    keys: typeof response === 'object' ? Object.keys(response || {}) : []
  });

  if (response === null || response === undefined) {
    console.log('[extractData] Response is null/undefined, returning fallback');
    return fallback;
  }
  
  if (Array.isArray(response)) {
    console.log('[extractData] Response is array, length:', response.length);
    return response;
  }
  
  if (response?.Status === 0) {
    console.log('[extractData] Response status is 0, returning fallback');
    return fallback;
  }
  
  if (Array.isArray(response?.Data)) {
    console.log('[extractData] Extracting from response.Data, length:', response.Data.length);
    return response.Data;
  }
  if (Array.isArray(response?.data)) {
    console.log('[extractData] Extracting from response.data, length:', response.data.length);
    return response.data;
  }
  if (Array.isArray(response?.Result)) {
    console.log('[extractData] Extracting from response.Result, length:', response.Result.length);
    return response.Result;
  }
  if (Array.isArray(response?.result)) {
    console.log('[extractData] Extracting from response.result, length:', response.result.length);
    return response.result;
  }
  
  if (typeof response === 'object' && !Array.isArray(response)) {
    if (response.Data !== undefined) {
      console.log('[extractData] Returning response.Data');
      return response.Data;
    }
    if (response.data !== undefined) {
      console.log('[extractData] Returning response.data');
      return response.data;
    }
    console.log('[extractData] Returning response object itself');
    return response;
  }
  
  console.log('[extractData] No match, returning fallback');
  return fallback;
};

const createFetcher = (apiFn, fallback = []) => {
  return async () => {
    try {
      console.log('[createFetcher] Calling API function...');
      const response = await apiFn();
      console.log('[createFetcher] API response received:', response);
      
      const data = extractData(response, fallback);
      console.log('[createFetcher] Extracted data:', { 
        type: typeof data, 
        isArray: Array.isArray(data),
        length: Array.isArray(data) ? data.length : 'N/A'
      });
      
      if (data !== null && data !== undefined) {
        const isValidArray = Array.isArray(data) && data.length > 0;
        const isValidObject = !Array.isArray(data) && typeof data === 'object' && Object.keys(data).length > 0;
        const isValidNumber = typeof data === 'number';
        
        if (isValidArray || isValidObject || isValidNumber) {
          console.log('[createFetcher] Data is valid, returning');
          return data;
        }
      }
      
      console.log('[createFetcher] Data is not valid, returning fallback');
      return fallback;
    } catch (error) {
      console.error('[createFetcher] Error:', error);
      throw error;
    }
  };
};

const extractMetricValue = (item, metric) => {
  if (!item || !metric) return null;

  const primaryField = METRIC_TO_FIELD[metric];
  if (primaryField && item[primaryField] !== undefined && item[primaryField] !== null) {
    return toNumber(item[primaryField]);
  }

  const fallbacks = METRIC_FIELD_FALLBACKS[metric] || [];
  for (const field of fallbacks) {
    if (item[field] !== undefined && item[field] !== null) {
      return toNumber(item[field]);
    }
  }

  return null;
};

const isValidMetricValue = (value, metric) => {
  if (value === null || value === undefined || isNaN(value)) return false;
  
  if (NEGATIVE_METRICS.includes(metric)) {
    return value !== 0;
  }
  
  if (metric === 'samples') {
    return value > 0;
  }
  
  return value >= 0;
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
    
    const value = extractMetricValue(item, metric);
    if (!isValidMetricValue(value, metric)) continue;
    
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
  if (!Array.isArray(rawData) || rawData.length === 0) {
    return [];
  }

  if (metric === 'samples') {
    return groupOperatorSamplesByNetwork(rawData);
  }

  const isNegative = NEGATIVE_METRICS.includes(metric);
  const grouped = {};

  rawData.forEach((item, index) => {
    const operatorName = canonicalOperatorName(
      item?.operatorName || item?.operator || item?.name
    );
    
    const network = item?.network || item?.networkType || item?.type;
    const value = extractMetricValue(item, metric);

    if (!operatorName || operatorName === 'Unknown') return;
    if (!network) return;
    
    const networkLower = network.toLowerCase();
    if (networkLower.includes('edge') || 
        networkLower === 'unknown' ||
        networkLower.includes('no service')) {
      return;
    }

    if (!isValidMetricValue(value, metric)) {
      return;
    }

    if (!grouped[operatorName]) {
      grouped[operatorName] = { 
        name: operatorName,
        _networkCounts: {}
      };
    }

    const operatorData = grouped[operatorName];
    const finalValue = isNegative ? ensureNegative(value) : value;

    if (operatorData[network] !== undefined) {
      const currentCount = operatorData._networkCounts[network] || 1;
      const currentSum = operatorData[network] * currentCount;
      operatorData._networkCounts[network] = currentCount + 1;
      operatorData[network] = (currentSum + finalValue) / operatorData._networkCounts[network];
    } else {
      operatorData[network] = finalValue;
      operatorData._networkCounts[network] = 1;
    }
  });

  const result = Object.values(grouped)
    .map(item => {
      const { _networkCounts, ...cleanItem } = item;
      
      const networkKeys = Object.keys(cleanItem).filter(k => k !== 'name');
      const validNetworks = networkKeys.filter(net => {
        const val = cleanItem[net];
        return typeof val === 'number' && !isNaN(val);
      });

      let total = 0;
      if (validNetworks.length > 0) {
        const sum = validNetworks.reduce((acc, net) => acc + cleanItem[net], 0);
        total = sum / validNetworks.length;
      }

      return {
        ...cleanItem,
        total: isNegative ? ensureNegative(total) : total
      };
    })
    .filter(item => {
      const networks = Object.keys(item).filter(k => k !== 'name' && k !== 'total');
      return networks.length > 0;
    })
    .sort((a, b) => isNegative ? a.total - b.total : b.total - a.total);

  return result;
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

const parseDurationToHours = (duration) => {
  if (!duration || typeof duration !== 'string') return 0;
  
  const parts = duration.split(':');
  if (parts.length !== 3) return 0;
  
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  const seconds = parseInt(parts[2], 10) || 0;
  
  return parseFloat((hours + (minutes / 60) + (seconds / 3600)).toFixed(2));
};

// ============================================
// HOOKS
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
  
  const processedData = useMemo(
    () => processMetricData(rawData || [], metric),
    [rawData, metric]
  );
  
  return { data: processedData, ...rest };
};

export const useOperatorMetrics = (metric, filters) => {
  const cacheKey = useMemo(() => createCacheKey('operatorMetricsAll', filters), [filters]);
  const query = useMemo(() => buildQueryString(filters), [filters]);
  
  const { data: rawData, ...rest } = useSWR(
    cacheKey,
    async () => {
      const response = await adminApi.getOperatorSamplesV2?.(query);
      return extractData(response, []);
    },
    { 
      ...SWR_CONFIG, 
      dedupingInterval: CACHE_TIME.MEDIUM,
      fallbackData: [] 
    }
  );
  
  const processedData = useMemo(
    () => processOperatorMetrics(rawData || [], metric),
    [rawData, metric]
  );
  
  return { data: processedData, ...rest };
};

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
  
  const ranking = useMemo(
    () => buildRanking(rawData || [], { nameKey: 'name', countKey: 'count' }),
    [rawData]
  );
  
  return { data: ranking, ...rest };
};

export const useHandsetPerformance = () => {
  const { data: rawData, ...rest } = useSWR(
    'handsetAvg',
    async () => {
      try {
        const response = await adminApi.getHandsetDistributionV2();
        return extractData(response, []);
      } catch (error) {
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
  
  const processedData = useMemo(() => {
    if (!rawData || !Array.isArray(rawData) || rawData.length === 0) {
      return [];
    }

    const processed = rawData.map(item => ({
      Make: item?.name || 'Unknown',
      Avg: ensureNegative(toNumber(item?.avg_rsrp || 0)),
      Samples: toNumber(item?.value || 0),
      AvgRsrq: toNumber(item?.avg_rsrq || 0),
      AvgSinr: toNumber(item?.avg_sinr || 0),
    }));

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
    metrics.length > 0 ? cacheKey : null,
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

/**
 * ✅ APP DATA HOOK - Enhanced with detailed logging
 */
export const useAppData = () => {
  console.log('🚀 [useAppData] Hook called');
  
  const { data: rawData, isLoading, error, ...rest } = useSWR(
    'appData',
    async () => {
      console.log('📡 [useAppData] Fetching from API...');
      const startTime = Date.now();
      
      try {
        const response = await adminApi.getAppValue();
        const elapsed = Date.now() - startTime;
        
        console.log(`✅ [useAppData] API call completed in ${elapsed}ms`, {
          response,
          type: typeof response,
          isArray: Array.isArray(response),
        });
        
        const extracted = extractData(response, []);
        console.log('[useAppData] Extracted data:', {
          type: typeof extracted,
          isArray: Array.isArray(extracted),
          length: Array.isArray(extracted) ? extracted.length : 'N/A',
          sample: Array.isArray(extracted) && extracted.length > 0 ? extracted[0] : null
        });
        
        return extracted;
      } catch (err) {
        console.error('❌ [useAppData] API call failed:', err);
        throw err;
      }
    },
    { 
      ...SWR_CONFIG,
      dedupingInterval: CACHE_TIME.MEDIUM,
      fallbackData: [],
      loadingTimeout: 35000,
      errorRetryInterval: 5000,
      errorRetryCount: 3,
      shouldRetryOnError: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      onSuccess: (data) => {
        console.log('✅ [useAppData] SWR onSuccess:', {
          type: typeof data,
          isArray: Array.isArray(data),
          length: Array.isArray(data) ? data.length : 'N/A'
        });
      },
      onError: (err) => {
        console.error('❌ [useAppData] SWR onError:', err);
      },
    }
  );
  
  console.log('[useAppData] SWR state:', { 
    hasData: !!rawData, 
    isLoading, 
    hasError: !!error,
    dataType: typeof rawData,
    dataLength: Array.isArray(rawData) ? rawData.length : 'N/A'
  });
  
  const processedData = useMemo(() => {
    console.log('🔄 [useAppData] Processing data...', {
      hasRawData: !!rawData,
      isArray: Array.isArray(rawData),
      length: Array.isArray(rawData) ? rawData.length : 'N/A'
    });
    
    if (!Array.isArray(rawData) || rawData.length === 0) {
      console.warn('⚠️ [useAppData] No raw data to process');
      return [];
    }

    console.log('[useAppData] Processing', rawData.length, 'items');
    console.log('[useAppData] Sample raw item:', rawData[0]);
    
    const processed = rawData.map((item, index) => {
      const durationStr = item?.durationHHMMSS || item?.avgDuration || '00:00:00';
      
      const processedItem = {
        // Basic info
        appName: item?.appName || item?.AppName || 'Unknown',
        
        // Sample count
        sampleCount: toNumber(item?.sampleCount || item?.SampleCount || 0),
        
        // Signal quality metrics
        avgRsrp: toNumber(item?.avgRsrp || item?.AvgRsrp || 0),
        avgRsrq: toNumber(item?.avgRsrq || item?.AvgRsrq || 0),
        avgSinr: toNumber(item?.avgSinr || item?.AvgSinr || 0),
        
        // Performance metrics
        avgMos: toNumber(item?.avgMos || item?.AvgMos || 0),
        avgJitter: toNumber(item?.avgJitter || item?.AvgJitter || 0),
        avgLatency: toNumber(item?.avgLatency || item?.AvgLatency || 0),
        avgPacketLoss: toNumber(item?.avgPacketLoss || item?.AvgPacketLoss || 0),
        
        // Throughput
        avgDlTptMbps: toNumber(item?.avgDlTptMbps || item?.AvgDlTptMbps || 0),
        avgUlTptMbps: toNumber(item?.avgUlTptMbps || item?.AvgUlTptMbps || 0),
        
        // Duration
        avgDuration: parseDurationToHours(durationStr),
        avgDurationFormatted: durationStr,
        durationSeconds: toNumber(item?.durationSeconds || 0),
        durationMinutes: toNumber(item?.durationMinutes || 0),
        
        // Timestamps
        firstUsedAt: item?.firstUsedAt,
        lastUsedAt: item?.lastUsedAt,
        usageDate: item?.usageDate,
      };
      
      if (index === 0) {
        console.log('[useAppData] Sample processed item:', processedItem);
      }
      
      return processedItem;
    });

    console.log('✅ [useAppData] Processing complete:', {
      inputCount: rawData.length,
      outputCount: processed.length,
      sample: processed[0]
    });
    
    return processed;
  }, [rawData]);
  
  console.log('[useAppData] Returning:', {
    dataCount: processedData.length,
    isLoading,
    hasError: !!error
  });
  
  return { 
    data: processedData, 
    isLoading,
    error,
    ...rest 
  };
};

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

export const useClearDashboardCache = () => {
  const { cache, mutate } = useSWRConfig();
  
  return useCallback(() => {
    if (cache instanceof Map) {
      cache.clear();
    }
    
    mutate(() => true, undefined, { revalidate: true });
  }, [cache, mutate]);
};

export const useRefreshDashboard = () => {
  const { mutate } = useSWRConfig();
  
  return useCallback(() => {
    mutate(() => true, undefined, { revalidate: true });
  }, [mutate]);
};

export { SWR_CONFIG, CACHE_TIME };