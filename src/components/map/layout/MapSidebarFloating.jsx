import React, { useEffect, useMemo, useState } from "react";
import { Filter, X, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mapViewApi } from "@/api/apiEndpoints";

const getYesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d;
};

const defaultFilters = {
  startDate: getYesterday(),
  endDate: new Date(),
  provider: "ALL",
  technology: "ALL",
  band: "ALL",
  measureIn: "rsrp",
};

const normalizeProviderName = (raw) => {
  if (!raw) return "Unknown";
  const s = String(raw).trim();
  if (/^\/+$/.test(s)) return "Unknown"; // ////// etc.
  if (s.replace(/\s+/g, "") === "404011") return "Unknown";
  const cleaned = s.toUpperCase().replace(/[\s\-_]/g, "");
  if (cleaned.includes("JIO") || /^(IND)?JIO(4G|5G|TRUE5G)?$/.test(cleaned)) return "JIO";
  if (cleaned.includes("AIRTEL") || /^INDAIRTEL$/.test(cleaned)) return "Airtel";
  if (cleaned === "VI" || cleaned.includes("VIINDIA") || cleaned.includes("VODAFONE") || cleaned.includes("IDEA")) return "VI India";
  return s;
};

const isObjectNonEmpty = (obj) => obj && typeof obj === "object" && Object.keys(obj).length > 0;

const PanelSection = ({ title, children }) => (
  <div className="space-y-2">
    <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{title}</div>
    <div className="rounded-lg border p-3 bg-white dark:bg-slate-900">{children}</div>
  </div>
);

