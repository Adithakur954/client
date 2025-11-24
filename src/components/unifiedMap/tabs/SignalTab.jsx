import React from "react";
import { SignalDistributionChart } from "../charts/signal/SignalDistributionChart";
import { TechnologyBreakdown } from "../charts/signal/TechnologyBreakdown";

export const SignalTab = ({ 
  locations, 
  selectedMetric, 
  thresholds, 
  expanded,
  chartRefs 
}) => {
  return (
    <div className={`grid ${expanded ? "grid-cols-2" : "grid-cols-1"} gap-4`}>
      <SignalDistributionChart
        ref={chartRefs.distribution}
        locations={locations}
        metric={selectedMetric}
        thresholds={thresholds}
      />
      <TechnologyBreakdown 
        ref={chartRefs.tech}
        locations={locations} 
      />
    </div>
  );
};