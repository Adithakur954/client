// src/components/prediction/PredictionSide.jsx
import React, { useMemo, useState, useCallback } from "react";
import { 
  Filter, 
  X, 
  SlidersHorizontal, 
  ArrowRightLeft,
  MapPin,
  Activity,
  Eye,
  EyeOff
} from "lucide-react";
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
import { useNavigate } from "react-router-dom";

const PanelSection = ({ title, icon: Icon, children, className }) => (
  <div className={`space-y-3 ${className}`}>
    {title && (
      <div className="flex items-center gap-2 text-sm font-semibold text-gray-200">
        {Icon && <Icon className="h-4 w-4" />}
        <span>{title}</span>
      </div>
    )}
    <div className="rounded-lg border border-gray-600 bg-gray-700 p-4">
      {children}
    </div>
  </div>
);

const ToggleButton = ({ active, onToggle, activeText, inactiveText, disabled }) => (
  <button
    onClick={onToggle}
    disabled={disabled}
    className={`w-full px-4 py-3 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
      active
        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg"
        : "bg-gray-600 hover:bg-gray-500 text-gray-200"
    } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
  >
    {active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    {active ? activeText : inactiveText}
  </button>
);

export default function PredictionSide({
  loading,
  ui,
  onUIChange,
  position = "right",
  autoCloseOnApply = true,
  open: controlledOpen,
  onOpenChange,
  metric,
  setMetric,
  projectId,
  setProjectId,
  reloadData,
  showPolys,
  setShowPolys,
  onlyInside,
  setOnlyInside,
  sessionId,
}) {
  const navigate = useNavigate();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const isOpen = isControlled ? controlledOpen : internalOpen;
  
  const setOpen = useCallback((v) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  }, [isControlled, onOpenChange]);

  const sideClasses = useMemo(() => {
    const base = "fixed top-0 h-full z-50 w-[90vw] sm:w-[380px] bg-gray-800 shadow-2xl transition-transform duration-200 ease-out";
    if (position === "right") {
      return isOpen
        ? `${base} right-0 translate-x-0`
        : `${base} right-0 translate-x-full`;
    }
    return isOpen
      ? `${base} left-0 translate-x-0`
      : `${base} left-0 -translate-x-full`;
  }, [isOpen, position]);

  const applyAndClose = useCallback(() => {
    reloadData?.();
    if (autoCloseOnApply) setOpen(false);
  }, [reloadData, autoCloseOnApply, setOpen]);

  const handleNavigate = useCallback(() => {
    const q = new URLSearchParams();
    if (projectId) q.set("project_id", String(projectId));
    if (sessionId) q.set("session", String(sessionId));
    navigate(`/map?${q.toString()}`);
  }, [projectId, sessionId, navigate]);

  const togglePolygons = useCallback(() => {
    setShowPolys(!showPolys);
    setTimeout(() => setOpen(false), 150);
  }, [showPolys, setShowPolys, setOpen]);

  const toggleInsideFilter = useCallback(() => {
    setOnlyInside(!onlyInside);
    setTimeout(() => setOpen(false), 150);
  }, [onlyInside, setOnlyInside, setOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Side Panel */}
      <div className={sideClasses}>
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-600 rounded">
                <SlidersHorizontal className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-base font-semibold text-white">
                Controls
              </h3>
            </div>
            <button
              className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
              onClick={() => setOpen(false)}
            >
              <X className="h-5 w-5 text-gray-300" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-140px)] overflow-y-auto px-4 py-4 space-y-4">
          {/* Project Section */}
          <PanelSection title="Project Configuration" icon={Activity}>
            <div>
              <Label className="text-xs font-medium text-gray-300 mb-1.5 block">
                Project ID
              </Label>
              <Input
                type="number"
                value={projectId ?? ""}
                onChange={(e) =>
                  setProjectId?.(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full h-9 bg-gray-900 border-gray-600 text-white placeholder:text-gray-500"
                placeholder="Enter Project ID"
              />
            </div>
          </PanelSection>

          {/* Metric Section */}
          <PanelSection title="Metric Display" icon={Activity}>
            <div>
              <Label className="text-xs font-medium text-gray-300 mb-1.5 block">
                Select Metric
              </Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="w-full h-9 bg-gray-900 border-gray-600 text-white">
                  <SelectValue placeholder="Choose a metric..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rsrp">RSRP</SelectItem>
                  <SelectItem value="rsrq">RSRQ</SelectItem>
                  <SelectItem value="sinr">SINR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PanelSection>

          {/* Display Options */}
          <PanelSection title="Display Options" icon={MapPin}>
            <div className="space-y-3">
              {/* Show/Hide Polygons */}
              <div>
                <Label className="text-xs font-medium text-gray-300 mb-2 block">
                  Project Polygons
                </Label>
                <ToggleButton
                  active={showPolys}
                  onToggle={togglePolygons}
                  activeText="Polygons Visible"
                  inactiveText="Polygons Hidden"
                />
              </div>

              {/* Filter Inside Polygons */}
              <div>
                <Label className="text-xs font-medium text-gray-300 mb-2 block">
                  Point Filtering
                </Label>
                <ToggleButton
                  active={onlyInside}
                  onToggle={toggleInsideFilter}
                  activeText="Inside Points Only"
                  inactiveText="Show All Points"
                  disabled={!showPolys}
                />
                {onlyInside && showPolys && (
                  <p className="text-xs text-green-400 mt-2 flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    Filtering active - showing only points inside polygons
                  </p>
                )}
                {!showPolys && (
                  <p className="text-xs text-gray-400 mt-2">
                    Enable polygons to use this filter
                  </p>
                )}
              </div>
            </div>
          </PanelSection>

          {/* Map Style Section */}
          <PanelSection title="Map Style" icon={MapPin}>
            <div>
              <Label className="text-xs font-medium text-gray-300 mb-1.5 block">
                Basemap Style
              </Label>
              <Select
                value={ui?.basemapStyle || "roadmap"}
                onValueChange={(v) => onUIChange?.({ basemapStyle: v })}
              >
                <SelectTrigger className="w-full h-9 bg-gray-900 border-gray-600 text-white">
                  <SelectValue placeholder="Select style..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roadmap">Roadmap</SelectItem>
                  <SelectItem value="satellite">Satellite</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="terrain">Terrain</SelectItem>
                  <SelectItem value="clean">Clean</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </PanelSection>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4">
          <div className="space-y-2">
            <Button
              className="w-full h-10 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={applyAndClose}
              disabled={loading || !projectId}
            >
              <Filter className="h-4 w-4 mr-2" />
              {loading ? "Loading..." : "Reload Data"}
            </Button>
            <Button
              variant="outline"
              className="w-full h-10 bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
              onClick={handleNavigate}
              disabled={!projectId}
            >
              <ArrowRightLeft className="h-4 w-4 mr-2" />
              View Sample Map
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}