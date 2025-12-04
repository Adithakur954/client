import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapPin,
  Activity,
  Layers,
  Clock,
  Antenna,
  Wifi,
  AlertCircle,
  Download,
  Upload,
} from "lucide-react";
import { StatCard } from "../common/StatCard";
import { PCI_COLOR_PALETTE } from "@/components/map/layers/MultiColorCirclesLayer";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { mapViewApi } from "@/api/apiEndpoints";

export const OverviewTab = ({
  totalLocations,
  filteredCount,
  siteData,
  siteToggle,
  enableSiteToggle,
  showPolygons,
  polygonStats,
  stats,
  selectedMetric,
  ioSummary,
  duration,
  locations,
  expanded,
  tptVolume,
}) => {
  const [searchParams] = useSearchParams();
  const [providerVolume, setProviderVolume] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sessionParam = searchParams.get("session");

  const sessionIds = useMemo(() => {
    if (!sessionParam) return [];
    const ids = sessionParam
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id);
    return ids;
  }, [sessionParam]);

  // Helper function to check if value is "unknown" or empty
  const isUnknownOrEmpty = (value) => {
    if (!value) return true;
    const normalized = value.toString().trim().toLowerCase();
    return normalized === "unknown" || normalized === "" || normalized === "null" || normalized === "undefined";
  };

  const fetchVolumeData = useCallback(async () => {
    if (!sessionIds.length) {
      setProviderVolume({});
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await mapViewApi.getproviderVolume({
        session_ids: sessionIds.join(","),
      });

      console.log("Raw API Response:", response);

      if (response?.status === 0) {
        throw new Error(response.message || "Failed to fetch volume data");
      }

      const volumeData =
        response?.data?.tpt_provider_summary ||
        response?.tpt_provider_summary ||
        {};

      console.log("Extracted volume data:", volumeData);

      if (Object.keys(volumeData).length > 0) {
        toast.success(
          `Volume data loaded for ${Object.keys(volumeData).length} session(s)`
        );
        setProviderVolume(volumeData);
      } else {
        toast.warn("No volume data available");
        setProviderVolume({});
      }
    } catch (error) {
      console.error("Volume data fetch error:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to fetch volume data";
      setError(errorMessage);
      toast.error(errorMessage);
      setProviderVolume({});
    } finally {
      setLoading(false);
    }
  }, [sessionIds]);

  useEffect(() => {
    if (sessionIds.length > 0) {
      fetchVolumeData();
    } else {
      setProviderVolume({});
      setError(null);
    }
  }, [sessionIds.length]);

  const topPCIs = useMemo(() => {
    if (!locations?.length || selectedMetric !== "pci") return [];

    const pciCounts = locations.reduce((acc, loc) => {
      const pci = loc.pci;
      if (pci != null) {
        acc[pci] = (acc[pci] || 0) + 1;
      }
      return acc;
    }, {});

    return Object.entries(pciCounts)
      .map(([pci, count]) => ({
        pci: parseInt(pci),
        count,
        color: PCI_COLOR_PALETTE[parseInt(pci) % PCI_COLOR_PALETTE.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [locations, selectedMetric]);

  const volume = useMemo(() => {
    if (!tptVolume) return null;

    if (typeof tptVolume.dl_kb === "number") {
      return {
        dlMb: (tptVolume.dl_kb / 1024 / 1024).toFixed(2),
        ulMb: (tptVolume.ul_kb / 1024 / 1024).toFixed(2),
      };
    }

    let totalDlKb = 0;
    let totalUlKb = 0;

    Object.values(tptVolume).forEach((item) => {
      if (item && typeof item === "object") {
        totalDlKb += item?.dl_kb || 0;
        totalUlKb += item?.ul_kb || 0;
      }
    });

    return {
      dlMb: (totalDlKb / 1024 / 1024).toFixed(2),
      ulMb: (totalUlKb / 1024 / 1024).toFixed(2),
    };
  }, [tptVolume]);

  const sessionWiseVolume = useMemo(() => {
    if (!tptVolume || typeof tptVolume.dl_kb === "number") return null;

    return Object.entries(tptVolume)
      .filter(([_, item]) => item && typeof item === "object")
      .map(([session, item]) => ({
        session,
        dl: ((item?.dl_kb || 0) / 1024 / 1024).toFixed(2),
        ul: ((item?.ul_kb || 0) / 1024 / 1024).toFixed(2),
      }));
  }, [tptVolume]);

  // Process provider volume data - GROUP BY PROVIDER + TECHNOLOGY (not session-wise)
  // Filter out "Unknown" providers and technologies
  const processedProviderVolume = useMemo(() => {
    if (!providerVolume || Object.keys(providerVolume).length === 0) {
      return null;
    }

    // Aggregate by provider + technology
    const aggregated = {};

    // Structure: { sessionId: { provider: { tech: { dl_kb, ul_kb } } } }
    Object.entries(providerVolume).forEach(([sessionId, providers]) => {
      if (typeof providers !== "object" || providers === null) return;

      Object.entries(providers).forEach(([provider, techs]) => {
        if (typeof techs !== "object" || techs === null) return;

        // Skip unknown providers
        if (isUnknownOrEmpty(provider)) return;

        Object.entries(techs).forEach(([tech, volumeData]) => {
          // Skip unknown technologies
          if (isUnknownOrEmpty(tech)) return;

          if (
            volumeData &&
            typeof volumeData === "object" &&
            ("dl_kb" in volumeData || "ul_kb" in volumeData)
          ) {
            // Create unique key for provider + technology
            const key = `${provider.toLowerCase()}_${tech.toUpperCase()}`;

            if (!aggregated[key]) {
              aggregated[key] = {
                provider: provider,
                technology: tech,
                downloadKb: 0,
                uploadKb: 0,
                sessionCount: 0,
                sessions: [],
              };
            }

            aggregated[key].downloadKb += volumeData?.dl_kb || 0;
            aggregated[key].uploadKb += volumeData?.ul_kb || 0;
            aggregated[key].sessionCount += 1;
            if (!aggregated[key].sessions.includes(sessionId)) {
              aggregated[key].sessions.push(sessionId);
            }
          }
        });
      });
    });

    // Convert to array and calculate GB values
    const processed = Object.values(aggregated).map((item) => ({
      provider: item.provider,
      technology: item.technology,
      downloadGb: (item.downloadKb / 1024 / 1024).toFixed(2),
      uploadGb: (item.uploadKb / 1024 / 1024).toFixed(2),
      totalGb: ((item.downloadKb + item.uploadKb) / 1024 / 1024).toFixed(2),
      sessionCount: item.sessionCount,
      sessions: item.sessions,
    }));

    // Sort by provider name, then by technology
    processed.sort((a, b) => {
      const providerCompare = a.provider.localeCompare(b.provider);
      if (providerCompare !== 0) return providerCompare;
      return a.technology.localeCompare(b.technology);
    });

    return processed.length > 0 ? processed : null;
  }, [providerVolume]);

  // Calculate summary statistics (excluding unknown)
  const volumeSummaryStats = useMemo(() => {
    if (!processedProviderVolume || processedProviderVolume.length === 0)
      return null;

    const totalDownload = processedProviderVolume.reduce(
      (sum, item) => sum + parseFloat(item.downloadGb || 0),
      0
    );
    const totalUpload = processedProviderVolume.reduce(
      (sum, item) => sum + parseFloat(item.uploadGb || 0),
      0
    );

    // Group by provider (excluding unknown)
    const byProvider = {};
    processedProviderVolume.forEach((item) => {
      if (isUnknownOrEmpty(item.provider)) return;
      
      const providerKey = item.provider.toLowerCase();
      if (!byProvider[providerKey]) {
        byProvider[providerKey] = {
          name: item.provider,
          download: 0,
          upload: 0,
          technologies: [],
        };
      }
      byProvider[providerKey].download += parseFloat(item.downloadGb || 0);
      byProvider[providerKey].upload += parseFloat(item.uploadGb || 0);
      if (!byProvider[providerKey].technologies.includes(item.technology)) {
        byProvider[providerKey].technologies.push(item.technology);
      }
    });

    // Group by technology (excluding unknown)
    const byTech = {};
    processedProviderVolume.forEach((item) => {
      if (isUnknownOrEmpty(item.technology)) return;
      
      const techKey = item.technology.toUpperCase();
      if (!byTech[techKey]) {
        byTech[techKey] = { download: 0, upload: 0 };
      }
      byTech[techKey].download += parseFloat(item.downloadGb || 0);
      byTech[techKey].upload += parseFloat(item.uploadGb || 0);
    });

    return {
      totalDownload: totalDownload.toFixed(2),
      totalUpload: totalUpload.toFixed(2),
      totalData: (totalDownload + totalUpload).toFixed(2),
      byProvider,
      byTech,
      sessionsCount: sessionIds.length,
    };
  }, [processedProviderVolume, sessionIds]);

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}

      {/* Key Metrics */}
      <div className={`grid ${expanded ? "grid-cols-4" : "grid-cols-2"} gap-3`}>
        <StatCard
          icon={MapPin}
          label="Total Samples"
          value={totalLocations.toLocaleString()}
          color="blue"
        />
        <StatCard
          icon={Activity}
          label="Displayed"
          value={filteredCount.toLocaleString()}
          color="green"
        />

        {enableSiteToggle && (
          <StatCard
            icon={Layers}
            label="Sites"
            value={siteData.length}
            subValue={siteToggle}
            color="purple"
          />
        )}

        {showPolygons && polygonStats && (
          <StatCard
            icon={Layers}
            label="Polygons"
            value={polygonStats.total}
            subValue={`${polygonStats.withData} with data`}
            color="orange"
          />
        )}
      </div>

      {/* Statistics */}
      {stats && (
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {selectedMetric?.toUpperCase() || "METRIC"} Statistics
          </h4>

          <div
            className={`grid ${expanded ? "grid-cols-5" : "grid-cols-3"} gap-3`}
          >
            <MetricCard label="Average" value={stats.avg} />
            <MetricCard label="Minimum" value={stats.min} color="blue" />
            <MetricCard label="Maximum" value={stats.max} color="green" />
            <MetricCard label="Median" value={stats.median} color="purple" />
            <MetricCard label="Count" value={stats.count} color="yellow" raw />
          </div>
        </div>
      )}

      {/* Indoor/Outdoor Distribution */}
      {ioSummary && (ioSummary.indoor > 0 || ioSummary.outdoor > 0) && (
        <IODistributionCard ioSummary={ioSummary} />
      )}

      {/* PCI Color Reference */}
      {selectedMetric === "pci" && topPCIs.length > 0 && (
        <PCIReferenceCard topPCIs={topPCIs} />
      )}

      {/* Session Duration */}
      {duration && <SessionDurationCard duration={duration} />}

      {/* Data Volume */}
      {volume && (
        <DataVolumeCard volume={volume} sessionWiseVolume={sessionWiseVolume} />
      )}

      {/* Provider Volume by Technology - Aggregated */}
      {sessionIds.length > 0 && (
        <ProviderVolumeCard
          providerVolume={processedProviderVolume}
          summaryStats={volumeSummaryStats}
          loading={loading}
          sessionIds={sessionIds}
          error={error}
        />
      )}
    </div>
  );
};

// ============ SUB-COMPONENTS ============

const MetricCard = ({ label, value, color = "white", raw = false }) => {
  const colorClasses = {
    white: "text-white",
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
  };

  return (
    <div className="bg-slate-800 rounded p-3 text-center hover:bg-slate-750 transition-colors">
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className={`text-xl font-bold ${colorClasses[color]}`}>
        {raw ? value : typeof value === "number" ? value.toFixed(2) : "N/A"}
      </div>
    </div>
  );
};

const IODistributionCard = ({ ioSummary }) => (
  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
    <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
      <MapPin className="h-4 w-4" />
      Indoor/Outdoor Distribution
    </h4>

    <div className="grid grid-cols-2 gap-3">
      {ioSummary.indoor > 0 && (
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 rounded-lg p-4 hover:shadow-lg hover:shadow-cyan-500/10 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-cyan-500/20 p-2.5 rounded-lg">
              <svg
                className="h-6 w-6 text-cyan-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs text-cyan-300/70 font-medium">
                Indoor Samples
              </div>
              <div className="text-2xl font-bold text-cyan-400">
                {ioSummary.indoor.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-cyan-500/20">
            <span className="text-xs text-slate-400">Percentage</span>
            <span className="text-sm font-semibold text-cyan-400">
              {((ioSummary.indoor / ioSummary.total) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {ioSummary.outdoor > 0 && (
        <div className="bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/30 rounded-lg p-4 hover:shadow-lg hover:shadow-green-500/10 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-500/20 p-2.5 rounded-lg">
              <svg
                className="h-6 w-6 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 18 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <div className="text-xs text-green-300/70 font-medium">
                Outdoor Samples
              </div>
              <div className="text-2xl font-bold text-green-400">
                {ioSummary.outdoor.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-green-500/20">
            <span className="text-xs text-slate-400">Percentage</span>
            <span className="text-sm font-semibold text-green-400">
              {((ioSummary.outdoor / ioSummary.total) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  </div>
);

const PCIReferenceCard = ({ topPCIs }) => (
  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
    <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
      <Antenna className="h-4 w-4" />
      PCI Color Reference
    </h4>

    <div className="text-xs text-slate-400 mb-2">
      Top 10 PCIs in Current View
    </div>
    <div className="grid grid-cols-5 gap-1.5">
      {topPCIs.map((item, idx) => (
        <div
          key={idx}
          className="flex items-center gap-1 bg-slate-800 p-1.5 rounded text-[10px] hover:bg-slate-750 transition-colors"
        >
          <div
            className="w-4 h-4 rounded-full border border-slate-600 flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold truncate">
              PCI {item.pci}
            </div>
            <div className="text-slate-400">{item.count} pts</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const SessionDurationCard = ({ duration }) => (
  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
    <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
      <Clock className="h-4 w-4" />
      Session Information
    </h4>
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="bg-slate-800 p-3 rounded hover:bg-slate-750 transition-colors">
        <div className="text-slate-400 text-xs mb-1">Duration</div>
        <div className="text-white font-semibold">
          {duration.total_duration || "N/A"}
        </div>
      </div>
      <div className="bg-slate-800 p-3 rounded hover:bg-slate-750 transition-colors">
        <div className="text-slate-400 text-xs mb-1">Start Time</div>
        <div className="text-white font-semibold">
          {duration.start_time
            ? new Date(duration.start_time).toLocaleTimeString()
            : "N/A"}
        </div>
      </div>
    </div>
  </div>
);

const DataVolumeCard = ({ volume, sessionWiseVolume }) => (
  <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
    <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
      <Activity className="h-4 w-4" />
      Data Volume (Total)
    </h4>

    <div className="grid grid-cols-2 gap-3 text-sm">
      <div className="bg-slate-800 p-3 rounded hover:bg-slate-750 transition-colors">
        <div className="text-slate-400 text-xs mb-1">Download Volume (GB)</div>
        <div className="text-white font-semibold">{volume.dlMb || "N/A"}</div>
      </div>
      <div className="bg-slate-800 p-3 rounded hover:bg-slate-750 transition-colors">
        <div className="text-slate-400 text-xs mb-1">Upload Volume (GB)</div>
        <div className="text-white font-semibold">{volume.ulMb || "N/A"}</div>
      </div>
    </div>

    {sessionWiseVolume && sessionWiseVolume.length > 0 && (
      <div className="mt-4">
        <h5 className="text-sm font-semibold text-slate-200 mb-2">
          Session-wise Volume (GB)
        </h5>
        <div className="overflow-x-auto bg-slate-800/50 rounded">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left px-3 py-2 text-slate-400 font-medium">
                  Session
                </th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">
                  Upload
                </th>
                <th className="text-right px-3 py-2 text-slate-400 font-medium">
                  Download
                </th>
              </tr>
            </thead>
            <tbody>
              {sessionWiseVolume.map((item, idx) => (
                <tr
                  key={idx}
                  className="border-b border-slate-800 hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-3 py-2 text-slate-300">{item.session}</td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {item.ul}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-300">
                    {item.dl}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )}
  </div>
);

// Provider Volume Card - Aggregated by Provider + Technology (excluding Unknown)
const ProviderVolumeCard = ({
  providerVolume,
  summaryStats,
  loading,
  sessionIds,
  error,
}) => {
  const getTechColor = (tech) => {
    const techColors = {
      "2G": "text-orange-400",
      "3G": "text-yellow-400",
      "4G": "text-blue-400",
      "5G": "text-purple-400",
      LTE: "text-blue-400",
      WCDMA: "text-yellow-400",
      GSM: "text-orange-400",
      NR: "text-purple-400",
    };
    return techColors[tech?.toUpperCase()] || "text-slate-400";
  };

  const getTechBadgeColor = (tech) => {
    const techBadgeColors = {
      "2G": "bg-orange-500/20 border-orange-500/30 text-orange-400",
      "3G": "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
      "4G": "bg-blue-500/20 border-blue-500/30 text-blue-400",
      "5G": "bg-purple-500/20 border-purple-500/30 text-purple-400",
      LTE: "bg-blue-500/20 border-blue-500/30 text-blue-400",
      WCDMA: "bg-yellow-500/20 border-yellow-500/30 text-yellow-400",
      GSM: "bg-orange-500/20 border-orange-500/30 text-orange-400",
      NR: "bg-purple-500/20 border-purple-500/30 text-purple-400",
    };
    return (
      techBadgeColors[tech?.toUpperCase()] ||
      "bg-slate-700 border-slate-600 text-slate-400"
    );
  };

  const getProviderIcon = (provider) => {
    const providerLower = provider?.toLowerCase() || "";
    if (providerLower.includes("jio")) return "🔵";
    if (providerLower.includes("airtel")) return "🔴";
    if (providerLower.includes("vodafone") || providerLower.includes("vi"))
      return "🟣";
    if (providerLower.includes("bsnl")) return "🟢";
    return "📶";
  };

  // Check if there's any valid data to show
  const hasValidData = providerVolume && providerVolume.length > 0;
  const hasProviderData = summaryStats?.byProvider && Object.keys(summaryStats.byProvider).length > 0;
  const hasTechData = summaryStats?.byTech && Object.keys(summaryStats.byTech).length > 0;

  return (
    <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
        <Wifi className="h-4 w-4" />
        Provider Volume by Technology
        <span className="text-xs text-slate-400 font-normal ml-2">
          (Aggregated from {sessionIds.length} session
          {sessionIds.length > 1 ? "s" : ""})
        </span>
      </h4>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 border-2 border-slate-600 border-t-blue-400 rounded-full animate-spin"></div>
            <span className="text-slate-400 text-sm">
              Loading provider volume data...
            </span>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <div className="text-slate-400 text-sm">
              Failed to load provider volume data
            </div>
            <div className="text-xs text-slate-500 mt-1">{error}</div>
          </div>
        </div>
      ) : !hasValidData ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Wifi className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <div className="text-slate-400 text-sm">
              No valid provider volume data available
            </div>
            <div className="text-xs text-slate-500 mt-1">
              (Unknown providers/technologies are excluded)
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Sessions: {sessionIds.join(", ")}
            </div>
          </div>
        </div>
      ) : (
        <>
          

          {/* Detailed Table - Grouped by Provider + Technology */}
          <div className="overflow-x-auto scrollbar-hide bg-slate-800/50 rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800">
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">
                    Provider
                  </th>
                  <th className="text-left px-3 py-2 text-slate-400 font-medium">
                    Technology
                  </th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium whitespace-nowrap">
                    Download (GB)
                  </th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium whitespace-nowrap">
                    Upload (GB)
                  </th>
                  <th className="text-right px-3 py-2 text-slate-400 font-medium whitespace-nowrap">
                    Total (GB)
                  </th>
                </tr>
              </thead>
              <tbody>
                {providerVolume.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-slate-800 hover:bg-slate-700/30 transition-colors"
                  >
                    <td className="px-3 py-2 text-slate-300">
                      <div className="flex items-center gap-2">
                        <span>{getProviderIcon(item.provider)}</span>
                        <span className="capitalize">{item.provider}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${getTechBadgeColor(
                          item.technology
                        )}`}
                      >
                        {item.technology}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-blue-400 font-medium">
                      {item.downloadGb}
                    </td>
                    <td className="px-3 py-2 text-right text-green-400 font-medium">
                      {item.uploadGb}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-200 font-bold">
                      {item.totalGb}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600 bg-slate-800/70">
                  <td
                    colSpan="2"
                    className="px-3 py-2 text-slate-300 font-semibold"
                  >
                     Total
                  </td>
                  <td className="px-3 py-2 text-right text-blue-400 font-bold">
                    {summaryStats?.totalDownload || "0.00"}
                  </td>
                  <td className="px-3 py-2 text-right text-green-400 font-bold">
                    {summaryStats?.totalUpload || "0.00"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-100 font-bold">
                    {summaryStats?.totalData || "0.00"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Technology Summary Pills */}
          {hasTechData && (
            <div className="mt-4 pt-3 border-t border-slate-700">
              <h5 className="text-xs font-semibold text-slate-400 mb-2">
                By Technology
              </h5>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summaryStats.byTech).map(([tech, data]) => (
                  <div
                    key={tech}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${getTechBadgeColor(
                      tech
                    )}`}
                  >
                    <span className="font-medium">{tech}</span>
                    <span className="text-xs opacity-70">
                      ↓{data.download.toFixed(2)} | ↑{data.upload.toFixed(2)} GB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default OverviewTab;