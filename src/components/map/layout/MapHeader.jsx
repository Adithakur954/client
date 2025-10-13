// MapHeader.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, ChevronDown, ChevronUp, PenTool, XCircle, Download, SlidersHorizontal, Upload } from "lucide-react";
import { Label } from "@/components/ui/label";
import img from "../../../assets/vinfocom_logo.png";
import MapSidebarFloating from "./MapSidebarFloating";
import uploadImage from '@/components/UploadImages'

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
}) {
  const { user, logout } = useAuth();
  const [dropOpen, setDropOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [preview, setPreview] = useState(false);

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
          <span>Draw / Analyze</span>
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

            {/* Master toggle */}
            <label className="flex items-center gap-2 font-medium text-sm mb-2">
              <input
                type="checkbox"
                checked={!!safeUi.drawEnabled}
                onChange={(e) => onUIChange?.({ drawEnabled: e.target.checked })}
                disabled={!hasLogs}
              />
              Enable Drawing Tools
            </label>

            {/* Quick: Draw Polygon */}
            <div className="mb-3">
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                onClick={startDrawPolygon}
                disabled={!hasLogs}
              >
                <PenTool className="h-4 w-4 mr-2" />
                Draw Polygon
              </Button>
              <p className="text-xs text-gray-500 mt-1">
                Click to start drawing polygon on the map.
              </p>
            </div>

            {/* Advanced options */}
            <div
              className={`pl-3 space-y-4 text-sm ${
                safeUi.drawEnabled ? "" : "opacity-50 pointer-events-none"
              }`}
            >
              {/* Shape Type */}
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-gray-700">Shape</Label>
                <select
                  value={safeUi.shapeMode}
                  onChange={(e) => onUIChange?.({ shapeMode: e.target.value })}
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="polygon">Polygon</option>
                  <option value="rectangle">Rectangle</option>
                  <option value="circle">Circle</option>
                </select>
              </div>

              {/* Pixelate all shapes */}
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!safeUi.drawPixelateRect}
                  onChange={(e) => onUIChange?.({ drawPixelateRect: e.target.checked })}
                />
                <span className="font-medium">Pixelate shape into grid</span>
              </label>

              {/* Cell size */}
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

              <p className="text-xs text-gray-500 pt-1 leading-snug">
                Draw any shape. Enable pixelate to create a colored grid based on signal values.
              </p>
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

      {/* Right: Header controls + User */}
      <div className="flex items-center space-x-4">
        {/* Filters button in header */}
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setFiltersOpen(true)}
          title="Open filters"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          Filters
        </Button>

        {/* Sidebar component controlled from header */}
        <MapSidebarFloating
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          hideTrigger={true}          // <-- removes floating toggle button
          onApplyFilters={onApplyFilters}
          onClearFilters={onClearFilters}
          onUIChange={onUIChange}
          ui={ui}
          initialFilters={initialFilters}
          position="left"
          autoCloseOnApply={true}
        />

        {/* <button className=" flex  bg-blue-600 px-2 py-1 rounded-[5px] hover:bg-blue-800" onClick={()=>{
          setPreview(!preview)
        }}>
          <Upload className="h-4 w-4 mr-2 " />
          Upload Image
        </button> */}

        {preview && <div className="absolute right-0 mt-2 bg-white text-gray-800 rounded-lg shadow-lg p-4 w-72 z-50">
          <h1>hello world</h1>
          </div>}
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