export default function MapSidebarFloating({
  onApplyFilters,
  onClearFilters,
  onUIChange,
  ui,
  initialFilters,
  position = "left", // "left" | "right"
  autoCloseOnApply = true,
}) {
  const [open, setOpen] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [providers, setProviders] = useState([]);
  const [technologies, setTechnologies] = useState([]);
  const [bands, setBands] = useState([]);
  const [projects, setProjects] = useState([]);

  const hasActiveFilters = isObjectNonEmpty(initialFilters);

  useEffect(() => {
    if (!initialFilters) return;
    setFilters((prev) => ({ ...prev, ...initialFilters }));
  }, [initialFilters]);

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [provRes, techRes, bandsRes, projRes] = await Promise.all([
          mapViewApi.getProviders(),
          mapViewApi.getTechnologies(),
          mapViewApi.getBands(),
          mapViewApi.getProjects?.(),
        ]);

        const provList = Array.isArray(provRes) ? provRes : [];
        const normalizedSet = new Set(provList.map((p) => normalizeProviderName(p.name)));
        const normalizedProviders = Array.from(normalizedSet).map((name) => ({ id: name, name }));

        setProviders(normalizedProviders);
        setTechnologies(Array.isArray(techRes) ? techRes : []);
        setBands(Array.isArray(bandsRes) ? bandsRes : []);

        const projData = Array.isArray(projRes?.Data) ? projRes.Data : (Array.isArray(projRes) ? projRes : []);
        const projList = projData.map((p) => ({ id: p.id, name: p.project_name }));
        setProjects(projList);
      } catch (error) {
        console.error("Failed to fetch filter options", error);
      }
    };
    fetchFilterOptions();
  }, []);

  const handleFilterChange = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const sideClasses = useMemo(() => {
    const base = "fixed top-0 h-full z-50 w-[90vw] sm:w-[360px] bg-white dark:bg-slate-950 dark:text-white shadow-2xl transition-transform duration-200 ease-out";
    if (position === "right") {
      return open ? `${base} right-0 translate-x-0` : `${base} right-0 translate-x-full`;
    }
    return open ? `${base} left-0 translate-x-0` : `${base} left-0 -translate-x-full`;
  }, [open, position]);

  const fabPosition = useMemo(() => {
    const base = "fixed z-40";
    return position === "right" ? `${base} top-4 right-4` : `${base} top-4 left-4`;
  }, [position]);

  const applyAndClose = () => {
    onApplyFilters?.(filters, "logs");
    if (autoCloseOnApply) setOpen(false);
  };

  const clearAndClose = () => {
    onClearFilters?.();
    setOpen(false);
  };

  return (
    <>
      {/* Floating Filter Button */}
      <button
        type="button"
        className={`${fabPosition} inline-flex items-center gap-2 mt-15 ml-50 rounded-full px-4 py-2 bg-blue-600 text-white shadow-lg hover:bg-blue-700 focus:outline-none`}
        onClick={() => setOpen(true)}
        aria-label="Open filters"
      >
        <Filter size={16} />
        Filters
        {hasActiveFilters && (
          <span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-400" title="Filters active" />
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer Panel */}
      <div className={sideClasses}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            <h3 className="text-base font-semibold">Map Filters</h3>
          </div>
          <button className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="h-[calc(100%-112px)] overflow-y-auto p-3 space-y-4">
          <PanelSection title="Date Range">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="pb-2">Start</Label>
                <DatePicker className="w-70" date={filters.startDate} setDate={(d) => handleFilterChange("startDate", d)} />
              </div>
              <br />
              <div>
                <Label className="pb-2">End</Label>
                <DatePicker className="w-70" date={filters.endDate} setDate={(d) => handleFilterChange("endDate", d)} />
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Filter by">
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="pb-2">Provider</Label>
                <Select value={filters.provider} onValueChange={(v) => handleFilterChange("provider", v)}>
                  <SelectTrigger><SelectValue placeholder="Select Provider..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ALL Providers</SelectItem>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="pb-2">Technology</Label>
                <Select value={filters.technology} onValueChange={(v) => handleFilterChange("technology", v)}>
                  <SelectTrigger><SelectValue placeholder="Select Technology..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ALL Technologies</SelectItem>
                    {technologies.map((t) => (
                      <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="pb-2">Band / Frequency</Label>
                <Select value={filters.band} onValueChange={(v) => handleFilterChange("band", v)}>
                  <SelectTrigger><SelectValue placeholder="Select Band..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">ALL Bands</SelectItem>
                    {bands.map((b) => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="pb-2">Visualize Metric</Label>
                <Select value={filters.measureIn} onValueChange={(v) => handleFilterChange("measureIn", v)}>
                  <SelectTrigger><SelectValue placeholder="Select metric..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rsrp">RSRP</SelectItem>
                    <SelectItem value="rsrq">RSRQ</SelectItem>
                    <SelectItem value="sinr">SINR</SelectItem>
                    <SelectItem value="ul-tpt">UL-Throughput</SelectItem>
                    <SelectItem value="dl-tpt">DL-Throughput</SelectItem>
                    <SelectItem value="lte-bler">LTE-BLER</SelectItem>
                    <SelectItem value="mos">MOS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </PanelSection>



          <PanelSection title="Layers">
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ui.showSessions}
                  onChange={(e) => onUIChange?.({ showSessions: e.target.checked })}
                  disabled={hasActiveFilters} // sessions visible only when no filters
                />
                Session Markers (when no filters)
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ui.clusterSessions}
                  onChange={(e) => onUIChange?.({ clusterSessions: e.target.checked })}
                  disabled={!ui.showSessions || hasActiveFilters}
                />
                Cluster Sessions
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ui.showLogsCircles}
                  onChange={(e) => onUIChange?.({ showLogsCircles: e.target.checked })}
                  disabled={!hasActiveFilters}
                />
                Logs as Circles
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ui.showHeatmap}
                  onChange={(e) => onUIChange?.({ showHeatmap: e.target.checked })}
                  disabled={!hasActiveFilters}
                />
                Heatmap
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ui.renderVisibleLogsOnly}
                  onChange={(e) => onUIChange?.({ renderVisibleLogsOnly: e.target.checked })}
                  disabled={!hasActiveFilters}
                />
                Render Visible Logs Only
              </label>
            </div>
          </PanelSection>

          <PanelSection title="Drawing & Analysis">
            <div className="space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!ui.drawEnabled}
                  onChange={(e) => onUIChange?.({ drawEnabled: e.target.checked })}
                />
                Enable Drawing Tools
              </label>

              <div className={`pl-5 space-y-2 ${ui.drawEnabled ? "" : "opacity-50 pointer-events-none"}`}>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!ui.drawPixelateRect}
                    onChange={(e) => onUIChange?.({ drawPixelateRect: e.target.checked })}
                  />
                  Pixelate rectangle
                </label>

                <div className="flex items-center gap-2">
                  <Label className="text-xs">Cell size</Label>
                  <input
                    type="number"
                    min={10}
                    step={10}
                    value={ui.drawCellSizeMeters ?? 100}
                    onChange={(e) =>
                      onUIChange?.({ drawCellSizeMeters: Math.max(10, Number(e.target.value || 100)) })
                    }
                    className="w-24 px-2 py-1 rounded border"
                  />
                  <span className="text-xs">m</span>
                </div>

                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onUIChange?.({ drawClearSignal: (ui.drawClearSignal || 0) + 1 })}
                  >
                    Clear drawings
                  </Button>
                </div>

                <p className="text-xs text-slate-500">
                  Draw rectangle/circle/polygon on the map. Rectangle can be split into a grid for per‑cell stats.
                </p>
              </div>
            </div>
          </PanelSection>

          <PanelSection title="Basemap Style">
            <Select value={ui.basemapStyle} onValueChange={(v) => onUIChange?.({ basemapStyle: v })}>
              <SelectTrigger><SelectValue placeholder="Select style..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="clean">Clean</SelectItem>
                <SelectItem value="night">Night</SelectItem>
              </SelectContent>
            </Select>
          </PanelSection>
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={clearAndClose}>Clear</Button>
          <Button className="flex-1" onClick={applyAndClose}>
            <Filter className="h-4 w-4 mr-2" /> Apply & Fetch Logs
          </Button>
        </div>
      </div>
    </>
  );
}