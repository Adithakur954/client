// src/components/prediction/PredictionSide.jsx
import React, { useMemo, useState } from "react";
import { Filter, X, SlidersHorizontal, ArrowRightLeft } from "lucide-react";
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

const PanelSection = ({ title, children, className }) => (
  <div className={`space-y-2 ${className}`}>
    {title && (
      <div className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {title}
      </div>
    )}
    <div className="rounded-lg border p-3 bg-white dark:bg-slate-900">
      {children}
    </div>
  </div>
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

  // optional to preserve when going back to Session Map
  sessionId,
}) {
  const navigate = useNavigate();

  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof controlledOpen === "boolean";
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v) => {
    if (!isControlled) setInternalOpen(v);
    onOpenChange?.(v);
  };

  const sideClasses = useMemo(() => {
    const base =
      "fixed top-0 h-full z-50 w-[90vw] sm:w-[360px] bg-white dark:bg-slate-950 dark:text-white shadow-2xl transition-transform duration-200 ease-out";
    if (position === "right") {
      return isOpen
        ? `${base} right-0 translate-x-0`
        : `${base} right-0 translate-x-full`;
    }
    return isOpen
      ? `${base} left-0 translate-x-0`
      : `${base} left-0 -translate-x-full`;
  }, [isOpen, position]);

  const applyAndClose = () => {
    reloadData?.();
    if (autoCloseOnApply) setOpen(false);
  };

  // ✅ Corrected navigation function
  const handleNavigate = () => {
    console.log(sessionId,"is session coming")
    const q = new URLSearchParams();
    if (projectId) q.set("project_id", String(projectId));
    if (sessionId) q.set("session", String(sessionId));

    navigate(`/map?${q.toString()}`);
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      <div className={sideClasses}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b dark:border-slate-700">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <h3 className="text-base font-semibold">Prediction View Controls</h3>
          </div>
          <button
            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="h-[calc(100%-120px)] overflow-y-auto p-3 space-y-4">
          <PanelSection title="Project Details">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="pb-1 text-xs">Project ID</Label>
                <Input
                  type="number"
                  value={projectId ?? ""}
                  onChange={(e) =>
                    setProjectId?.(
                      e.target.value ? Number(e.target.value) : ""
                    )
                  }
                  className="w-full border rounded px-2 py-1 text-sm h-9 text-white bg-slate-800 dark:border-slate-700"
                  placeholder="Enter Project ID"
                />
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Metric Display">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="pb-1 text-xs">Metric</Label>
                <Select value={metric} onValueChange={setMetric}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select Metric..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rsrp">RSRP</SelectItem>
                    <SelectItem value="rsrq">RSRQ</SelectItem>
                    <SelectItem value="sinr">SINR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Display Options">
            <div className="space-y-2 text-sm">
              {setShowPolys && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!showPolys}
                    onChange={(e) => setShowPolys(e.target.checked)}
                  />
                  Show Project Polygons
                </label>
              )}
              {setOnlyInside && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!onlyInside}
                    onChange={(e) => setOnlyInside(e.target.checked)}
                  />
                  Show Only Points Inside
                </label>
              )}

              <div className="pt-2 border-t mt-3 dark:border-slate-700">
                <Label className="pb-1 text-xs">Basemap Style</Label>
                <Select
                  value={ui?.basemapStyle || "roadmap"}
                  onValueChange={(v) => onUIChange?.({ basemapStyle: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select style..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="roadmap">Default (Roadmap)</SelectItem>
                    <SelectItem value="satellite">Satellite</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                    <SelectItem value="terrain">Terrain</SelectItem>
                    <SelectItem value="clean">Clean (Custom)</SelectItem>
                    <SelectItem value="night">Night (Custom)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PanelSection>

          <PanelSection>
            <Button onClick={handleNavigate} className="w-full">
              Show Samples
            </Button>
          </PanelSection>
        </div>

        {/* Footer */}
        <div className="p-3 border-t dark:border-slate-700 flex flex-col gap-2">
          <Button
            className="w-full"
            onClick={applyAndClose}
            disabled={loading || !projectId}
          >
            <Filter className="h-4 w-4 mr-2" />
            {loading ? "Loading..." : "Reload Prediction Data"}
          </Button>

          <Button
            variant="secondary"
            className="w-full flex items-center justify-center gap-2"
            onClick={handleNavigate}
            disabled={!projectId}
          >
            <ArrowRightLeft className="h-4 w-4" />
            Show Sample Map
          </Button>
        </div>
      </div>
    </>
  );
}
