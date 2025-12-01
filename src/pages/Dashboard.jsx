// src/pages/Dashboard.jsx
import React, { useMemo } from 'react';
import { 
  BarChart2, RefreshCw, Users, Car, Waypoints, FileText, 
  Wifi, Radio, Layers, Home, MapPin 
} from 'lucide-react';

import MonthlySamplesChart from '@/components/dashboard/charts/MonthlySamplesChart';
import OperatorNetworkChart from '@/components/dashboard/charts/OperatorNetworkChart';
import NetworkDistributionChart from '@/components/dashboard/charts/NetworkDistributionChart';
import MetricChart from '@/components/dashboard/charts/MetricChart';
import BandDistributionChart from '@/components/dashboard/charts/BandDistributionChart';
import HandsetPerformanceChart from '@/components/dashboard/charts/HandsetPerformanceChart';
import CoverageRankingChart from '@/components/dashboard/charts/CoverageRankingChart';
import QualityRankingChart from '@/components/dashboard/charts/QualityRankingChart';
import StatCardSkeleton from '@/components/dashboard/skeletons/StatCardSkeleton';
import { StatCard } from '@/components/dashboard';
import AppChart from '@/components/dashboard/charts/AppChart';

import { 
  useTotals, 
  useOperatorsAndNetworks, 
  useBandCount,
  useIndoorCount,
  useOutdoorCount,
  useClearDashboardCache
} from '@/hooks/useDashboardData.js';

import { usePersistedFilters, clearAllPersistedFilters } from '@/hooks/usePersistedFilters';

const DashboardPage = () => {
  // Persisted filters for each chart
  const [monthlySamplesFilters, setMonthlySamplesFilters] = usePersistedFilters('monthlySamples');
  const [operatorSamplesFilters, setOperatorSamplesFilters] = usePersistedFilters('operatorSamples');
  const [metricFilters, setMetricFilters] = usePersistedFilters('metric');
  const [bandDistFilters, setBandDistFilters] = usePersistedFilters('bandDist');

  // Fetch data using hooks
  const { data: totalsData, isLoading: isTotalsLoading } = useTotals();
  const { operators, networks, operatorCount, isLoading: isOperatorsLoading } = useOperatorsAndNetworks();
  const { data: bandCount, isLoading: isBandCountLoading } = useBandCount();
  const { data: indoorCount, isLoading: isIndoorLoading } = useIndoorCount();
  const { data: outdoorCount, isLoading: isOutdoorLoading } = useOutdoorCount();
  
  // Cache clear function
  const clearCache = useClearDashboardCache();

  // Calculate total samples
  const totalLocationSamples = useMemo(() => {
    return (Number(indoorCount) || 0) + (Number(outdoorCount) || 0);
  }, [indoorCount, outdoorCount]);

  // Check if any KPI data is loading
  const isKPILoading = isTotalsLoading || isOperatorsLoading || isBandCountLoading || isIndoorLoading || isOutdoorLoading;

  // Stats for KPI cards
  const stats = useMemo(() => {
    const totals = totalsData || {};
    
    return [
      {
        title: "Total Users",
        value: totals.totalUsers ?? totals.TotalUsers ?? 0,
        icon: Users,
        color: "bg-gradient-to-br from-purple-500 to-purple-600",
        description: "Registered users"
      },
      {
        title: "Drive Sessions",
        value: totals.totalSessions ?? totals.TotalSessions ?? 0,
        icon: Car,
        color: "bg-gradient-to-br from-teal-500 to-teal-600",
        description: "Total drive sessions"
      },
      {
        title: "Online Sessions",
        value: totals.totalOnlineSessions ?? totals.TotalOnlineSessions ?? 0,
        icon: Waypoints,
        color: "bg-gradient-to-br from-orange-500 to-orange-600",
        description: "Currently active"
      },
      {
        title: "Total Samples",
        value: totalLocationSamples,
        icon: FileText,
        color: "bg-gradient-to-br from-amber-500 to-amber-600",
        description: "Network log samples"
      },
      {
        title: "Operators",
        value: operatorCount || 0,
        icon: Wifi,
        color: "bg-gradient-to-br from-sky-500 to-sky-600",
        description: "Unique network operators"
      },
      {
        title: "Bands",
        value: bandCount || 0,
        icon: Layers,
        color: "bg-gradient-to-br from-indigo-500 to-indigo-600",
        description: "Frequency bands detected"
      },
      {
        title: "Indoor Samples",
        value: indoorCount || 0,
        icon: Home,
        color: "bg-gradient-to-br from-green-500 to-green-600",
        description: "Indoor measurements"
      },
      {
        title: "Outdoor Samples",
        value: outdoorCount || 0,
        icon: MapPin,
        color: "bg-gradient-to-br from-blue-500 to-blue-600",
        description: "Outdoor measurements"
      },
    ];
  }, [totalsData, operatorCount, bandCount, indoorCount, outdoorCount, totalLocationSamples]);

  // Handle refresh all
  const handleRefreshAll = () => {
    // Clear SWR cache
    clearCache();
    
    // Clear localStorage cache
    localStorage.removeItem('swr-cache');
    localStorage.removeItem('app-swr-cache');
    
    // Clear all persisted filters
    clearAllPersistedFilters();
    
    // Reload page
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-[1920px] mx-auto p-6 space-y-6">
       
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
                <BarChart2 className="h-6 w-6 text-white" />
              </div>
              Dashboard Analytics
            </h1>
          </div>
          <button
            onClick={handleRefreshAll}
            className="px-5 py-2.5 rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 flex items-center gap-2 transition-all font-medium shadow-sm hover:shadow-md"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh All
          </button>
        </div>

        {/* KPI Cards */}
        <div className="flex flex-wrap gap-6">
          {isKPILoading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-1 min-w-[280px] max-w-[320px]">
                <StatCardSkeleton />
              </div>
            ))
          ) : (
            stats.map(s => (
              <div key={s.title} className="flex-1 min-w-[280px] max-w-[320px]">
                <StatCard {...s} />
              </div>
            ))
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MonthlySamplesChart
            chartFilters={monthlySamplesFilters}
            onChartFiltersChange={setMonthlySamplesFilters}
            operators={operators}
            networks={networks}
          />

          <OperatorNetworkChart
            chartFilters={operatorSamplesFilters}
            onChartFiltersChange={setOperatorSamplesFilters}
            operators={operators}
            networks={networks}
          />

          <AppChart />

          <MetricChart
            chartFilters={metricFilters}
            onChartFiltersChange={setMetricFilters}
            operators={operators}
            networks={networks}
          />

          <BandDistributionChart
            chartFilters={bandDistFilters}
            onChartFiltersChange={setBandDistFilters}
            operators={operators}
            networks={networks}
          />

          <HandsetPerformanceChart />
          <CoverageRankingChart />
          <QualityRankingChart />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;