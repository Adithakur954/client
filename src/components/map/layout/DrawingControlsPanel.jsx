import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PenTool, XCircle, Download, ChevronDown, ChevronUp, Info, Search, Map as MapIcon } from "lucide-react";
import { Label } from "@/components/ui/label";

export default function DrawingControlsPanel({
  ui,
  onUIChange,
  hasLogs,
  polygonStats,
  onDownloadStatsCsv,
  onDownloadRawCsv,
  onFetchLogs,
  position = "top-right",
}) {
  const [dropOpen, setDropOpen] = useState(false);
  const dropdownRef = useRef(null);

  const safeUi = {
    drawEnabled: false,
    shapeMode: "polygon",
    drawPixelateRect: false,
    drawCellSizeMeters: 100,
    drawClearSignal: 0,
    colorizeCells: true,
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

  const positionClasses = {
    "top-right": "top-20 right-4",
    "top-left": "top-20 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "relative": "",
  };

  const hasShape = polygonStats && (polygonStats.area > 0 || polygonStats.geometry);
  const sessionCount = polygonStats?.intersectingSessions?.length || 0;

  return (
    <div className={`${positionClasses[position] || positionClasses["top-right"]} z-40`} ref={dropdownRef}>
      <button
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all ${
          dropOpen
            ? "bg-blue-600 text-white"
            : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-600"
        }`}
        onClick={() => setDropOpen((p) => !p)}
      >
        <PenTool className="w-4 h-4" />
        <span>Drawing Tool</span>
        {dropOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {dropOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white text-gray-900 rounded-lg shadow-2xl ring-1 ring-gray-200 p-4 z-50">
          
          

          <label className="flex items-center gap-2 font-medium text-sm mb-3 cursor-pointer">
            <input
              type="checkbox"
              checked={!!safeUi.drawEnabled}
              onChange={(e) => onUIChange?.({ drawEnabled: e.target.checked })}
              className="w-4 h-4"
            />
            Enable Drawing Tools
          </label>

          <div className="mb-4">
            <Button
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={startDrawPolygon}
            >
              <PenTool className="h-4 w-4 mr-2" />
              Start Drawing Polygon
            </Button>
          </div>

          {/* DYNAMIC FETCH BUTTON */}
          {!hasLogs && hasShape && (
            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-md animate-in fade-in slide-in-from-top-2">
              <div className="text-xs text-indigo-700 mb-2 font-medium flex items-center gap-2">
                <MapIcon className="w-4 h-4" />
                {sessionCount > 0 
                  ? `Found ${sessionCount} sessions in this area.`
                  : "Area defined. No sessions found yet."}
              </div>
              
              <Button 
                size="sm" 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => {
                   setDropOpen(false);
                   onFetchLogs?.();
                }}
                disabled={sessionCount === 0}
              >
                <Search className="w-4 h-4 mr-2" />
                {sessionCount > 0 ? `View Logs for ${sessionCount} Sessions` : "Fetch Logs"}
              </Button>
            </div>
          )}

          <div className={`space-y-3 text-sm ${safeUi.drawEnabled ? "" : "opacity-50 pointer-events-none"}`}>
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-gray-700 font-medium">Shape Type</Label>
              <select
                value={safeUi.shapeMode}
                onChange={(e) => onUIChange?.({ shapeMode: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1 text-sm"
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
                className="w-4 h-4"
              />
              <span className="text-xs">Enable grid pixelation</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!safeUi.colorizeCells}
                onChange={(e) => onUIChange?.({ colorizeCells: e.target.checked })}
                disabled={!safeUi.drawPixelateRect}
                className="w-4 h-4"
              />
              <span className="text-xs">Colorize cells by metric</span>
            </label>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-700 flex-shrink-0">Cell size:</Label>
              <input
                type="number"
                min={10}
                step={10}
                value={safeUi.drawCellSizeMeters ?? 100}
                onChange={(e) =>
                  onUIChange?.({ drawCellSizeMeters: Math.max(10, Number(e.target.value || 100)) })
                }
                className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                disabled={!safeUi.drawPixelateRect}
              />
              <span className="text-xs text-gray-600">meters</span>
            </div>

            <div className="pt-3 border-t border-gray-200">
              <Button variant="secondary" size="sm" className="w-full" onClick={clearDrawings}>
                <XCircle className="h-4 w-4 mr-2" />
                Clear All Drawings
              </Button>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-xs font-semibold text-gray-700 mb-2">📥 Export Data</div>
            <div className="space-y-2">
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={onDownloadStatsCsv}
                disabled={!polygonStats?.stats}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Stats CSV
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={onDownloadRawCsv}
                disabled={!polygonStats?.logs?.length}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Raw Logs CSV
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}