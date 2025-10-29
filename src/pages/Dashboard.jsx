import React, { useState, useMemo } from 'react';
import { 
  BarChart2, RefreshCw, Users, Car, Waypoints, FileText, 
  Wifi, Radio, Layers 
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

import { 
  useTotals, 
  useOperatorsAndNetworks, 
  useNetworkDistribution, 
  useBandDistribution 
} from '@/hooks/useDashboardData';

const DashboardPage = () => {
  // Individual chart filters
  const [chartFilters, setChartFilters] = useState({});

  // Fetch totals and available operators/networks
  const { data: totalsData, isLoading: isTotalsLoading } = useTotals();
  const { operators, networks, operatorCount } = useOperatorsAndNetworks();
  
  // Fetch additional data for KPIs
  const { data: networkDistData } = useNetworkDistribution({});
  const { data: bandDistData } = useBandDistribution({});

  // Calculate normalized counts for Technologies and Bands
  const technologyCount = useMemo(() => {
    if (!networkDistData || networkDistData.length === 0) return 0;
    
    // Get unique network types
    const uniqueNetworks = new Set(
      networkDistData.map(item => item.network).filter(Boolean)
    );
    
    return uniqueNetworks.size;
  }, [networkDistData]);

  const bandCount = useMemo(() => {
    if (!bandDistData || bandDistData.length === 0) return 0;
    
    // Count unique bands (they're already in "Band XX" format)
    return bandDistData.length;
  }, [bandDistData]);

  // Stats for KPI cards - ALL 7 KPIs
  const stats = useMemo(() => {
    if (!totalsData) return [];
    
    return [
      {
        title: "Total Users",
        value: totalsData.totalUsers,
        icon: Users,
        color: "bg-gradient-to-br from-purple-500 to-purple-600",
        description: "Registered users"
      },
      {
        title: "Drive Sessions",
        value: totalsData.totalSessions,
        icon: Car,
        color: "bg-gradient-to-br from-teal-500 to-teal-600",
        description: "Total drive sessions"
      },
      {
        title: "Online Sessions",
        value: totalsData.totalOnlineSessions,
        icon: Waypoints,
        color: "bg-gradient-to-br from-orange-500 to-orange-600",
        description: "Currently active"
      },
      {
        title: "Total Samples",
        value: totalsData.totalSamples,
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
        title: "Technologies",
        value: technologyCount,
        icon: Radio,
        color: "bg-gradient-to-br from-pink-500 to-pink-600",
        description: "Network types (2G, 3G, 4G, 5G)"
      },
      {
        title: "Bands",
        value: bandCount,
        icon: Layers,
        color: "bg-gradient-to-br from-indigo-500 to-indigo-600",
        description: "Frequency bands detected"
      },
    ];
  }, [totalsData, operatorCount, technologyCount, bandCount]);

  const handleChartFilterChange = (chartKey, newFilters) => {
    setChartFilters(prev => ({
      ...prev,
      [chartKey]: newFilters
    }));
  };

  const handleRefreshAll = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      <div className="max-w-[1920px] mx-auto p-6 space-y-6">
        {/* Header */}
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

        {/* KPIs - ALL 7 with Flex Wrap for Responsive Design */}
        <div className="flex flex-wrap gap-6">
          {isTotalsLoading ? (
            Array.from({ length: 7 }).map((_, i) => (
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Samples */}
          <MonthlySamplesChart
            chartFilters={chartFilters['monthlySamples']}
            onChartFiltersChange={(f) => handleChartFilterChange('monthlySamples', f)}
            operators={operators}
            networks={networks}
          />

          {/* Operator Network Distribution */}
          <OperatorNetworkChart
            chartFilters={chartFilters['operatorSamples']}
            onChartFiltersChange={(f) => handleChartFilterChange('operatorSamples', f)}
            operators={operators}
            networks={networks}
          />

          {/* Network Type Distribution */}
          <NetworkDistributionChart
            chartFilters={chartFilters['networkDist']}
            onChartFiltersChange={(f) => handleChartFilterChange('networkDist', f)}
            operators={operators}
            networks={networks}
          />

          {/* Dynamic Metric Chart */}
          <MetricChart
            chartFilters={chartFilters['metric']}
            onChartFiltersChange={(f) => handleChartFilterChange('metric', f)}
            operators={operators}
            networks={networks}
          />

          {/* Band Distribution */}
          <BandDistributionChart
            chartFilters={chartFilters['bandDist']}
            onChartFiltersChange={(f) => handleChartFilterChange('bandDist', f)}
            operators={operators}
            networks={networks}
          />

          {/* Handset Performance */}
          <HandsetPerformanceChart />

          {/* Coverage Ranking */}
          <CoverageRankingChart />

          {/* Quality Ranking */}
          <QualityRankingChart />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;