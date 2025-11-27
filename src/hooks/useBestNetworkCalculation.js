// src/hooks/useBestNetworkCalculation.js
import { useMemo } from 'react';

// Normalization ranges for each metric
const METRIC_RANGES = {
  rsrp: { min: -140, max: -44, higherIsBetter: true },
  rsrq: { min: -20, max: -3, higherIsBetter: true },
  sinr: { min: -10, max: 30, higherIsBetter: true },
};

/**
 * Normalize a metric value to 0-100 scale
 */
const normalizeMetric = (value, metricKey) => {
  const range = METRIC_RANGES[metricKey];
  if (!range || value === null || value === undefined || isNaN(value)) {
    return null;
  }

  const { min, max, higherIsBetter } = range;
  let normalized = ((value - min) / (max - min)) * 100;
  normalized = Math.max(0, Math.min(100, normalized));

  return higherIsBetter ? normalized : 100 - normalized;
};

/**
 * Calculate weighted score for a data point
 */
const calculateWeightedScore = (point, weights) => {
  const rsrpNorm = normalizeMetric(point.rsrp, 'rsrp');
  const rsrqNorm = normalizeMetric(point.rsrq, 'rsrq');
  const sinrNorm = normalizeMetric(point.sinr, 'sinr');

  if (rsrpNorm === null && rsrqNorm === null && sinrNorm === null) {
    return null;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  if (rsrpNorm !== null) {
    weightedSum += rsrpNorm * (weights.rsrp / 100);
    totalWeight += weights.rsrp / 100;
  }
  if (rsrqNorm !== null) {
    weightedSum += rsrqNorm * (weights.rsrq / 100);
    totalWeight += weights.rsrq / 100;
  }
  if (sinrNorm !== null) {
    weightedSum += sinrNorm * (weights.sinr / 100);
    totalWeight += weights.sinr / 100;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : null;
};

/**
 * Group points by location (lat/lng grid) and find best provider at each
 */
const groupByLocation = (points, gridSize = 0.0001) => {
  const groups = new Map();

  points.forEach(point => {
    if (!point.latitude || !point.longitude || !point.provider) return;

    const gridLat = Math.round(point.latitude / gridSize) * gridSize;
    const gridLng = Math.round(point.longitude / gridSize) * gridSize;
    const key = `${gridLat.toFixed(6)},${gridLng.toFixed(6)}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(point);
  });

  return groups;
};

/**
 * Main hook for best network calculation
 */
export const useBestNetworkCalculation = (data, weights, enabled) => {
  return useMemo(() => {
    if (!enabled || !data || data.length === 0) {
      return {
        processedData: data || [],
        stats: {},
        providerColors: {},
      };
    }

    console.log('🏆 Calculating best network with weights:', weights);

    // Define provider colors
    const providerColorMap = {
      'AT&T': '#00A8E0',
      'Verizon': '#CD040B',
      'T-Mobile': '#E20074',
      'Sprint': '#FFCE00',
      'US Cellular': '#00953B',
      // Add more providers as needed
    };

    // Assign colors to unknown providers
    const unknownColors = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6'];
    let colorIndex = 0;
    const getProviderColor = (provider) => {
      if (providerColorMap[provider]) return providerColorMap[provider];
      if (!providerColorMap[provider]) {
        providerColorMap[provider] = unknownColors[colorIndex % unknownColors.length];
        colorIndex++;
      }
      return providerColorMap[provider];
    };

    // Calculate scores for all points
    const scoredData = data.map(point => ({
      ...point,
      networkScore: calculateWeightedScore(point, weights),
    }));

    // Group by location
    const locationGroups = groupByLocation(scoredData);

    // Find best provider at each location
    const bestProviderByLocation = new Map();
    const providerStats = {};

    locationGroups.forEach((points, locationKey) => {
      // Group points by provider at this location
      const byProvider = {};
      points.forEach(p => {
        if (!p.provider || p.networkScore === null) return;
        if (!byProvider[p.provider]) {
          byProvider[p.provider] = { scores: [], count: 0 };
        }
        byProvider[p.provider].scores.push(p.networkScore);
        byProvider[p.provider].count++;
      });

      // Find provider with highest average score
      let bestProvider = null;
      let bestAvgScore = -Infinity;

      Object.entries(byProvider).forEach(([provider, data]) => {
        const avgScore = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
        if (avgScore > bestAvgScore) {
          bestAvgScore = avgScore;
          bestProvider = provider;
        }
      });

      if (bestProvider) {
        bestProviderByLocation.set(locationKey, { provider: bestProvider, score: bestAvgScore });

        // Update stats
        if (!providerStats[bestProvider]) {
          providerStats[bestProvider] = { count: 0, totalScore: 0, locations: 0 };
        }
        providerStats[bestProvider].locations++;
        providerStats[bestProvider].totalScore += bestAvgScore;
      }
    });

    // Calculate final stats with percentages
    const totalLocations = bestProviderByLocation.size;
    const finalStats = {};

    Object.entries(providerStats).forEach(([provider, stats]) => {
      finalStats[provider] = {
        count: stats.locations,
        percentage: totalLocations > 0 ? (stats.locations / totalLocations) * 100 : 0,
        avgScore: stats.locations > 0 ? stats.totalScore / stats.locations : 0,
      };
    });

    // Add isBestNetwork flag to each point
    const processedData = scoredData.map(point => {
      if (!point.latitude || !point.longitude) return point;

      const gridSize = 0.0001;
      const gridLat = Math.round(point.latitude / gridSize) * gridSize;
      const gridLng = Math.round(point.longitude / gridSize) * gridSize;
      const key = `${gridLat.toFixed(6)},${gridLng.toFixed(6)}`;

      const bestAtLocation = bestProviderByLocation.get(key);
      const isBestNetwork = bestAtLocation && point.provider === bestAtLocation.provider;

      return {
        ...point,
        isBestNetwork,
        bestNetworkColor: isBestNetwork ? getProviderColor(point.provider) : '#666666',
      };
    });

    console.log('🏆 Best network stats:', finalStats);

    return {
      processedData,
      stats: finalStats,
      providerColors: providerColorMap,
    };
  }, [data, weights, enabled]);
};

export default useBestNetworkCalculation;