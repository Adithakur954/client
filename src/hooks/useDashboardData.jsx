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
    return resp?.Data || resp || {};
  });
};

export const useMonthlySamples = (filters) => {
  return useSWR(
    ['monthlySamples', JSON.stringify(filters)],
    async () => {
      const queryString = buildQueryString(filters);
      const resp = await adminApi.getMonthlySamplesV2?.(queryString) || { Data: [] };
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