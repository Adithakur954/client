// src/pages/Dashboard.jsx

import React, { useState, useMemo } from 'react';
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
  useNetworkDistribution, 
  useBandDistribution,
  useIndoorCount,
  useOutdoorCount
} from '@/hooks/useDashboardData';

import { usePersistedFilters, clearAllPersistedFilters } from '@/hooks/usePersistedFilters'; // ✅ Import

const DashboardPage = () => {
  // ✅ Use persisted filters for each chart
  const [monthlySamplesFilters, setMonthlySamplesFilters] = usePersistedFilters('monthlySamples');
  const [operatorSamplesFilters, setOperatorSamplesFilters] = usePersistedFilters('operatorSamples');
  const [metricFilters, setMetricFilters] = usePersistedFilters('metric');
  const [bandDistFilters, setBandDistFilters] = usePersistedFilters('bandDist');

  // Fetch totals and available operators/networks
  const { data: totalsData = {}, isLoading: isTotalsLoading } = useTotals();
  const { operators = [], networks = [], operatorCount = 0 } = useOperatorsAndNetworks();
  
  // Fetch additional data for KPIs
  const { data: networkDistData = [] } = useNetworkDistribution({});
  const { data: bandDistData = [] } = useBandDistribution({});
  
  // Fetch indoor and outdoor counts
  const { data: indoorData = {}, isLoading: isIndoorLoading } = useIndoorCount();
  const { data: outdoorData = {}, isLoading: isOutdoorLoading } = useOutdoorCount();

  // Calculate normalized counts for Bands
  const bandCount = useMemo(() => {
    if (!bandDistData || bandDistData.length === 0) return 0;
    return bandDistData.length;
  }, [bandDistData]);

  const totalLocationSamples = (Number(indoorData) || 0) + (Number(outdoorData) || 0);

  // Check if any KPI data is loading
  const isKPILoading = isTotalsLoading || isIndoorLoading || isOutdoorLoading;

  // Stats for KPI cards
  const stats = useMemo(() => {
    return [
      {
        title: "Total Users",
        value: totalsData?.totalUsers ?? 0,
        icon: Users,
        color: "bg-gradient-to-br from-purple-500 to-purple-600",
        description: "Registered users"
      },
      {
        title: "Drive Sessions",
        value: totalsData?.totalSessions ?? 0,
        icon: Car,
        color: "bg-gradient-to-br from-teal-500 to-teal-600",
        description: "Total drive sessions"
      },
      {
        title: "Online Sessions",
        value: totalsData?.totalOnlineSessions ?? 0,
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
        value: operatorCount,
        icon: Wifi,
        color: "bg-gradient-to-br from-sky-500 to-sky-600",
        description: "Unique network operators"
      },
      {
        title: "Bands",
        value: bandCount,
        icon: Layers,
        color: "bg-gradient-to-br from-indigo-500 to-indigo-600",
        description: "Frequency bands detected"
      },
      {
        title: "Indoor Samples",
        value: indoorData,
        icon: Home,
        color: "bg-gradient-to-br from-green-500 to-green-600",
        description: "Indoor measurements"
      },
      {
        title: "Outdoor Samples",
        value: outdoorData,
        icon: MapPin,
        color: "bg-gradient-to-br from-blue-500 to-blue-600",
        description: "Outdoor measurements"
      },
    ];
  }, [totalsData, operatorCount, bandCount, indoorData, outdoorData, totalLocationSamples]);

  // ✅ Handle refresh all - clear cache and filters
  const handleRefreshAll = () => {
    // Clear SWR cache
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

        {/* Charts Grid - ✅ Using persisted filters */}
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