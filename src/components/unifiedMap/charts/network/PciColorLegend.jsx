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

      const provider = loc.provider || "Unknown";
      const operator = loc.operator || "Unknown";
      const band = loc.band || "Unknown";

      acc[pci].providers[provider] = (acc[pci].providers[provider] || 0) + 1;
      acc[pci].operators[operator] = (acc[pci].operators[operator] || 0) + 1;
      acc[pci].bands[band] = (acc[pci].bands[band] || 0) + 1;

      if (loc.nodeb_id != null && loc.nodeb_id !== "Unknown") {
        acc[pci].nodebIds.add(String(loc.nodeb_id));
      }

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
      className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium transition-all rounded ${
        viewMode === mode
          ? "bg-blue-600 text-white"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
      }`}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </button>
  );

  return (
    <ChartContainer ref={ref} title={`PCI Analysis (${pciColorMap.length})`} icon={Antenna}>
      {/* Minimal View Mode Buttons */}
      <div className="flex gap-1 mb-2">
        <ViewModeButton mode="color-map" icon={MapPin} label="Map" />
        <ViewModeButton mode="by-provider" icon={Globe} label="Provider" />
        <ViewModeButton mode="performance" icon={Signal} label="Performance" />
        <ViewModeButton mode="distribution" icon={BarChart3} label="Stats" />
      </div>

      {/* Color Map View */}
      {viewMode === "color-map" && (
        <div className="space-y-1 max-h-[350px] overflow-y-auto scrollbar-hide">
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

// Minimal Sub-components
const PCIColorMapCard = ({ item }) => (
  <div className="flex items-center gap-2 p-1.5 bg-slate-800/50 rounded hover:bg-slate-800 transition-colors">
    <div
      className="w-4 h-4 rounded-full flex-shrink-0"
      style={{ backgroundColor: item.color }}
    />
    <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
      <span className="font-medium text-white text-xs">PCI {item.pci}</span>
      <span className="text-[10px] text-slate-400">{item.count}</span>
    </div>
    {item.nodebIds?.length > 0 && (
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
          {item.nodebIds.length} Cell{item.nodebIds.length > 1 ? 's' : ''}
        </span>
      </div>
    )}
  </div>
);

const PCIPerformanceView = ({ pciColorMap }) => (
  <div className="space-y-2">
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={pciColorMap} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey={(item) => item.pci}
          angle={-45}
          textAnchor="end"
          height={50}
          tick={{ fill: "#94A3B8", fontSize: 9 }}
        />
        <YAxis yAxisId="left" tick={{ fill: "#94A3B8", fontSize: 9 }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: "#94A3B8", fontSize: 9 }} />
        <Tooltip contentStyle={{ ...CHART_CONFIG.tooltip, fontSize: '10px' }} />
        <Bar yAxisId="left" dataKey="avgRsrp" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Line yAxisId="right" type="monotone" dataKey="avgMos" stroke="#facc15" strokeWidth={1.5} dot={{ r: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>

    {/* Compact Performance Table */}
    <div className="overflow-x-auto max-h-[200px] overflow-y-auto scrollbar-hide">
      <table className="w-full text-[10px]">
        <thead className="sticky top-0 bg-slate-900 z-10">
          <tr className="border-b border-slate-700">
            <th className="text-left p-1 text-slate-400 font-medium">PCI</th>
            <th className="text-center p-1 text-slate-400 font-medium">Cells</th>
            <th className="text-center p-1 text-slate-400 font-medium">RSRP</th>
            <th className="text-center p-1 text-slate-400 font-medium">SINR</th>
            <th className="text-center p-1 text-slate-400 font-medium">MOS</th>
          </tr>
        </thead>
        <tbody>
          {pciColorMap.map((item, idx) => (
            <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
              <td className="p-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-white">{item.pci}</span>
                </div>
              </td>
              <td className="p-1 text-center text-orange-400">{item.nodebIds.length}</td>
              <td className={`p-1 text-center font-medium ${
                item.avgRsrp >= -90 ? "text-green-400" : item.avgRsrp >= -105 ? "text-yellow-400" : "text-red-400"
              }`}>
                {item.avgRsrp || "-"}
              </td>
              <td className="p-1 text-center text-green-400 font-medium">{item.avgSinr || "-"}</td>
              <td className="p-1 text-center text-yellow-400 font-medium">{item.avgMos || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PCIDistributionView = ({ pciColorMap, locations }) => (
  <div className="space-y-2">
    {/* Compact Summary Stats */}
    <div className="grid grid-cols-5 gap-1">
      <StatCard label="PCIs" value={pciColorMap.length} color="blue" />
      <StatCard label="Samples" value={pciColorMap.reduce((sum, p) => sum + p.count, 0)} color="green" />
      <StatCard label="Avg/PCI" value={(pciColorMap.reduce((sum, p) => sum + p.count, 0) / pciColorMap.length).toFixed(0)} color="purple" />
      <StatCard label="Cells" value={pciColorMap.reduce((sum, p) => sum + p.nodebIds.length, 0)} color="orange" />
      <StatCard label="Providers" value={[...new Set(locations.map((l) => l.provider || "Unknown"))].length} color="cyan" />
    </div>

    <div className="grid grid-cols-2 gap-2">
      {/* Compact Pie Chart */}
      <div>
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Top 10 PCIs</div>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={pciColorMap.slice(0, 10)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ pci, count }) => `${pci}:${count}`}
              outerRadius={60}
              dataKey="count"
            >
              {pciColorMap.slice(0, 10).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ ...CHART_CONFIG.tooltip, fontSize: '10px' }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Compact Band Distribution */}
      <div>
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Band Distribution</div>
        <div className="space-y-1.5 max-h-[180px] overflow-y-auto scrollbar-hide">
          {pciColorMap.slice(0, 5).map((item, idx) => (
            <div key={idx} className="bg-slate-800/50 rounded p-1.5">
              <div className="flex items-center justify-between gap-1.5 mb-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="font-medium text-white text-[10px]">PCI {item.pci}</span>
                </div>
                {item.nodebIds.length > 0 && (
                  <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1 py-0.5 rounded">
                    {item.nodebIds.length}
                  </span>
                )}
              </div>
              <div className="ml-3 space-y-0.5">
                {Object.entries(item.bands).slice(0, 3).map(([band, count], bidx) => {
                  const percentage = ((count / item.count) * 100).toFixed(0);
                  return (
                    <div key={bidx} className="flex items-center gap-1">
                      <div className="flex-1 bg-slate-900 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-blue-500 h-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-slate-300 w-10">B{band}</span>
                      <span className="text-[9px] text-slate-400 w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const StatCard = ({ label, value, color }) => {
  const colors = {
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
    orange: "text-orange-400",
    cyan: "text-cyan-400",
  };

  return (
    <div className="bg-slate-800/50 rounded p-1.5 text-center">
      <div className="text-[9px] text-slate-400 mb-0.5">{label}</div>
      <div className={`text-lg font-bold ${colors[color]}`}>{value}</div>
    </div>
  );
};

PciColorLegend.displayName = "PciColorLegend";