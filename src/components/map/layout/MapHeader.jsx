// src/components/map/layout/MapHeader.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronDown, ChevronUp, PenTool, XCircle, Download, SlidersHorizontal, Search } from "lucide-react";
import { Label } from "@/components/ui/label";
import img from "../../../assets/vinfocom.png";
import MapSidebarFloating from "./MapSidebarFloating";

export default function MapHeader({
  ui,
  onUIChange,
  hasLogs,
  polygonStats,
  onDownloadStatsCsv,
  onDownloadRawCsv,
  onApplyFilters,
  onClearFilters,
  initialFilters,
  isSearchOpen,
  onSearchToggle,
  thresholds ={}
}) {
  const { user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  
  const safeUi = {
    drawEnabled: false,
    shapeMode: "polygon",
    drawPixelateRect: false,
    drawCellSizeMeters: 100,
    drawClearSignal: 0,
    ...ui,
  };

  useEffect(() => {
    const onOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropOpen(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const startDrawPolygon = () => {
    onUIChange?.({ drawEnabled: true, shapeMode: "polygon" });
    setDropOpen(false);
  };

  const clearDrawings = () => {
    onUIChange?.({ drawClearSignal: (safeUi.drawClearSignal || 0) + 1 });
  };

  return (
    <header className="h-16 bg-slate-900 text-white shadow flex items-center justify-between px-4 sm:px-6">
      {/* Left: Logo + Title */}
      <div className="flex items-center space-x-3">
        <img src={img} alt="Logo" className="h-9" />
        <span className="font-semibold text-lg tracking-wide">Map Dashboard</span>
      </div>

      {/* Center: Drawing Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
            dropOpen
              ? "bg-slate-800 text-blue-400"
              : "text-gray-200 hover:text-white hover:bg-slate-800"
          }`}
          onClick={() => setDropOpen((p) => !p)}
          aria-expanded={dropOpen}
        >
          <PenTool className="w-4 h-4" />
          {/* CHANGED: More generic label */}
          <span>Drawing Tools</span>
          {dropOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {dropOpen && (
          <div
            className="absolute right-0 mt-2 w-72 sm:w-80 bg-white text-gray-900 rounded-md shadow-2xl ring-1 ring-gray-200 p-3 z-50"
            role="menu"
          >
            {!hasLogs && (
              <div className="mb-3 p-2 rounded bg-amber-50 text-amber-800 text-xs">
                ⚠️ Load/fetch logs first to enable drawing.
              </div>
            )}

            <label className="flex items-center gap-2 font-medium text-sm mb-2">
              <input
                type="checkbox"
                checked={!!safeUi.drawEnabled}
                onChange={(e) => onUIChange?.({ drawEnabled: e.target.checked })}
                disabled={!hasLogs}
              />
              Enable Drawing Tools
            </label>
            <p className="text-xs text-gray-500 mt-1 mb-3 pl-6">
              Use the controls on the map to select a shape.
            </p>

            <div
              className={`pl-3 space-y-4 text-sm ${
                safeUi.drawEnabled ? "" : "opacity-50 pointer-events-none"
              }`}
            >
              {/* REMOVED: The redundant Shape Type dropdown is now gone */}
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!safeUi.drawPixelateRect}
                  onChange={(e) => onUIChange?.({ drawPixelateRect: e.target.checked })}
                />
                <span className="font-medium">Pixelate shape into grid</span>
              </label>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-gray-700">Cell size</Label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={safeUi.drawCellSizeMeters ?? 100}
                  onChange={(e) =>
                    onUIChange?.({
                      drawCellSizeMeters: Math.max(1, Number(e.target.value || 100)),
                    })
                  }
                  className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                  disabled={!safeUi.drawPixelateRect}
                />
                <span className="text-xs text-gray-600">m</span>
              </div>

              <div className="pt-3 border-t border-gray-200 flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700"
                  onClick={clearDrawings}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Clear drawings
                </Button>
              </div>
            </div>

            {/* Downloads */}
            <div className="mt-4 pt-3 border-t border-gray-200">
              <div className="text-xs font-medium text-gray-700 mb-2">Downloads</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={onDownloadStatsCsv}
                  disabled={!polygonStats || !polygonStats.stats}
                  title={!polygonStats?.stats ? "Draw a polygon first" : "Download polygon stats (CSV)"}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Stats CSV
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1"
                  onClick={onDownloadRawCsv}
                  disabled={!polygonStats || !polygonStats.logs || polygonStats.logs.length === 0}
                  title={!polygonStats?.logs?.length ? "Draw a polygon with logs first" : "Download raw logs inside polygon (CSV)"}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Raw CSV
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

     
      <div className="flex items-center space-x-4">
        <Button 
          size="sm"
          onClick={onSearchToggle}
        >
          {isSearchOpen ? <XCircle/> : <Search /> }
        </Button>

        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setFiltersOpen(true)}
          title="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
        </Button>

        <MapSidebarFloating
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          hideTrigger={true}
          onApplyFilters={onApplyFilters}
          onClearFilters={onClearFilters}
          onUIChange={onUIChange}
          ui={ui}
          initialFilters={initialFilters}
          position="left"
          autoCloseOnApply={true}
           thresholds={thresholds}
        />
        
        <p className="text-gray-300 text-sm">
          Welcome,&nbsp;<span className="font-semibold text-white">{user?.name || "User"}</span>
        </p>
        <Button onClick={logout} variant="default" size="sm" className="bg-gray-700 hover:bg-gray-600 text-white">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </header>
  );
}