import React, { useState, useMemo } from "react";
import { Antenna, MapPin, Signal, BarChart3, Globe } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ComposedChart,
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer } from "../../common/ChartContainer";
import { EmptyState } from "../../common/EmptyState";
import { PCI_COLOR_PALETTE } from "@/components/map/layers/MultiColorCirclesLayer";
import { CHART_CONFIG } from "@/utils/constants";

export const PciColorLegend = React.forwardRef(({ locations }, ref) => {
  const [viewMode, setViewMode] = useState("color-map");

  const pciColorMap = useMemo(() => {
    if (!locations?.length) return [];

    const pciStats = locations.reduce((acc, loc) => {
      const pci = loc.pci || "Unknown";
      if (!acc[pci]) {
        acc[pci] = {
          count: 0,
          samples: [],
          providers: {},
          operators: {},
          bands: {},
          nodebIds: new Set(),
          avgRsrp: [],
          avgRsrq: [],
          avgSinr: [],
          avgMos: [],
          avgDl: [],
          avgUl: [],
        };
      }

      acc[pci].count++;
      acc[pci].samples.push(loc);

      // Track providers, operators, bands
      const provider = loc.provider || "Unknown";
      const operator = loc.operator || "Unknown";
      const band = loc.band || "Unknown";

      acc[pci].providers[provider] = (acc[pci].providers[provider] || 0) + 1;
      acc[pci].operators[operator] = (acc[pci].operators[operator] || 0) + 1;
      acc[pci].bands[band] = (acc[pci].bands[band] || 0) + 1;

      if (loc.nodeb_id != null && loc.nodeb_id !== "Unknown") {
        acc[pci].nodebIds.add(String(loc.nodeb_id));
      }

      // Collect metrics
      if (loc.rsrp != null) acc[pci].avgRsrp.push(loc.rsrp);
      if (loc.rsrq != null) acc[pci].avgRsrq.push(loc.rsrq);
      if (loc.sinr != null) acc[pci].avgSinr.push(loc.sinr);
      if (loc.mos != null) acc[pci].avgMos.push(loc.mos);
      if (loc.dl_thpt != null) acc[pci].avgDl.push(parseFloat(loc.dl_thpt));
      if (loc.ul_thpt != null) acc[pci].avgUl.push(parseFloat(loc.ul_thpt));

      return acc;
    }, {});

    return Object.entries(pciStats)
      .map(([pci, data]) => {
        const pciNum = parseInt(pci);
        const colorIndex = isNaN(pciNum) ? 0 : pciNum % PCI_COLOR_PALETTE.length;

        return {
          pci,
          color: PCI_COLOR_PALETTE[colorIndex],
          colorIndex,
          count: data.count,
          providers: data.providers,
          operators: data.operators,
          bands: data.bands,
          nodebIds: Array.from(data.nodebIds).sort(),
          avgRsrp: data.avgRsrp.length > 0
            ? (data.avgRsrp.reduce((a, b) => a + b, 0) / data.avgRsrp.length).toFixed(1)
            : null,
          avgRsrq: data.avgRsrq.length > 0
            ? (data.avgRsrq.reduce((a, b) => a + b, 0) / data.avgRsrq.length).toFixed(1)
            : null,
          avgSinr: data.avgSinr.length > 0
            ? (data.avgSinr.reduce((a, b) => a + b, 0) / data.avgSinr.length).toFixed(1)
            : null,
          avgMos: data.avgMos.length > 0
            ? (data.avgMos.reduce((a, b) => a + b, 0) / data.avgMos.length).toFixed(2)
            : null,
          avgDl: data.avgDl.length > 0
            ? (data.avgDl.reduce((a, b) => a + b, 0) / data.avgDl.length).toFixed(1)
            : null,
          avgUl: data.avgUl.length > 0
            ? (data.avgUl.reduce((a, b) => a + b, 0) / data.avgUl.length).toFixed(1)
            : null,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [locations]);

  if (!pciColorMap.length) {
    return (
      <ChartContainer ref={ref} title="PCI Analysis" icon={Antenna}>
        <EmptyState message="No PCI data available" />
      </ChartContainer>
    );
  }

  const ViewModeButton = ({ mode, icon: Icon, label }) => (
    <button
      onClick={() => setViewMode(mode)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-all rounded-md ${
        viewMode === mode
          ? "bg-blue-600 text-white shadow-md"
          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );

  return (
    <ChartContainer ref={ref} title={`PCI Analysis (${pciColorMap.length} PCIs)`} icon={Antenna}>
      {/* View Mode Buttons */}
      <div className="flex flex-wrap gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700 mb-3">
        <ViewModeButton mode="color-map" icon={MapPin} label="Color Map" />
        <ViewModeButton mode="by-provider" icon={Globe} label="By Provider" />
        <ViewModeButton mode="performance" icon={Signal} label="Performance" />
        <ViewModeButton mode="distribution" icon={BarChart3} label="Distribution" />
      </div>

      {/* Color Map View */}
      {viewMode === "color-map" && (
        <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
          {pciColorMap.map((item, idx) => (
            <PCIColorMapCard key={idx} item={item} />
          ))}
        </div>
      )}

      {/* Performance View */}
      {viewMode === "performance" && (
        <PCIPerformanceView pciColorMap={pciColorMap.slice(0, 10)} />
      )}

      {/* Distribution View */}
      {viewMode === "distribution" && (
        <PCIDistributionView pciColorMap={pciColorMap} locations={locations} />
      )}
    </ChartContainer>
  );
});

// Sub-components
const PCIColorMapCard = ({ item }) => (
  <div className="flex flex-col gap-2 p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors border border-slate-700">
    <div className="flex items-center gap-2">
      <div
        className="w-6 h-6 rounded-full border-2 border-slate-600 flex-shrink-0"
        style={{ backgroundColor: item.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-white text-sm">PCI {item.pci}</span>
          <span className="text-xs text-slate-400">{item.count} samples</span>
        </div>
      </div>
    </div>

    {item.nodebIds?.length > 0 && (
      <div className="mt-1 pt-2 border-t border-slate-700">
        <div className="text-slate-400 mb-1 text-[10px] font-medium">
          🏢 Cell IDs ({item.nodebIds.length}):
        </div>
        <div className="flex flex-wrap gap-1">
          {item.nodebIds.map((nodeb, nodebIdx) => (
            <span
              key={`${nodeb}-${nodebIdx}`}
              className="bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded border border-orange-500/30 text-[9px] font-mono"
            >
              {nodeb}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const PCIPerformanceView = ({ pciColorMap }) => (
  <div className="space-y-3">
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={pciColorMap} margin={{ ...CHART_CONFIG.margin, bottom: 60 }}>
        <CartesianGrid {...CHART_CONFIG.grid} />
        <XAxis
          dataKey={(item) => `PCI ${item.pci}`}
          angle={-45}
          textAnchor="end"
          height={80}
          tick={{ fill: "#9CA3AF", fontSize: 11 }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: "#9CA3AF", fontSize: 12 }}
          label={{ value: "Signal (dBm)", angle: -90, position: "insideLeft", fill: "#9CA3AF" }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          domain={[0, 5]}
          tick={{ fill: "#9CA3AF", fontSize: 12 }}
          label={{ value: "MOS", angle: 90, position: "insideRight", fill: "#9CA3AF" }}
        />
        <Tooltip contentStyle={CHART_CONFIG.tooltip} />
        <Legend wrapperStyle={{ fontSize: "11px" }} />
        <Bar yAxisId="left" dataKey="avgRsrp" fill="#3b82f6" name="Avg RSRP (dBm)" radius={[8, 8, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="avgMos" stroke="#facc15" strokeWidth={2} name="Avg MOS" dot={{ r: 4 }} />
      </ComposedChart>
    </ResponsiveContainer>

    {/* Performance Table */}
    <div className="overflow-x-auto max-h-[250px] overflow-y-auto scrollbar-hide">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-slate-900 z-10">
          <tr className="border-b border-slate-700">
            <th className="text-left p-2 text-slate-400 font-medium">PCI</th>
            <th className="text-center p-2 text-slate-400 font-medium">Cells</th>
            <th className="text-center p-2 text-slate-400 font-medium">RSRP</th>
            <th className="text-center p-2 text-slate-400 font-medium">SINR</th>
            <th className="text-center p-2 text-slate-400 font-medium">MOS</th>
          </tr>
        </thead>
        <tbody>
          {pciColorMap.map((item, idx) => (
            <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/50">
              <td className="p-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-white">PCI {item.pci}</span>
                </div>
              </td>
              <td className="p-2 text-center text-orange-400">{item.nodebIds.length}</td>
              <td className={`p-2 text-center font-semibold ${
                item.avgRsrp >= -90 ? "text-green-400" : item.avgRsrp >= -105 ? "text-yellow-400" : "text-red-400"
              }`}>
                {item.avgRsrp || "N/A"}
              </td>
              <td className="p-2 text-center text-green-400 font-semibold">{item.avgSinr || "N/A"}</td>
              <td className="p-2 text-center text-yellow-400 font-semibold">{item.avgMos || "N/A"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PCIDistributionView = ({ pciColorMap, locations }) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-4">
      {/* Pie Chart */}
      <div>
        <div className="text-xs text-slate-400 mb-2 font-medium">Top 10 PCIs by Sample Count</div>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pciColorMap.slice(0, 10)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ pci, count }) => `${pci}: ${count}`}
              outerRadius={80}
              dataKey="count"
            >
              {pciColorMap.slice(0, 10).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_CONFIG.tooltip} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Band Distribution */}
      <div>
        <div className="text-xs text-slate-400 mb-2 font-medium">Band Distribution (Top 5 PCIs)</div>
        <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-hide">
          {pciColorMap.slice(0, 5).map((item, idx) => (
            <div key={idx} className="bg-slate-800 rounded-lg p-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-white text-sm">PCI {item.pci}</span>
                </div>
                {item.nodebIds.length > 0 && (
                  <span className="text-[10px] text-orange-400 bg-orange-500/20 px-2 py-0.5 rounded">
                    {item.nodebIds.length} Cell{item.nodebIds.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="ml-5 space-y-1">
                {Object.entries(item.bands).map(([band, count], bidx) => {
                  const percentage = ((count / item.count) * 100).toFixed(0);
                  return (
                    <div key={bidx} className="flex items-center gap-2">
                      <div className="flex-1 bg-slate-900 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full flex items-center justify-end pr-1"
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 15 && (
                            <span className="text-[10px] text-white font-bold">{percentage}%</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-slate-300 w-16">Band {band}</span>
                      <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* Summary Stats */}
    <div className="grid grid-cols-5 gap-2 mt-4">
      <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
        <div className="text-xs text-slate-400 mb-1">Unique PCIs</div>
        <div className="text-2xl font-bold text-blue-400">{pciColorMap.length}</div>
      </div>
      <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
        <div className="text-xs text-slate-400 mb-1">Total Samples</div>
        <div className="text-2xl font-bold text-green-400">
          {pciColorMap.reduce((sum, p) => sum + p.count, 0)}
        </div>
      </div>
      <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
        <div className="text-xs text-slate-400 mb-1">Avg per PCI</div>
        <div className="text-2xl font-bold text-purple-400">
          {(pciColorMap.reduce((sum, p) => sum + p.count, 0) / pciColorMap.length).toFixed(0)}
        </div>
      </div>
      <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
        <div className="text-xs text-slate-400 mb-1">Total Cells</div>
        <div className="text-2xl font-bold text-orange-400">
          {pciColorMap.reduce((sum, p) => sum + p.nodebIds.length, 0)}
        </div>
      </div>
      <div className="bg-slate-800 rounded-lg p-3 text-center hover:bg-slate-750 transition-colors">
        <div className="text-xs text-slate-400 mb-1">Providers</div>
        <div className="text-2xl font-bold text-cyan-400">
          {[...new Set(locations.map((l) => l.provider || "Unknown"))].length}
        </div>
      </div>
    </div>
  </div>
);

PciColorLegend.displayName = "PciColorLegend";