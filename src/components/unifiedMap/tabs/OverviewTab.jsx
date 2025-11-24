import React, { useMemo } from "react";
import { 
  MapPin, Activity, Layers, Clock, Antenna 
} from "lucide-react";
import { StatCard } from "../common/StatCard";
// import { calculateStats, calculateIOSummary } from "../utils/analyticsHelpers";
import { PCI_COLOR_PALETTE } from "@/components/map/layers/MultiColorCirclesLayer";

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
}) => {
  // Get top PCIs for quick reference
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

  return (
    <div className="space-y-4">
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

      {/* Metric Statistics */}
      {stats && (
        <div className="bg-slate-900 rounded-lg p-4 border border-slate-700">
          <h4 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {selectedMetric?.toUpperCase() || "METRIC"} Statistics
          </h4>

          <div className={`grid ${expanded ? "grid-cols-5" : "grid-cols-3"} gap-3`}>
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
    </div>
  );
};

// Sub-components
const MetricCard = ({ label, value, color = "white", raw = false }) => (
  <div className="bg-slate-800 rounded p-3 text-center hover:bg-slate-750 transition-colors">
    <div className="text-xs text-slate-400 mb-1">{label}</div>
    <div className={`text-xl font-bold text-${color}-400`}>
      {raw ? value : (typeof value === "number" ? value.toFixed(2) : "N/A")}
    </div>
  </div>
);

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
              <svg className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                />
              </svg>
            </div>
            <div>
              <div className="text-xs text-cyan-300/70 font-medium">Indoor Samples</div>
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
              <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
            <div>
              <div className="text-xs text-green-300/70 font-medium">Outdoor Samples</div>
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

    <div className="text-xs text-slate-400 mb-2">Top 10 PCIs in Current View</div>
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
            <div className="text-white font-semibold truncate">PCI {item.pci}</div>
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