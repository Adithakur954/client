import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PenTool, XCircle, Download, ChevronDown, ChevronUp } from "lucide-react";
import { Label } from "@/components/ui/label";

/**
 * Floating Drawing Controls Panel (without header)
 * Can be positioned anywhere on the map
 */
export default function DrawingControlsPanel({
  ui,
  onUIChange,
  hasLogs,
  polygonStats,
  onDownloadStatsCsv,
  onDownloadRawCsv,
  position = "top-right", // "top-right" | "top-left" | "bottom-right" | "bottom-left"
}) {
  const [dropOpen, setDropOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fallbacks for missing ui keys
  const safeUi = {
    drawEnabled: false,
    shapeMode: "polygon",
    drawPixelateRect: false,
    drawCellSizeMeters: 100,
    drawClearSignal: 0,
    ...ui,
  };

  // Close dropdown when clicking outside
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
    onUIChange?.({ drawClearSignal: (safeUi.drawClearSignal || 0) + 1, drawEnabled: false });
  };

  // Position classes
  const positionClasses = {
    "top-right": "top-20 right-4",
    "top-left": "top-20 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  return (
    <div
      className={`absolute ${positionClasses[position]} z-40`}
      ref={dropdownRef}
    >
      {/* Toggle Button */}
      <button
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
          dropOpen
            ? "bg-blue-600 text-white"
            : "bg-white text-gray-700 hover:bg-gray-50"
        }`}
        onClick={() => setDropOpen((p) => !p)}
        aria-expanded={dropOpen}
      >
        <PenTool className="w-4 h-4" />
        <span>Draw / Analyze</span>
        {dropOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Dropdown Panel */}
      {dropOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-80 bg-white text-gray-900 rounded-lg shadow-2xl ring-1 ring-gray-200 p-4 z-50"
          role="menu"
        >
          {!hasLogs && (
            <div className="mb-3 p-2 rounded bg-amber-50 text-amber-800 text-xs">
              ⚠️ Load/fetch logs first to enable drawing.
            </div>
          )}

          {/* Master toggle */}
          <label className="flex items-center gap-2 font-medium text-sm mb-3">
            <input
              type="checkbox"
              checked={!!safeUi.drawEnabled}
              onChange={(e) => onUIChange?.({ drawEnabled: e.target.checked })}
              disabled={!hasLogs}
              className="w-4 h-4"
            />
            Enable Drawing Tools
          </label>

          {/* Quick: Draw Polygon */}
          <div className="mb-4">
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={startDrawPolygon}
              disabled={!hasLogs}
            >
              <PenTool className="h-4 w-4 mr-2" />
              Start Drawing Polygon
            </Button>
            <p className="text-xs text-gray-500 mt-1">
              Click to activate drawing mode on the map.
            </p>
          </div>

          {/* Advanced options */}
          <div
            className={`space-y-3 text-sm ${
              safeUi.drawEnabled ? "" : "opacity-50 pointer-events-none"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-gray-700 font-medium">Shape Type</Label>
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

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!safeUi.drawPixelateRect}
                onChange={(e) => onUIChange?.({ drawPixelateRect: e.target.checked })}
                disabled={safeUi.shapeMode !== "rectangle"}
                className="w-4 h-4"
              />
              <span className="text-xs">Pixelate rectangle into grid</span>
            </label>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-700 flex-shrink-0">Cell size:</Label>
              <input
                type="number"
                min={10}
                step={10}
                value={safeUi.drawCellSizeMeters ?? 100}
                onChange={(e) =>
                  onUIChange?.({
                    drawCellSizeMeters: Math.max(10, Number(e.target.value || 100)),
                  })
                }
                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
                disabled={!safeUi.drawPixelateRect || safeUi.shapeMode !== "rectangle"}
              />
              <span className="text-xs text-gray-600">meters</span>
            </div>

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

          {/* Downloads */}
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-2">📥 Export Data</div>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={onDownloadStatsCsv}
                disabled={!polygonStats || !polygonStats.stats}
                title={!polygonStats?.stats ? "Draw a polygon first" : "Download polygon stats (CSV)"}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Stats CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={onDownloadRawCsv}
                disabled={!polygonStats || !polygonStats.logs || polygonStats.logs.length === 0}
                title={
                  !polygonStats?.logs?.length
                    ? "Draw a polygon with logs first"
                    : "Download raw logs inside polygon (CSV)"
                }
              >
                <Download className="h-4 w-4 mr-2" />
                Download Raw Logs CSV
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100 leading-snug">
            💡 Tip: Draw shapes on the map to analyze logs. Stats are computed from logs inside the shape.
          </p>
        </div>
      )}
    </div>
  );
}