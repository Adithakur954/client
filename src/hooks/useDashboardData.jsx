import useSWR from 'swr';
import { adminApi } from '../api/apiEndpoints';
import { 
  buildQueryString, 
  groupOperatorSamplesByNetwork, 
  buildRanking,
  canonicalOperatorName,
  toNumber,
  ensureNegative
} from '../utils/dashboardUtils';
import { useMemo } from 'react';

export const useTotals = () => {
  return useSWR('totals', async () => {
    const resp = await adminApi.getTotalsV2?.() || {};
    console.log(resp);
    return resp?.Data || resp || {};
  });
};

export const useMonthlySamples = (filters) => {
  return useSWR(
    ['monthlySamples', JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await adminApi.getMonthlySamplesV2?.(queryString) || { Data: [] };
      console.log(resp);
      return resp?.Data || resp || [];
    }
  );
};

export const useOperatorSamples = (filters) => {
  return useSWR(
    ['operatorSamples', JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await adminApi.getOperatorSamplesV2?.(queryString) || { Data: [] };
      console.log(resp);
      const rawData = resp?.Data || resp || [];
      return groupOperatorSamplesByNetwork(rawData);
    }
  );
};

export const useNetworkDistribution = (filters) => {
  return useSWR(
    ['networkDist', JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await adminApi.getNetworkTypeDistributionV2?.(queryString) || { Data: [] };
      console.log(resp);
      return resp?.Data || resp || [];
    }
  );
};

