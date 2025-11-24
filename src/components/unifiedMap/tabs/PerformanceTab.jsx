import React from "react";
import { ThroughputTimelineChart } from "../charts/performance/ThroughputTimelineChart";
import { JitterLatencyChart } from "../charts/performance/JitterLatencyChart";
import { SpeedAnalysisChart } from "../charts/performance/SpeedAnalysisChart";
import { Activity } from "lucide-react";

export const PerformanceTab = ({ locations, expanded, chartRefs }) => {
  if (!locations || locations.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-8 text-center border border-slate-700">
        <Activity className="h-12 w-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400 text-sm mb-2">No Performance Data Available</p>
        <p className="text-slate-500 text-xs">
          Performance metrics will appear here when location data is loaded.
        </p>
      </div>
    );
  }

  return (
    <div className={`grid ${expanded ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
      <ThroughputTimelineChart 
        ref={chartRefs?.throughputTimeline} 
        locations={locations} 
      />
      <JitterLatencyChart 
        ref={chartRefs?.jitterLatency} 
        locations={locations} 
      />
      <SpeedAnalysisChart 
        ref={chartRefs?.speed} 
        locations={locations} 
      />
    </div>
  );
};