// src/components/UnifiedMapSidebar.jsx
import React, { useMemo, useCallback, memo, useState } from "react";
import { X, RefreshCw, AlertTriangle, Radio, Filter, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const PanelSection = memo(({ title, icon: Icon, children, className = "" }) => (
  <div className={`space-y-2 ${className}`}>
    {title && (
      <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
        {Icon && <Icon className="h-4 w-4" />}
        <span>{title}</span>
      </div>
    )}
    <div className="rounded-lg border border-slate-700 p-3 bg-slate-900">
      {children}
    </div>
  </div>
));
PanelSection.displayName = 'PanelSection';

const ToggleButton = memo(({ value, onChange, options, disabled, className = "" }) => (
  <div className={`flex rounded-lg overflow-hidden border border-slate-600 ${className} ${disabled ? 'opacity-50' : ''}`}>
    {options.map((option) => (
      <button
        key={option.value}
        onClick={() => !disabled && onChange(option.value)}
        disabled={disabled}
        className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
          value === option.value
            ? "bg-blue-600 text-white"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
        } ${disabled ? 'cursor-not-allowed' : ''}`}
      >
        {option.label}
      </button>
    ))}
  </div>
));
ToggleButton.displayName = 'ToggleButton';

// ✅ COMPACT: Minimal threshold input with +/- buttons
const CompactThresholdInput = memo(({ value, onChange, min, max, step, disabled }) => {
  const [inputValue, setInputValue] = useState(String(value));

  const handleIncrement = () => {
    const newValue = Math.min(max, parseFloat(value) + step);
    onChange(newValue);
    setInputValue(String(newValue));
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, parseFloat(value) - step);
    onChange(newValue);
    setInputValue(String(newValue));
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    if (val === '' || val === '-') return;

    const numValue = parseFloat(val);
    if (!isNaN(numValue) && numValue >= min && numValue <= max) {
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue) || inputValue === '' || inputValue === '-') {
      setInputValue(String(value));
    } else {
      const clampedValue = Math.max(min, Math.min(max, numValue));
      onChange(clampedValue);
      setInputValue(String(clampedValue));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleDecrement();
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="p-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Decrease"
      >
        <Minus className="h-3 w-3" />
      </button>
      
      <Input
        type="text"
        inputMode="decimal"
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="bg-slate-800 border-slate-700 text-white h-7 text-center text-xs w-16"
        placeholder={String(value)}
      />
      
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className="p-1 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Increase"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
});
CompactThresholdInput.displayName = 'CompactThresholdInput';

const UnifiedMapSidebar = ({
  open,
  onOpenChange,
  enableDataToggle,
  setEnableDataToggle,
  dataToggle,
  setDataToggle,
  enableSiteToggle,
  setEnableSiteToggle,
  siteToggle,
  setSiteToggle,
  projectId,
  sessionIds,
  metric,
  setMetric,
  coverageHoleFilters,
  setCoverageHoleFilters,
  ui,
  onUIChange,
  showPolygons,
  setShowPolygons,
  polygonSource,
  setPolygonSource,
  onlyInsidePolygons,
  setOnlyInsidePolygons,
  polygonCount,
  showSiteMarkers,
  setShowSiteMarkers,
  showSiteSectors,
  setShowSiteSectors,
  loading,
  reloadData,
  showNeighbors,
  setShowNeighbors,
  showCollisionsOnly,
  setShowCollisionsOnly,
  neighborStats,
}) => {
  const sideClasses = useMemo(() => {
    const base =
      "fixed top-0 left-0 h-full z-50 w-[90vw] sm:w-[420px] bg-slate-950 text-white shadow-2xl transition-transform duration-200 ease-out overflow-hidden";
    return open ? `${base} translate-x-0` : `${base} -translate-x-full`;
  }, [open]);

  const handleApply = useCallback(() => {
    reloadData?.();
  }, [reloadData]);

  const shouldShowMetricSelector = useMemo(
    () => enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction") || showPolygons,
    [enableDataToggle, enableSiteToggle, siteToggle, showPolygons]
  );

  const updateCoverageFilter = useCallback((metric, field, value) => {
    setCoverageHoleFilters?.(prev => ({
      ...prev,
      [metric]: {
        ...prev[metric],
        [field]: value
      }
    }));
  }, [setCoverageHoleFilters]);

  const activeFiltersCount = useMemo(() => {
    if (!coverageHoleFilters) return 0;
    return Object.values(coverageHoleFilters).filter(f => f.enabled).length;
  }, [coverageHoleFilters]);

  const toggleAllCoverageFilters = useCallback((enabled) => {
    setCoverageHoleFilters?.(prev => ({
      rsrp: { ...prev.rsrp, enabled },
      rsrq: { ...prev.rsrq, enabled },
      sinr: { ...prev.sinr, enabled }
    }));
  }, [setCoverageHoleFilters]);

  const siteToggleOptions = useMemo(
    () => [
      { value: "Cell", label: "Cell" },
      { value: "NoML", label: "NoML" },
      { value: "ML", label: "ML" },
    ],
    []
  );

  const dataToggleOptions = useMemo(
    () => [
      { value: "sample", label: "Sample" },
      { value: "prediction", label: "Prediction" },
    ],
    []
  );

  const polygonToggleOptions = useMemo(() => [
    { value: "map", label: "Map Regions" },
    { value: "save", label: "Buildings" }
  ], []);

  const handleDataToggleChange = useCallback(
    (value) => setDataToggle?.(value),
    [setDataToggle]
  );

  const handleSiteToggleChange = useCallback(
    (value) => setSiteToggle?.(value),
    [setSiteToggle]
  );

  const handleMetricChange = useCallback(
    (value) => setMetric?.(value),
    [setMetric]
  );

  const handlePolygonSourceChange = useCallback(
    (value) => {
      console.log(`🔄 Polygon source changed to: ${value}`);
      setPolygonSource?.(value);
    },
    [setPolygonSource]
  );

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange?.(false)}
        />
      )}

      <div className={sideClasses}>
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
          <h2 className="text-lg font-semibold">Map Controls</h2>
          <button
            className="p-1 rounded hover:bg-slate-800 transition-colors"
            onClick={() => onOpenChange?.(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="h-[calc(100%-140px)] overflow-y-auto p-4 space-y-4">
          
          <PanelSection title="Current View">
            <div className="space-y-2 text-sm">
              {projectId && (
                <div className="flex justify-between p-2 bg-slate-800 rounded">
                  <span className="text-slate-400">Project ID:</span>
                  <span className="font-semibold text-blue-400">{projectId}</span>
                </div>
              )}
              {sessionIds && sessionIds.length > 0 && (
                <div className="p-2 bg-slate-800 rounded">
                  <div className="text-slate-400 mb-1">Session ID(s):</div>
                  <div className="font-semibold text-green-400">{sessionIds.join(", ")}</div>
                </div>
              )}
              {!projectId && (!sessionIds || sessionIds.length === 0) && (
                <div className="text-slate-500 text-center py-2">
                  No project or session linked
                </div>
              )}
            </div>
          </PanelSection>

          <PanelSection title="Data Layer">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={enableDataToggle}
                  onChange={(e) => setEnableDataToggle?.(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Enable Data Layer</span>
              </label>

              <div>
                <Label className="text-xs text-slate-300 mb-2 block">
                  Sample or Prediction
                </Label>
                <ToggleButton
                  value={dataToggle}
                  onChange={handleDataToggleChange}
                  disabled={!enableDataToggle}
                  options={dataToggleOptions}
                />
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Sites Layer">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={enableSiteToggle}
                  onChange={(e) => setEnableSiteToggle?.(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Enable Sites Layer</span>
              </label>

              <div>
                <Label className="text-xs text-slate-300 mb-2 block">
                  Site Data Source
                </Label>
                <ToggleButton
                  value={siteToggle}
                  onChange={handleSiteToggleChange}
                  disabled={!enableSiteToggle}
                  options={siteToggleOptions}
                />
              </div>

              {enableSiteToggle && (
                <div className="space-y-2 pt-2 border-t border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={showSiteMarkers}
                      onChange={(e) => setShowSiteMarkers?.(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Show Site Markers</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={showSiteSectors}
                      onChange={(e) => setShowSiteSectors?.(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Show Sectors</span>
                  </label>
                </div>
              )}
            </div>
          </PanelSection>

          <PanelSection title="Polygon Layer">
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={showPolygons}
                  onChange={(e) => {
                    const isEnabled = e.target.checked;
                    console.log(`🔘 Polygon checkbox toggled: ${isEnabled}`);
                    setShowPolygons?.(isEnabled);
                  }}
                  className="w-4 h-4"
                />
                <span className="text-sm">Show Polygons</span>
              </label>

              <div>
                <Label className="text-xs text-slate-300 mb-2 block">
                  Polygon Source
                </Label>
                <ToggleButton
                  value={polygonSource}
                  onChange={handlePolygonSourceChange}
                  disabled={!showPolygons}
                  options={polygonToggleOptions}
                />
              </div>

              {showPolygons && polygonCount > 0 && (
                <div className="p-2 bg-slate-800 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Loaded:</span>
                    <span className="font-semibold text-blue-400">
                      {polygonCount} polygon(s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-slate-400">Source:</span>
                    <span className="font-semibold text-green-400">
                      {polygonSource === 'map' ? 'Map Regions' : 'Buildings'}
                    </span>
                  </div>
                </div>
              )}

              <Label className="text-xs text-slate-300 mb-2 block">
                Point Filtering
              </Label>
              
              <div className="mb-2 p-2 bg-slate-800 rounded text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Mode:</span>
                  <span className={`font-semibold ${onlyInsidePolygons ? 'text-green-400' : 'text-blue-400'}`}>
                    {onlyInsidePolygons ? 'Filtered' : 'All Points'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setOnlyInsidePolygons?.(!onlyInsidePolygons)}
                className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                  onlyInsidePolygons
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                }`}
              >
                {onlyInsidePolygons ? "Show All Points" : "Filter Inside Only"}
              </button>
            </div>
          </PanelSection>

          <PanelSection title="Neighbor Analysis" icon={Radio}>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={showNeighbors}
                  onChange={(e) => setShowNeighbors?.(e.target.checked)}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="text-sm font-medium">Show Neighbor Cells</div>
                  <div className="text-xs text-slate-400">
                    Display neighbor cell data on map
                  </div>
                </div>
              </label>

              {showNeighbors && (
                <>
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800 ml-6">
                    <input
                      type="checkbox"
                      checked={showCollisionsOnly}
                      onChange={(e) => setShowCollisionsOnly?.(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <div className="flex-1">
                      <div className="text-sm">Show Collisions Only</div>
                      <div className="text-xs text-slate-400">
                        Hide non-collision neighbors
                      </div>
                    </div>
                  </label>

                  {neighborStats && neighborStats.total > 0 && (
                    <div className="ml-6 space-y-2">
                      <div className="p-2 bg-slate-800 rounded text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Total Neighbors:</span>
                          <span className="font-semibold text-blue-400">
                            {neighborStats.total}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Unique PCIs:</span>
                          <span className="font-semibold text-green-400">
                            {neighborStats.uniquePCIs}
                          </span>
                        </div>

                        {neighborStats.collisions > 0 && (
                          <>
                            <div className="border-t border-slate-700 my-1"></div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">PCI Collisions:</span>
                              <span className="font-semibold text-red-400">
                                {neighborStats.collisions}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Collision Cells:</span>
                              <span className="font-semibold text-orange-400">
                                {neighborStats.collisionCells}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {neighborStats.collisions > 0 && (
                        <div className="bg-red-900/20 border border-red-700 p-2 rounded text-xs">
                          <p className="text-red-400 font-semibold">
                            ⚠️ {neighborStats.collisions} PCI collision(s) detected
                          </p>
                          <p className="text-red-300 text-xs mt-1">
                            Same PCI at different locations (shown in black)
                          </p>
                        </div>
                      )}

                      {neighborStats.collisions === 0 && neighborStats.total > 0 && (
                        <div className="bg-green-900/20 border border-green-700 p-2 rounded text-xs">
                          <p className="text-green-400">
                            ✓ No PCI collisions detected
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </PanelSection>

          {shouldShowMetricSelector && (
            <PanelSection title="Metric Display">
              <div>
                <Label className="text-xs text-slate-300 mb-2 block">Select Metric</Label>
                <Select value={metric} onValueChange={handleMetricChange}>
                  <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9">
                    <SelectValue placeholder="Select metric..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rsrp">RSRP</SelectItem>
                    <SelectItem value="rsrq">RSRQ</SelectItem>
                    <SelectItem value="sinr">SINR</SelectItem>
                    <SelectItem value="dl_thpt">DL Throughput</SelectItem>
                    <SelectItem value="ul_thpt">UL Throughput</SelectItem>
                    <SelectItem value="mos">MOS</SelectItem>
                    <SelectItem value="lte_bler">LTE BLER</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </PanelSection>
          )}

          {/* ✅ MINIMAL & COMPACT: Horizontal layout for coverage filters */}
          {shouldShowMetricSelector && coverageHoleFilters && (
            <PanelSection title="Coverage Hole Filters" icon={Filter}>
              <div className="space-y-3">
                {/* Quick Actions - More compact */}
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleAllCoverageFilters(true)}
                    className="flex-1 px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                  >
                    Enable All
                  </button>
                  <button
                    onClick={() => toggleAllCoverageFilters(false)}
                    className="flex-1 px-2 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 rounded transition-colors"
                  >
                    Disable All
                  </button>
                </div>

                {/* ✅ HORIZONTAL LAYOUT: All three filters in grid */}
                <div className="grid grid-cols-1 gap-2">
                  {/* RSRP */}
                  <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded">
                    <input
                      type="checkbox"
                      checked={coverageHoleFilters.rsrp?.enabled || false}
                      onChange={(e) => updateCoverageFilter('rsrp', 'enabled', e.target.checked)}
                      className="w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-300 w-12 flex-shrink-0">RSRP</span>
                      <CompactThresholdInput
                        value={coverageHoleFilters.rsrp?.threshold ?? -110}
                        onChange={(val) => updateCoverageFilter('rsrp', 'threshold', val)}
                        min={-150}
                        max={-50}
                        step={1}
                        disabled={!coverageHoleFilters.rsrp?.enabled}
                      />
                      <span className="text-[10px] text-slate-500 flex-shrink-0">dBm</span>
                    </div>
                  </div>

                  {/* RSRQ */}
                  <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded">
                    <input
                      type="checkbox"
                      checked={coverageHoleFilters.rsrq?.enabled || false}
                      onChange={(e) => updateCoverageFilter('rsrq', 'enabled', e.target.checked)}
                      className="w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-300 w-12 flex-shrink-0">RSRQ</span>
                      <CompactThresholdInput
                        value={coverageHoleFilters.rsrq?.threshold ?? -15}
                        onChange={(val) => updateCoverageFilter('rsrq', 'threshold', val)}
                        min={-30}
                        max={0}
                        step={0.5}
                        disabled={!coverageHoleFilters.rsrq?.enabled}
                      />
                      <span className="text-[10px] text-slate-500 flex-shrink-0">dB</span>
                    </div>
                  </div>

                  {/* SINR */}
                  <div className="flex items-center gap-2 p-2 bg-slate-800/50 rounded">
                    <input
                      type="checkbox"
                      checked={coverageHoleFilters.sinr?.enabled || false}
                      onChange={(e) => updateCoverageFilter('sinr', 'enabled', e.target.checked)}
                      className="w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-300 w-12 flex-shrink-0">SINR</span>
                      <CompactThresholdInput
                        value={coverageHoleFilters.sinr?.threshold ?? 0}
                        onChange={(val) => updateCoverageFilter('sinr', 'threshold', val)}
                        min={-20}
                        max={30}
                        step={1}
                        disabled={!coverageHoleFilters.sinr?.enabled}
                      />
                      <span className="text-[10px] text-slate-500 flex-shrink-0">dB</span>
                    </div>
                  </div>
                </div>

                {/* ✅ COMPACT: Active Filters Summary */}
                {/* {activeFiltersCount > 0 && (
                  <div className="p-2 bg-yellow-900/20 border border-yellow-700 rounded">
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle className="h-3 w-3 text-yellow-400 flex-shrink-0" />
                      <div className="font-semibold text-yellow-400 text-xs">
                        {activeFiltersCount} Active Filter{activeFiltersCount > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className="text-[10px] text-yellow-300 space-y-0.5">
                      {coverageHoleFilters.rsrp?.enabled && (
                        <div>• RSRP {'<'} {coverageHoleFilters.rsrp.threshold} dBm</div>
                      )}
                      {coverageHoleFilters.rsrq?.enabled && (
                        <div>• RSRQ {'<'} {coverageHoleFilters.rsrq.threshold} dB</div>
                      )}
                      {coverageHoleFilters.sinr?.enabled && (
                        <div>• SINR {'<'} {coverageHoleFilters.sinr.threshold} dB</div>
                      )}
                    </div>
                    <div className="mt-1.5 pt-1.5 border-t border-yellow-700/50 text-[10px] text-yellow-200">
                      All criteria must be met (AND logic)
                    </div>
                  </div>
                )} */}

                {activeFiltersCount === 0 && (
                  <div className="p-2 bg-slate-800 rounded text-[10px] text-slate-400 text-center">
                    Enable filters to identify coverage holes
                  </div>
                )}
              </div>
            </PanelSection>
          )}
        </div>

        <div className="p-4 border-t border-slate-700 bg-slate-900">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={handleApply}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Loading..." : "Reload Data"}
          </Button>
        </div>
      </div>
    </>
  );
};

export default memo(UnifiedMapSidebar);