export const useMetricData = (metric, filters) => {
  return useSWR(
    ['metric', metric, JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const endpointMap = {
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
      
      const endpoint = endpointMap[metric];
      if (!endpoint || !adminApi[endpoint]) return [];
      
      const resp = await adminApi[endpoint](queryString) || { Data: [] };
      const rawData = resp?.Data || resp || [];
      
      // Normalize and merge by operator
      const merged = new Map();
      for (const item of rawData) {
        const op = canonicalOperatorName(item?.operatorName || item?.name);
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
        .sort((a, b) => b.value - a.value);
    }
  );
};

// Add this to your useDashboardData.js

export const useOperatorMetrics = (metric, filters) => {
  return useSWR(
    ['operatorMetrics', metric, JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const endpointMap = {
        samples: 'getOperatorSamplesV2',
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
      
      const endpoint = endpointMap[metric];
      if (!endpoint || !adminApi[endpoint]) return [];
      
      const resp = await adminApi[endpoint](queryString) || { Data: [] };
      const rawData = resp?.Data || resp || [];
      
      console.log(`📦 Raw ${metric} data:`, rawData);
      
      // For samples, it's already grouped by network
      if (metric === 'samples') {
        return groupOperatorSamplesByNetwork(rawData);
      }
      
      // For metrics, group by BOTH operator AND network (DON'T MERGE)
      const grouped = {};
      
      rawData.forEach(item => {
        const operatorName = canonicalOperatorName(item?.operatorName || item?.name);
        const network = item?.network;
        const value = toNumber(item?.value);
        
        if (!operatorName || !network) {
          console.warn('Skipping item - missing operator or network:', item);
          return;
        }
        
        // Create unique key: operator + network
        if (!grouped[operatorName]) {
          grouped[operatorName] = { name: operatorName };
        }
        
        // Store value for this network
        grouped[operatorName][network] = ['rsrp', 'rsrq'].includes(metric) 
          ? ensureNegative(value) 
          : value;
      });
      
      // Calculate totals for sorting
      const result = Object.values(grouped).map(item => {
        const networks = Object.keys(item).filter(k => k !== 'name');
        const total = networks.length > 0 
          ? networks.reduce((sum, net) => sum + (item[net] || 0), 0) / networks.length
          : 0;
        return { ...item, total };
      });
      
      // Sort by total
      const isNegativeMetric = ['rsrp', 'rsrq'].includes(metric);
      const sorted = result.sort((a, b) => 
        isNegativeMetric ? a.total - b.total : b.total - a.total
      );
      
      console.log(`✅ Processed ${metric} data:`, sorted);
      return sorted;
    }
  );
};

// Add this new hook to your useDashboardData.js
export const useBandDistributionRaw = (filters) => {
  return useSWR(
    ['bandDistRaw', JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await adminApi.getBandDistributionV2?.(queryString) || { Data: [] };
      const rawData = resp?.Data || resp || [];
      
      console.log('📦 Raw band distribution from API:', rawData);
      
      // Return raw data WITHOUT aggregation to preserve network info
      return rawData;
    }
  );
};

export const useBandDistribution = (filters) => {
  return useSWR(
    ['bandDist', JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await adminApi.getBandDistributionV2?.(queryString) || { Data: [] };
      const rawData = resp?.Data || resp || [];
      
      // Group by band
      const merged = new Map();
      for (const item of rawData) {
        const band = `Band ${item?.band || ''}`;
        const count = toNumber(item?.count);
        merged.set(band, (merged.get(band) || 0) + count);
      }
      
      return Array.from(merged.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    }
  );
};
export const useIndoorCount = () => {
  return useSWR('indoorCount', async () => {
    const resp = await adminApi.getIndoorCount?.() || {};
    console.log('Indoor Count Response:', resp);
    
    // Validate status
    if (resp?.Status === 0) {
      console.error('Indoor count API error');
      return 0;
    }
    
    // Always return a number
    return Number(resp?.Count) || 0;
  });
};

export const useOutdoorCount = () => {
  return useSWR('outdoorCount', async () => {
    const resp = await adminApi.getOutdoorCount?.() || {};
    console.log('Outdoor Count Response:', resp);
    
    if (resp?.Status === 0) {
      console.error('Outdoor count API error');
      return 0;
    }
    
    return Number(resp?.Count) || 0;
  });
};

export const useHandsetPerformance = () => {
  return useSWR('handsetAvg', async () => {
    const resp = await adminApi.getDashboardGraphData();
    const data = resp?.Data?.handsetWiseAvg_bar || resp?.handsetWiseAvg_bar || [];
    return data.map(item => ({
      Make: item?.Make || '',
      Avg: ensureNegative(item?.Avg || 0),
      Samples: toNumber(item?.Samples || 0)
    }));
  });
};

export const useCoverageRanking = (rsrpMin, rsrpMax) => {
  return useSWR(
    ['coverageRank', rsrpMin, rsrpMax],
    async () => {
      const resp = await adminApi.getOperatorCoverageRanking({ min: rsrpMin, max: rsrpMax });
      const payload = resp?.Data ?? resp?.data ?? resp ?? [];
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    }
  );
};

export const useQualityRanking = (rsrqMin, rsrqMax) => {
  return useSWR(
    ['qualityRank', rsrqMin, rsrqMax],
    async () => {
      const resp = await adminApi.getOperatorQualityRanking({ min: rsrqMin, max: rsrqMax });
      const payload = resp?.Data ?? resp?.data ?? resp ?? [];
      return buildRanking(payload, { nameKey: 'name', countKey: 'count' });
    }
  );
};

export const useOperatorsAndNetworks = () => {
  const { data: rawOperators = [], isLoading: operatorsLoading } = useSWR('operators', async () => {
    const resp = await adminApi.getOperatorsV2?.() || { Data: [] };
    return resp?.Data || resp || [];
  });

  const { data: networks = [], isLoading: networksLoading } = useSWR('networks', async () => {
    const resp = await adminApi.getNetworksV2?.() || { Data: [] };
    return resp?.Data || resp || [];
  });

  // Normalize operators - deduplicate by canonical name
  const operators = useMemo(() => {
    if (!rawOperators || rawOperators.length === 0) return [];
    
    const uniqueOperators = new Map();
    
    rawOperators.forEach(op => {
      const canonical = canonicalOperatorName(op);
      // Use the first occurrence of each canonical name
      if (!uniqueOperators.has(canonical) && canonical !== 'Unknown') {
        uniqueOperators.set(canonical, canonical);
      }
    });
    
    // Return array of unique canonical operator names
    return Array.from(uniqueOperators.values());
  }, [rawOperators]);

  // Count of unique normalized operators
  const operatorCount = operators.length;

  return { 
    operators, 
    networks, 
    operatorCount,
    isLoading: operatorsLoading || networksLoading 
  };
};