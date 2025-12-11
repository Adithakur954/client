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
  thresholds = {},
  logs = [],
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

  const clearDrawings = () => {
    onUIChange?.({ drawClearSignal: (safeUi.drawClearSignal || 0) + 1 });
  };

  return (
    <header className="h-16 bg-slate-900 text-white shadow-lg flex items-center justify-between px-4 sm:px-6 relative z-50">
      
      {/* Left Section - Logo & Filters */}
      <div className="flex items-center gap-4">
        
        {/* Filters Button */}
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setFiltersOpen(true)}
          title="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          <span className="hidden sm:inline">Filters</span>
        </Button>
      </div>

      {/* Center Section - Drawing Tools */}
      <div className="relative" ref={dropdownRef}>
        <button
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            dropOpen
              ? "bg-slate-700 text-blue-400 ring-2 ring-blue-500"
              : "text-gray-200 hover:text-white hover:bg-slate-800"
          }`}
          onClick={() => setDropOpen((p) => !p)}
          aria-expanded={dropOpen}
        >
          <PenTool className="w-4 h-4" />
          <span className="hidden sm:inline">Drawing Tools</span>
          {dropOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Dropdown Menu */}
        {dropOpen && (
          <div
            className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-72 sm:w-80 bg-white text-gray-900 rounded-xl shadow-2xl ring-1 ring-gray-200 p-4 z-[100]"
            role="menu"
          >
            {/* Warning if no logs */}
            {!hasLogs && (
              <div className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <span>Load/fetch logs first to enable drawing.</span>
              </div>
            )}

            {/* Enable Drawing Toggle */}
            <label className="flex items-center gap-3 font-medium text-sm mb-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
              <input
                type="checkbox"
                checked={!!safeUi.drawEnabled}
                onChange={(e) => onUIChange?.({ drawEnabled: e.target.checked })}
                disabled={!hasLogs}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Enable Drawing Tools</span>
            </label>
            <p className="text-xs text-gray-500 mb-4 pl-9">
              Use the controls on the map to select a shape.
            </p>

            {/* Drawing Options */}
            <div
              className={`space-y-4 text-sm transition-opacity ${
                safeUi.drawEnabled ? "opacity-100" : "opacity-50 pointer-events-none"
              }`}
            >
              {/* Pixelate Option */}
              <label className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  checked={!!safeUi.drawPixelateRect}
                  onChange={(e) => onUIChange?.({ drawPixelateRect: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium">Pixelate shape into grid</span>
              </label>

              {/* Cell Size Input */}
              <div className="flex items-center gap-3 pl-2">
                <Label className="text-xs text-gray-700 whitespace-nowrap">Cell size:</Label>
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
                  className="w-20 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  disabled={!safeUi.drawPixelateRect}
                />
                <span className="text-xs text-gray-600">meters</span>
              </div>

              {/* Clear Button */}
              <div className="pt-3 border-t border-gray-200">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700"
                  onClick={clearDrawings}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Clear All Drawings
                </Button>
              </div>
            </div>

            {/* Downloads Section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                Downloads
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-100 hover:bg-gray-200"
                  onClick={onDownloadStatsCsv}
                  disabled={!polygonStats || !polygonStats.stats}
                  title={!polygonStats?.stats ? "Draw a polygon first" : "Download polygon stats (CSV)"}
                >
                  <Download className="h-4 w-4 mr-1" />
                  <span className="text-xs">Stats</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 bg-gray-100 hover:bg-gray-200"
                  onClick={onDownloadRawCsv}
                  disabled={!polygonStats || !polygonStats.logs || polygonStats.logs.length === 0}
                  title={!polygonStats?.logs?.length ? "Draw a polygon with logs first" : "Download raw logs inside polygon (CSV)"}
                >
                  <Download className="h-4 w-4 mr-1" />
                  <span className="text-xs">Raw CSV</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Section - Search, User, Logout */}
      <div className="flex items-center gap-3">
        {/* Search Toggle */}
        <Button
          size="sm"
          variant={isSearchOpen ? "default" : "secondary"}
          onClick={onSearchToggle}
          className={isSearchOpen ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-700 hover:bg-slate-600"}
          title={isSearchOpen ? "Close search" : "Open search"}
        >
          {isSearchOpen ? <XCircle className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>

        {/* User Info */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold">
            {user?.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <span className="text-sm text-gray-300">
            <span className="font-medium text-white">{user?.name || "User"}</span>
          </span>
        </div>

        {/* Logout Button */}
        <Button
          onClick={logout}
          variant="default"
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          <LogOut className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>

      {/* Floating Sidebar */}
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
        logs={logs}
      />
    </header>
  );
}