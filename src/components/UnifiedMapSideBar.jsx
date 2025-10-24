// src/components/UnifiedMapSidebar.jsx
import React, { useMemo } from "react";
import { X, RefreshCw, Eye, EyeOff, Filter as FilterIcon, Layers } from "lucide-react";
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

const PanelSection = ({ title, icon: Icon, children, className = "" }) => (
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
);

const ToggleButton = ({ value, onChange, options, disabled, className = "" }) => (
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
);

export default function UnifiedMapSidebar({
  open,
  onOpenChange,
  // Toggle 1 with enable
  enableDataToggle,
  setEnableDataToggle,
  dataToggle,
  setDataToggle,
  // Toggle 2 with enable
  enableSiteToggle,
  setEnableSiteToggle,
  siteToggle,
  setSiteToggle,
  // Read-only info
  projectId,
  sessionIds,
  // Metric
  metric,
  setMetric,
  // UI
  ui,
  onUIChange,
  // Polygon controls
  showPolygons,
  setShowPolygons,
  onlyInsidePolygons,
  setOnlyInsidePolygons,
  polygonCount,
  // Site controls
  showSiteMarkers,
  setShowSiteMarkers,
  showSiteSectors,
  setShowSiteSectors,
  useGeneratedSites,
  setUseGeneratedSites,
  siteGridSize,
  setSiteGridSize,
  // Actions
  loading,
  reloadData,
}) {
  const sideClasses = useMemo(() => {
    const base =
      "fixed top-0 left-0 h-full z-50 w-[90vw] sm:w-[420px] bg-slate-950 text-white shadow-2xl transition-transform duration-200 ease-out overflow-hidden";
    return open ? `${base} translate-x-0` : `${base} -translate-x-full`;
  }, [open]);

  const handleApply = () => {
    reloadData?.();
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => onOpenChange?.(false)}
        />
      )}

      {/* Sidebar */}
      <div className={sideClasses}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
          <h2 className="text-lg font-semibold">Map Controls</h2>
          <button
            className="p-1 rounded hover:bg-slate-800 transition-colors"
            onClick={() => onOpenChange?.(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-140px)] overflow-y-auto p-4 space-y-4">
          
          {/* PROJECT INFO (READ ONLY) */}
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

          {/* TOGGLE 1: Data Source with Enable Checkbox */}
          <PanelSection title="Toggle 1: Data Layer">
            <div className="space-y-3">
              {/* Enable/Disable Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={enableDataToggle}
                  onChange={(e) => setEnableDataToggle?.(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Enable Data Layer</span>
              </label>

              {/* Toggle Buttons */}
              <div>
                <Label className="text-xs text-slate-300 mb-2 block">
                  Sample or Prediction
                </Label>
                <ToggleButton
                  value={dataToggle}
                  onChange={setDataToggle}
                  disabled={!enableDataToggle}
                  options={[
                    { value: "sample", label: "Sample" },
                    { value: "prediction", label: "Prediction" },
                  ]}
                />
              </div>

              {/* Status */}
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

          {/* TOGGLE 2: Sites with Enable Checkbox */}
          <PanelSection title="Toggle 2: Sites Layer">
            <div className="space-y-3">
              {/* Enable/Disable Checkbox */}
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                <input
                  type="checkbox"
                  checked={enableSiteToggle}
                  onChange={(e) => setEnableSiteToggle?.(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm">Enable Sites Layer</span>
              </label>

              {/* Toggle Buttons */}
              <div>
                <Label className="text-xs text-slate-300 mb-2 block">
                  Sites or Sites+Prediction
                </Label>
                <ToggleButton
                  value={siteToggle}
                  onChange={setSiteToggle}
                  disabled={!enableSiteToggle}
                  options={[
                    { value: "sites", label: "Sites" },
                    { value: "sites-prediction", label: "Sites+Pred" },
                  ]}
                />
              </div>

              {/* Status */}
              <div className="text-xs p-2 bg-slate-800 rounded">
                {enableSiteToggle ? (
                  <span className="text-purple-400">
                    ✓ Showing {siteToggle === "sites" ? "sites only" : "sites + prediction"}
                  </span>
                ) : (
                  <span className="text-slate-500">
                    ✗ Sites layer disabled
                  </span>
                )}
              </div>
            </div>
          </PanelSection>

          {/* METRIC - Show when data circles are visible */}
          {(enableDataToggle || (enableSiteToggle && siteToggle === "sites-prediction")) && (
            <PanelSection title="Metric Display">
              <div>
                <Label className="text-xs text-slate-300 mb-2 block">Select Metric</Label>
                <Select value={metric} onValueChange={setMetric}>
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

          {/* POLYGON CONTROLS */}
          {projectId && (
            <PanelSection title="Polygon Controls" icon={Layers}>
              <div className="space-y-3">
                {/* Show Polygons Toggle */}
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

                {/* Filter by Polygons */}
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

          {/* SITE DISPLAY OPTIONS */}
          {enableSiteToggle && (
            <PanelSection title="Site Display">
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={showSiteSectors}
                    onChange={(e) => setShowSiteSectors?.(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Show Sectors</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={showSiteMarkers}
                    onChange={(e) => setShowSiteMarkers?.(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Show Site Markers</span>
                </label>

                <div className="border-t border-slate-700 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-800">
                    <input
                      type="checkbox"
                      checked={useGeneratedSites}
                      onChange={(e) => setUseGeneratedSites?.(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Use Generated Grid</span>
                  </label>

                  {useGeneratedSites && (
                    <div className="mt-3 p-3 bg-slate-800 rounded">
                      <Label className="text-xs text-slate-300 mb-2 block">
                        Grid Size: {siteGridSize}×{siteGridSize}
                      </Label>
                      <input
                        type="range"
                        min="3"
                        max="10"
                        value={siteGridSize}
                        onChange={(e) => setSiteGridSize?.(Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                      <div className="text-xs text-slate-400 mt-2 text-center">
                        {siteGridSize * siteGridSize} sites • {siteGridSize * siteGridSize * 3} sectors
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </PanelSection>
          )}

          {/* MAP SETTINGS */}
          <PanelSection title="Map Settings">
            <div>
              <Label className="text-xs text-slate-300 mb-2 block">Basemap Style</Label>
              <Select
                value={ui?.basemapStyle || "roadmap"}
                onValueChange={(v) => onUIChange?.({ basemapStyle: v })}
              >
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roadmap">Roadmap</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PanelSection>

        </div>

        {/* Footer */}
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
}