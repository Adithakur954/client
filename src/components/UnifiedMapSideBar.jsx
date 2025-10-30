// src/components/UnifiedMapSidebar.jsx
import React, { useMemo, useCallback, memo } from "react";
import { X, RefreshCw, Eye, EyeOff, Filter as FilterIcon, Layers, AlertTriangle } from "lucide-react";
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
  showCoverageHoleOnly,
  setShowCoverageHoleOnly,
  coverageHoleThreshold,
  setCoverageHoleThreshold,
  ui,
  onUIChange,
  showPolygons,
  setShowPolygons,
  onlyInsidePolygons,
  setOnlyInsidePolygons,
  polygonCount,
  showSiteMarkers,
  setShowSiteMarkers,
  showSiteSectors,
  setShowSiteSectors,
  loading,
  reloadData,
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
    () => enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction"),
    [enableDataToggle, enableSiteToggle, siteToggle]
  );

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

  const handleBasemapChange = useCallback(
    (value) => onUIChange?.({ basemapStyle: value }),
    [onUIChange]
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

          <PanelSection title="Toggle 1: Data Layer">
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

              <div className="text-xs p-2 bg-slate-800 rounded">
                {enableDataToggle ? (
                  <span className="text-green-400">
                    ✓ Showing {dataToggle} data
                  </span>
                ) : (
                  <span className="text-slate-500">
                    ✗ Data layer disabled
                  </span>
                )}
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Toggle 2: Sites Layer">
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

              <div className="text-xs p-2 bg-slate-800 rounded">
                {enableSiteToggle ? (
                  <span className="text-purple-400">
                    ✓ Showing {siteToggle} data
                  </span>
                ) : (
                  <span className="text-slate-500">
                    ✗ Sites layer disabled
                  </span>
                )}
              </div>
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

          {shouldShowMetricSelector && (
            <PanelSection title="Coverage Holes" icon={AlertTriangle}>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer p-3 rounded  transition-colors">
                  <input
                    type="checkbox"
                    checked={showCoverageHoleOnly}
                    onChange={(e) => setShowCoverageHoleOnly?.(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium ">
                      Coverage Holes
                    </div>
                   
                  </div>
                </label>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-300 block">
                    RSRP Threshold (dBm)
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="-150"
                      max="-50"
                      step="1"
                      value={coverageHoleThreshold || -110}
                      onChange={(e) => setCoverageHoleThreshold?.(Number(e.target.value))}
                      className="bg-slate-800 border-slate-700 text-white h-9"
                      placeholder="-110"
                    />
                    <span className="text-xs text-slate-400 whitespace-nowrap">dBm</span>
                  </div>
                  
                </div>

                
              </div>
            </PanelSection>
          )}

          {projectId && (
            <PanelSection title="Polygon Controls" icon={Layers}>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-300 mb-2 block">
                    Project Polygons
                  </Label>
                  <button
                    onClick={() => setShowPolygons?.(!showPolygons)}
                    className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                      showPolygons
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                    }`}
                  >
                    {showPolygons ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    {showPolygons ? "Polygons Visible" : "Polygons Hidden"}
                  </button>
                </div>

                {showPolygons && (
                  <div className="pt-2 border-t border-slate-700">
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
                      <FilterIcon className="h-4 w-4" />
                      {onlyInsidePolygons ? "Show All Points" : "Filter Inside Only"}
                    </button>

                    {polygonCount > 0 && (
                      <div className="mt-2 text-xs text-slate-400">
                        {polygonCount} polygon(s) loaded
                      </div>
                    )}
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