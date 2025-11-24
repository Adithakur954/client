import React, { useState, useRef, useMemo } from "react";
import useSWR from "swr";
import { BarChart3, Download, Maximize2, Minimize2 } from "lucide-react";
import toast from "react-hot-toast";

// Tabs
import { OverviewTab } from "./tabs/OverviewTab";
import { SignalTab } from "./tabs/SignalTab";
import { NetworkTab } from "./tabs/NetworkTab";
import { PerformanceTab } from "./tabs/PerformanceTab";
import { ApplicationTab } from "./tabs/ApplicationTab";

// Common
import { TabButton } from "./common/TabButton";
import { LoadingSpinner } from "./common/LoadingSpinner";

// Utils
import { calculateStats, calculateIOSummary } from "@/utils/analyticsHelpers";
import { exportAnalytics } from "@/utils/exportService";
import { TABS } from "@/utils/constants";
import { adminApi } from "@/api/apiEndpoints";

export default function UnifiedDetailLogs({
  locations = [],
  totalLocations = 0,
  filteredCount = 0,
  selectedMetric,
  siteData = [],
  siteToggle,
  enableSiteToggle,
  appSummary,
  polygons = [],
  showPolygons,
  projectId,
  sessionIds = [],
  isLoading,
  thresholds,
  logArea,
  onClose,
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // All Chart refs
  const chartRefs = {
    distribution: useRef(null),
    tech: useRef(null),
    radar: useRef(null),
    band: useRef(null),
    operator: useRef(null),
    pciColorLegend: useRef(null),
    providerPerf: useRef(null),
    speed: useRef(null),
    throughputTimeline: useRef(null),
    jitterLatency: useRef(null),
    mosChart: useRef(null),
    throughputChart: useRef(null),
    signalChart: useRef(null),
    qoeChart: useRef(null),
  };

  // Fetch duration
  const fetchDuration = async () => {
    if (!sessionIds?.length) return null;
    const resp = await adminApi.getNetworkDurations({ session_ids: sessionIds });
    return resp?.Data || null;
  };

  const { data: duration } = useSWR(
    sessionIds?.length ? ["network-duration", sessionIds] : null,
    fetchDuration,
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  // Computed values
  const stats = useMemo(
    () => calculateStats(locations, selectedMetric),
    [locations, selectedMetric]
  );

  const ioSummary = useMemo(
    () => calculateIOSummary(logArea),
    [logArea]
  );

  const polygonStats = useMemo(() => {
    if (!polygons?.length) return null;

    const withPoints = polygons.filter(p => p.pointCount > 0);
    const totalPoints = polygons.reduce((sum, p) => sum + (p.pointCount || 0), 0);

    return {
      total: polygons.length,
      withData: withPoints.length,
      totalPoints,
      avgPoints: (totalPoints / withPoints.length || 0).toFixed(1),
    };
  }, [polygons]);

  // Export handler
  const handleExport = () => {
    exportAnalytics({
      locations,
      stats,
      duration,
      appSummary,
      ioSummary,
      projectId,
      sessionIds,
      chartRefs,
      selectedMetric,
      totalLocations,
      filteredCount,
      polygonStats,
      siteData,
    });
  };

  // Debug logs
  React.useEffect(() => {
    console.log("📊 Analytics Data:", {
      locations: locations?.length,
      appSummary: appSummary ? Object.keys(appSummary).length : 0,
      activeTab,
    });
  }, [locations, appSummary, activeTab]);

  // Collapsed state
  if (collapsed) {
    return (
      <div className="fixed bottom-4 left-4 flex gap-2 z-40">
        <button
          onClick={() => setCollapsed(false)}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-slate-800 transition-all flex items-center gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Show Analytics
        </button>
        <button
          onClick={onClose}
          className="bg-red-900 text-white px-3 py-2 rounded-lg shadow-lg hover:bg-red-800 transition-all"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      className={`
        fixed z-40 bg-slate-950 text-white rounded-lg 
        shadow-2xl border border-slate-700 transition-all duration-300
        ${expanded 
          ? "top-20 left-1/2 -translate-x-1/2 w-[95vw] max-w-[1400px]" 
          : "bottom-4 right-4 w-[480px]"
        }
        h-[calc(100%-72px)]
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-900 rounded-t-lg">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          <h3 className="font-semibold">Analytics Dashboard</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!locations?.length}
            className="flex items-center gap-2 text-slate-400 hover:text-green-400 transition-colors p-2 rounded hover:bg-slate-800 disabled:opacity-50"
            title="Export Analytics"
          >
            <Download className="h-4 w-4" />
            <span className="text-xs font-medium hidden lg:inline">Export</span>
          </button>
          
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-blue-400 p-1 rounded hover:bg-slate-800"
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          
          <button
            onClick={() => setCollapsed(true)}
            className="text-slate-400 hover:text-white px-2 py-1 rounded hover:bg-slate-800 font-bold"
          >
            −
          </button>
          
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-800"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-3 bg-slate-900 border-b border-slate-700 overflow-x-auto scrollbar-hide">
        {TABS.map(tab => (
          <TabButton
            key={tab.id}
            active={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </TabButton>
        ))}
      </div>

      {/* Content */}
      <div className={`
        ${expanded ? "max-h-[calc(100vh-200px)]" : "max-h-[70vh]"} 
        overflow-y-auto scrollbar-hide p-4 space-y-4
      `}>
        {isLoading && <LoadingSpinner />}

        {activeTab === "overview" && (
          <OverviewTab
            totalLocations={totalLocations}
            filteredCount={filteredCount}
            siteData={siteData}
            siteToggle={siteToggle}
            enableSiteToggle={enableSiteToggle}
            showPolygons={showPolygons}
            polygonStats={polygonStats}
            stats={stats}
            selectedMetric={selectedMetric}
            ioSummary={ioSummary}
            duration={duration}
            locations={locations}
            expanded={expanded}
          />
        )}

        {activeTab === "signal" && (
          <SignalTab
            locations={locations}
            selectedMetric={selectedMetric}
            thresholds={thresholds}
            expanded={expanded}
            chartRefs={chartRefs}
          />
        )}

        {activeTab === "network" && (
          <NetworkTab
            locations={locations}
            expanded={expanded}
            chartRefs={chartRefs}
          />
        )}

        {activeTab === "performance" && (
          <PerformanceTab
            locations={locations}
            expanded={expanded}
            chartRefs={chartRefs}
          />
        )}

        {activeTab === "Application" && (
          <ApplicationTab
            appSummary={appSummary}
            expanded={expanded}
            chartRefs={chartRefs}
          />
        )}
      </div>
    </div>
  );
}