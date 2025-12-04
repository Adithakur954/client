// src/components/analytics/PciColorLegend.jsx
import React, { useState, useMemo } from "react";
import { 
  Antenna, 
  MapPin, 
  Signal, 
  BarChart3, 
  Globe, 
  Layers,
  Clock,
  Wifi,
  Activity,
  ChevronDown,
  ChevronUp,
  Filter
} from "lucide-react";
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Treemap,
} from "recharts";
import { ChartContainer } from "../../common/ChartContainer";
import { EmptyState } from "../../common/EmptyState";
import { PCI_COLOR_PALETTE } from "@/components/map/layers/MultiColorCirclesLayer";
import { CHART_CONFIG } from "@/utils/constants";

// Provider color mapping
const PROVIDER_COLORS = {
  "JIO": "#3B82F6",
  "Jio": "#3B82F6",
  "Jio True5G": "#3B82F6",
  "JIO 4G": "#3B82F6",
  "JIO4G": "#3B82F6",
  "IND-JIO": "#3B82F6",
  "IND airtel": "#EF4444",
  "IND Airtel": "#EF4444",
  "Airtel": "#EF4444",
  "airtel": "#EF4444",
  "Airtel 5G": "#EF4444",
  "VI India": "#22C55E",
  "Vi India": "#22C55E",
  "Vodafone IN": "#22C55E",
  "BSNL": "#F59E0B",
  "Unknown": "#6B7280",
};

// Technology color mapping
const TECHNOLOGY_COLORS = {
  "5G": "#EC4899",
  "5G SA": "#D946EF",
  "5G NSA": "#EC4899",
  "NR (5G)": "#EC4899",
  "NR (5G SA)": "#D946EF",
  "4G": "#8B5CF6",
  "LTE": "#8B5CF6",
  "4G+ (LTE-CA)": "#A78BFA",
  "LTE (4G)": "#8B5CF6",
  "LTE-CA": "#A78BFA",
  "3G": "#22C55E",
  "HSPA": "#22C55E",
  "WCDMA": "#22C55E",
  "2G": "#6B7280",
  "GSM": "#6B7280",
  "EDGE": "#6B7280",
  "Unknown": "#9CA3AF",
};

// Band color mapping
const BAND_COLORS = {
  "1": "#EF4444",
  "3": "#F97316",
  "5": "#F59E0B",
  "7": "#84CC16",
  "8": "#22C55E",
  "20": "#14B8A6",
  "28": "#06B6D4",
  "40": "#3B82F6",
  "41": "#6366F1",
  "n28": "#8B5CF6",
  "n78": "#A855F7",
  "n258": "#D946EF",
  "Unknown": "#6B7280",
};

const getProviderColor = (provider) => {
  if (!provider) return "#6B7280";
  if (PROVIDER_COLORS[provider]) return PROVIDER_COLORS[provider];
  
  const lower = provider.toLowerCase();
  if (lower.includes("jio")) return "#3B82F6";
  if (lower.includes("airtel")) return "#EF4444";
  if (lower.includes("vi") || lower.includes("vodafone")) return "#22C55E";
  if (lower.includes("bsnl")) return "#F59E0B";
  
  return "#6B7280";
};

const getTechnologyColor = (tech) => {
  if (!tech) return "#6B7280";
  if (TECHNOLOGY_COLORS[tech]) return TECHNOLOGY_COLORS[tech];
  
  const upper = tech.toUpperCase();
  if (upper.includes("5G") || upper.includes("NR")) return "#EC4899";
  if (upper.includes("LTE") || upper.includes("4G")||upper.includes("4G+ (LTE-CA)")) return "#8B5CF6";
  if (upper.includes("3G") || upper.includes("HSPA") || upper.includes("WCDMA")) return "#22C55E";
  if (upper.includes("2G") || upper.includes("GSM") || upper.includes("EDGE")) return "#6B7280";
  
  return "#9CA3AF";
};

const getBandColor = (band) => {
  if (!band) return "#6B7280";
  const bandStr = String(band);
  return BAND_COLORS[bandStr] || BAND_COLORS[`n${bandStr}`] || "#6B7280";
};

// Helper to calculate statistics
const calculateStats = (values) => {
  if (!values || values.length === 0) return null;
  const validValues = values.filter(v => v != null && !isNaN(v));
  if (validValues.length === 0) return null;
  
  const sorted = [...validValues].sort((a, b) => a - b);
  const sum = validValues.reduce((a, b) => a + b, 0);
  const avg = sum / validValues.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  
  return {
    avg: avg.toFixed(2),
    median: median.toFixed(2),
    min: Math.min(...validValues).toFixed(2),
    max: Math.max(...validValues).toFixed(2),
    count: validValues.length,
  };
};

export const PciColorLegend = React.forwardRef(({ locations }, ref) => {
  const [viewMode, setViewMode] = useState("color-map");
  const [selectedPci, setSelectedPci] = useState(null);

  // ============================================
  // ENHANCED PCI DATA PROCESSING
  // ============================================
  const pciColorMap = useMemo(() => {
    if (!locations?.length) return [];

    const pciStats = locations.reduce((acc, loc) => {
      const pci = loc.pci != null ? String(loc.pci) : "Unknown";
      
      if (!acc[pci]) {
        acc[pci] = {
          count: 0,
          samples: [],
          providers: {},
          technologies: {},
          bands: {},
          sessions: new Set(),
          nodebIds: new Set(),
          cellIds: new Set(),
          // Metrics arrays
          rsrp: [],
          rsrq: [],
          sinr: [],
          mos: [],
          dl_tpt: [],
          ul_tpt: [],
          latency: [],
          jitter: [],
          speed: [],
          lte_bler: [],
        };
      }

      acc[pci].count++;
      acc[pci].samples.push(loc);

      // Categorical data
      const provider = loc.provider || "Unknown";
      const technology = loc.technology || "Unknown";
      const band = loc.band || "Unknown";

      acc[pci].providers[provider] = (acc[pci].providers[provider] || 0) + 1;
      acc[pci].technologies[technology] = (acc[pci].technologies[technology] || 0) + 1;
      acc[pci].bands[band] = (acc[pci].bands[band] || 0) + 1;

      // Identifiers
      if (loc.session_id != null) {
        acc[pci].sessions.add(String(loc.session_id));
      }
      if (loc.nodeb_id != null && loc.nodeb_id !== "Unknown") {
        acc[pci].nodebIds.add(String(loc.nodeb_id));
      }
      if (loc.cell_id != null && loc.cell_id !== "Unknown") {
        acc[pci].cellIds.add(String(loc.cell_id));
      }

      // Metrics
      if (loc.rsrp != null && !isNaN(loc.rsrp)) acc[pci].rsrp.push(parseFloat(loc.rsrp));
      if (loc.rsrq != null && !isNaN(loc.rsrq)) acc[pci].rsrq.push(parseFloat(loc.rsrq));
      if (loc.sinr != null && !isNaN(loc.sinr)) acc[pci].sinr.push(parseFloat(loc.sinr));
      if (loc.mos != null && !isNaN(loc.mos)) acc[pci].mos.push(parseFloat(loc.mos));
      if (loc.dl_tpt != null && !isNaN(loc.dl_tpt)) acc[pci].dl_tpt.push(parseFloat(loc.dl_tpt));
      if (loc.ul_tpt != null && !isNaN(loc.ul_tpt)) acc[pci].ul_tpt.push(parseFloat(loc.ul_tpt));
      if (loc.latency != null && !isNaN(loc.latency)) acc[pci].latency.push(parseFloat(loc.latency));
      if (loc.jitter != null && !isNaN(loc.jitter)) acc[pci].jitter.push(parseFloat(loc.jitter));
      if (loc.speed != null && !isNaN(loc.speed)) acc[pci].speed.push(parseFloat(loc.speed));
      if (loc.lte_bler != null && !isNaN(loc.lte_bler)) acc[pci].lte_bler.push(parseFloat(loc.lte_bler));

      return acc;
    }, {});

    return Object.entries(pciStats)
      .map(([pci, data]) => {
        const pciNum = parseInt(pci);
        const colorIndex = isNaN(pciNum) ? 0 : pciNum % PCI_COLOR_PALETTE.length;

        // Get dominant values
        const dominantProvider = Object.entries(data.providers).sort((a, b) => b[1] - a[1])[0];
        const dominantTechnology = Object.entries(data.technologies).sort((a, b) => b[1] - a[1])[0];
        const dominantBand = Object.entries(data.bands).sort((a, b) => b[1] - a[1])[0];

        return {
          pci,
          pciNum: isNaN(pciNum) ? -1 : pciNum,
          color: PCI_COLOR_PALETTE[colorIndex],
          colorIndex,
          count: data.count,
          
          // Categorical breakdowns
          providers: data.providers,
          technologies: data.technologies,
          bands: data.bands,
          
          // Dominant values
          dominantProvider: dominantProvider?.[0] || "Unknown",
          dominantProviderCount: dominantProvider?.[1] || 0,
          dominantTechnology: dominantTechnology?.[0] || "Unknown",
          dominantBand: dominantBand?.[0] || "Unknown",
          
          // Identifiers
          sessions: Array.from(data.sessions).sort(),
          sessionCount: data.sessions.size,
          nodebIds: Array.from(data.nodebIds).sort(),
          nodebCount: data.nodebIds.size,
          cellIds: Array.from(data.cellIds).sort(),
          cellCount: data.cellIds.size,
          
          // Calculated metrics
          avgRsrp: calculateStats(data.rsrp),
          avgRsrq: calculateStats(data.rsrq),
          avgSinr: calculateStats(data.sinr),
          avgMos: calculateStats(data.mos),
          avgDl: calculateStats(data.dl_tpt),
          avgUl: calculateStats(data.ul_tpt),
          avgLatency: calculateStats(data.latency),
          avgJitter: calculateStats(data.jitter),
          avgSpeed: calculateStats(data.speed),
          avgBler: calculateStats(data.lte_bler),
          
          // Raw arrays for detailed analysis
          rawData: {
            rsrp: data.rsrp,
            rsrq: data.rsrq,
            sinr: data.sinr,
            mos: data.mos,
            dl_tpt: data.dl_tpt,
            ul_tpt: data.ul_tpt,
            latency: data.latency,
            jitter: data.jitter,
          },
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [locations]);

  // ============================================
  // PROVIDER DATA PROCESSING
  // ============================================
  const providerPciData = useMemo(() => {
    if (!locations?.length) return { providers: [], summary: {} };

    const providerStats = {};

    locations.forEach((loc) => {
      const provider = loc.provider || "Unknown";
      const pci = loc.pci != null ? String(loc.pci) : "Unknown";
      const technology = loc.technology || "Unknown";
      const band = loc.band || "Unknown";

      if (!providerStats[provider]) {
        providerStats[provider] = {
          name: provider,
          totalCount: 0,
          pcis: {},
          technologies: {},
          bands: {},
          sessions: new Set(),
          nodebIds: new Set(),
          cellIds: new Set(),
          rsrp: [],
          rsrq: [],
          sinr: [],
          mos: [],
          dl_tpt: [],
          ul_tpt: [],
          latency: [],
          jitter: [],
        };
      }

      providerStats[provider].totalCount++;
      providerStats[provider].technologies[technology] = (providerStats[provider].technologies[technology] || 0) + 1;
      providerStats[provider].bands[band] = (providerStats[provider].bands[band] || 0) + 1;

      if (loc.session_id) providerStats[provider].sessions.add(String(loc.session_id));
      if (loc.nodeb_id) providerStats[provider].nodebIds.add(String(loc.nodeb_id));
      if (loc.cell_id) providerStats[provider].cellIds.add(String(loc.cell_id));

      if (!providerStats[provider].pcis[pci]) {
        providerStats[provider].pcis[pci] = {
          pci,
          count: 0,
          technologies: {},
          bands: {},
          cellIds: new Set(),
          nodebIds: new Set(),
          rsrp: [],
          rsrq: [],
          sinr: [],
          mos: [],
          dl_tpt: [],
          ul_tpt: [],
          latency: [],
          jitter: [],
        };
      }

      providerStats[provider].pcis[pci].count++;
      providerStats[provider].pcis[pci].technologies[technology] = 
        (providerStats[provider].pcis[pci].technologies[technology] || 0) + 1;
      providerStats[provider].pcis[pci].bands[band] = 
        (providerStats[provider].pcis[pci].bands[band] || 0) + 1;
      
      if (loc.cell_id) providerStats[provider].pcis[pci].cellIds.add(String(loc.cell_id));
      if (loc.nodeb_id) providerStats[provider].pcis[pci].nodebIds.add(String(loc.nodeb_id));

      // Collect metrics
      if (loc.rsrp != null) {
        providerStats[provider].rsrp.push(parseFloat(loc.rsrp));
        providerStats[provider].pcis[pci].rsrp.push(parseFloat(loc.rsrp));
      }
      if (loc.rsrq != null) {
        providerStats[provider].rsrq.push(parseFloat(loc.rsrq));
        providerStats[provider].pcis[pci].rsrq.push(parseFloat(loc.rsrq));
      }
      if (loc.sinr != null) {
        providerStats[provider].sinr.push(parseFloat(loc.sinr));
        providerStats[provider].pcis[pci].sinr.push(parseFloat(loc.sinr));
      }
      if (loc.mos != null) {
        providerStats[provider].mos.push(parseFloat(loc.mos));
        providerStats[provider].pcis[pci].mos.push(parseFloat(loc.mos));
      }
      if (loc.dl_tpt != null) {
        providerStats[provider].dl_tpt.push(parseFloat(loc.dl_tpt));
        providerStats[provider].pcis[pci].dl_tpt.push(parseFloat(loc.dl_tpt));
      }
      if (loc.ul_tpt != null) {
        providerStats[provider].ul_tpt.push(parseFloat(loc.ul_tpt));
        providerStats[provider].pcis[pci].ul_tpt.push(parseFloat(loc.ul_tpt));
      }
      if (loc.latency != null) {
        providerStats[provider].latency.push(parseFloat(loc.latency));
        providerStats[provider].pcis[pci].latency.push(parseFloat(loc.latency));
      }
      if (loc.jitter != null) {
        providerStats[provider].jitter.push(parseFloat(loc.jitter));
        providerStats[provider].pcis[pci].jitter.push(parseFloat(loc.jitter));
      }
    });

    // Format providers
    const providers = Object.values(providerStats)
      .map((p) => ({
        name: p.name,
        color: getProviderColor(p.name),
        totalCount: p.totalCount,
        pciCount: Object.keys(p.pcis).length,
        sessionCount: p.sessions.size,
        nodebCount: p.nodebIds.size,
        cellCount: p.cellIds.size,
        technologies: p.technologies,
        bands: p.bands,
        dominantTechnology: Object.entries(p.technologies).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
        dominantBand: Object.entries(p.bands).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
        pcis: Object.values(p.pcis)
          .map((pci) => ({
            pci: pci.pci,
            count: pci.count,
            cellCount: pci.cellIds.size,
            nodebCount: pci.nodebIds.size,
            cellIds: Array.from(pci.cellIds),
            nodebIds: Array.from(pci.nodebIds),
            dominantTech: Object.entries(pci.technologies).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
            dominantBand: Object.entries(pci.bands).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
            avgRsrp: calculateStats(pci.rsrp),
            avgRsrq: calculateStats(pci.rsrq),
            avgSinr: calculateStats(pci.sinr),
            avgMos: calculateStats(pci.mos),
            avgDl: calculateStats(pci.dl_tpt),
            avgUl: calculateStats(pci.ul_tpt),
            avgLatency: calculateStats(pci.latency),
            avgJitter: calculateStats(pci.jitter),
          }))
          .sort((a, b) => b.count - a.count),
        avgRsrp: calculateStats(p.rsrp),
        avgRsrq: calculateStats(p.rsrq),
        avgSinr: calculateStats(p.sinr),
        avgMos: calculateStats(p.mos),
        avgDl: calculateStats(p.dl_tpt),
        avgUl: calculateStats(p.ul_tpt),
        avgLatency: calculateStats(p.latency),
        avgJitter: calculateStats(p.jitter),
      }))
      .sort((a, b) => b.totalCount - a.totalCount);

    // Summary
    const summary = {
      totalProviders: providers.length,
      totalPcis: pciColorMap.length,
      totalSamples: locations.length,
      totalSessions: [...new Set(locations.map(l => l.session_id).filter(Boolean))].length,
      totalNodebs: [...new Set(locations.map(l => l.nodeb_id).filter(Boolean))].length,
      totalCells: [...new Set(locations.map(l => l.cell_id).filter(Boolean))].length,
    };

    return { providers, summary };
  }, [locations, pciColorMap]);

  // ============================================
  // TECHNOLOGY DATA PROCESSING
  // ============================================
  const technologyData = useMemo(() => {
    if (!locations?.length) return [];

    const techStats = {};

    locations.forEach((loc) => {
      const tech = loc.technology || "Unknown";
      
      if (!techStats[tech]) {
        techStats[tech] = {
          name: tech,
          count: 0,
          pcis: new Set(),
          providers: {},
          bands: {},
          rsrp: [],
          sinr: [],
          mos: [],
          dl_tpt: [],
          ul_tpt: [],
          latency: [],
        };
      }

      techStats[tech].count++;
      if (loc.pci != null) techStats[tech].pcis.add(String(loc.pci));
      
      const provider = loc.provider || "Unknown";
      const band = loc.band || "Unknown";
      techStats[tech].providers[provider] = (techStats[tech].providers[provider] || 0) + 1;
      techStats[tech].bands[band] = (techStats[tech].bands[band] || 0) + 1;

      if (loc.rsrp != null) techStats[tech].rsrp.push(parseFloat(loc.rsrp));
      if (loc.sinr != null) techStats[tech].sinr.push(parseFloat(loc.sinr));
      if (loc.mos != null) techStats[tech].mos.push(parseFloat(loc.mos));
      if (loc.dl_tpt != null) techStats[tech].dl_tpt.push(parseFloat(loc.dl_tpt));
      if (loc.ul_tpt != null) techStats[tech].ul_tpt.push(parseFloat(loc.ul_tpt));
      if (loc.latency != null) techStats[tech].latency.push(parseFloat(loc.latency));
    });

    return Object.values(techStats)
      .map((t) => ({
        name: t.name,
        color: getTechnologyColor(t.name),
        count: t.count,
        pciCount: t.pcis.size,
        dominantProvider: Object.entries(t.providers).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
        dominantBand: Object.entries(t.bands).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
        avgRsrp: calculateStats(t.rsrp),
        avgSinr: calculateStats(t.sinr),
        avgMos: calculateStats(t.mos),
        avgDl: calculateStats(t.dl_tpt),
        avgUl: calculateStats(t.ul_tpt),
        avgLatency: calculateStats(t.latency),
      }))
      .sort((a, b) => b.count - a.count);
  }, [locations]);

  // ============================================
  // CELL/NODEB DATA PROCESSING
  // ============================================
  const cellData = useMemo(() => {
    if (!locations?.length) return [];

    const cellStats = {};

    locations.forEach((loc) => {
      const nodebId = loc.nodeb_id != null ? String(loc.nodeb_id) : null;
      const cellId = loc.cell_id != null ? String(loc.cell_id) : null;
      
      if (!nodebId) return;
      
      const key = cellId ? `${nodebId}-${cellId}` : nodebId;
      
      if (!cellStats[key]) {
        cellStats[key] = {
          nodebId,
          cellId,
          key,
          count: 0,
          pcis: new Set(),
          providers: {},
          technologies: {},
          bands: {},
          rsrp: [],
          rsrq: [],
          sinr: [],
          mos: [],
          dl_tpt: [],
          ul_tpt: [],
          latency: [],
          jitter: [],
        };
      }

      cellStats[key].count++;
      if (loc.pci != null) cellStats[key].pcis.add(String(loc.pci));
      
      const provider = loc.provider || "Unknown";
      const tech = loc.technology || "Unknown";
      const band = loc.band || "Unknown";
      
      cellStats[key].providers[provider] = (cellStats[key].providers[provider] || 0) + 1;
      cellStats[key].technologies[tech] = (cellStats[key].technologies[tech] || 0) + 1;
      cellStats[key].bands[band] = (cellStats[key].bands[band] || 0) + 1;

      if (loc.rsrp != null) cellStats[key].rsrp.push(parseFloat(loc.rsrp));
      if (loc.rsrq != null) cellStats[key].rsrq.push(parseFloat(loc.rsrq));
      if (loc.sinr != null) cellStats[key].sinr.push(parseFloat(loc.sinr));
      if (loc.mos != null) cellStats[key].mos.push(parseFloat(loc.mos));
      if (loc.dl_tpt != null) cellStats[key].dl_tpt.push(parseFloat(loc.dl_tpt));
      if (loc.ul_tpt != null) cellStats[key].ul_tpt.push(parseFloat(loc.ul_tpt));
      if (loc.latency != null) cellStats[key].latency.push(parseFloat(loc.latency));
      if (loc.jitter != null) cellStats[key].jitter.push(parseFloat(loc.jitter));
    });

    return Object.values(cellStats)
      .map((c) => ({
        ...c,
        pciCount: c.pcis.size,
        pcis: Array.from(c.pcis),
        dominantProvider: Object.entries(c.providers).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
        dominantTech: Object.entries(c.technologies).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
        dominantBand: Object.entries(c.bands).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
        avgRsrp: calculateStats(c.rsrp),
        avgRsrq: calculateStats(c.rsrq),
        avgSinr: calculateStats(c.sinr),
        avgMos: calculateStats(c.mos),
        avgDl: calculateStats(c.dl_tpt),
        avgUl: calculateStats(c.ul_tpt),
        avgLatency: calculateStats(c.latency),
        avgJitter: calculateStats(c.jitter),
      }))
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
    <ChartContainer 
      ref={ref} 
      title={`PCI Analysis (${pciColorMap.length} PCIs)`} 
      icon={Antenna}
      subtitle={`${providerPciData.summary.totalSamples} samples • ${providerPciData.summary.totalNodebs} cells`}
      collapsible
      expandable
    >
      {/* View Mode Buttons */}
      <div className="flex flex-wrap gap-1 mb-3">
        <ViewModeButton mode="color-map" icon={MapPin} label="Map" />
        <ViewModeButton mode="by-provider" icon={Globe} label="Provider" />
        {/* <ViewModeButton mode="by-technology" icon={Wifi} label="Technology" /> */}
        <ViewModeButton mode="by-cell" icon={Antenna} label="Cells" />
        {/* <ViewModeButton mode="performance" icon={Signal} label="Performance" /> */}
        {/* <ViewModeButton mode="distribution" icon={BarChart3} label="Stats" /> */}
      </div>

      {/* Color Map View */}
      {viewMode === "color-map" && (
        <PCIColorMapView 
          pciColorMap={pciColorMap} 
          selectedPci={selectedPci}
          onSelectPci={setSelectedPci}
          
        />
      )}

      {/* Provider View */}
      {viewMode === "by-provider" && (
        <PCIByProviderView providerData={providerPciData.providers} />
      )}

      {/* Technology View */}
      {viewMode === "by-technology" && (
        <PCIByTechnologyView technologyData={technologyData} />
      )}

      {/* Cell/NodeB View */}
      {viewMode === "by-cell" && (
        <PCIByCellView cellData={cellData} />
      )}

      {/* Performance View */}
      {viewMode === "performance" && (
        <PCIPerformanceView pciColorMap={pciColorMap.slice(0, 15)} />
      )}

      {/* Distribution View */}
      {viewMode === "distribution" && (
        <PCIDistributionView 
          pciColorMap={pciColorMap} 
          locations={locations} 
          summary={providerPciData.summary}
        />
      )}
    </ChartContainer>
  );
});

// ==================== SUB-COMPONENTS ====================

// Enhanced Color Map View
const PCIColorMapView = ({ pciColorMap, selectedPci, onSelectPci }) => {
  const [expandedPci, setExpandedPci] = useState(null);

  return (
    <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-hide">
      {pciColorMap.map((item, idx) => (
        <div key={idx} className="bg-slate-800/50 rounded overflow-hidden">
          {/* PCI Header Row */}
          <div 
            className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-800 transition-colors ${
              expandedPci === item.pci ? 'bg-slate-800' : ''
            }`}
            onClick={() => setExpandedPci(expandedPci === item.pci ? null : item.pci)}
          >
            <div
              className="w-4 h-4 rounded-full flex-shrink-0 border-2 border-white/20"
              style={{ backgroundColor: item.color }}
            />
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-xs">PCI {item.pci}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                  {item.count} samples
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300">
                  {item.nodebIds}-{item.cellIds}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mt-0.5">
                <span 
                  className="text-[9px] px-1 py-0.5 rounded"
                  style={{ 
                    backgroundColor: `${getProviderColor(item.dominantProvider)}20`,
                    color: getProviderColor(item.dominantProvider)
                  }}
                >
                  {item.dominantProvider}
                </span>
                <span 
                  className="text-[9px] px-1 py-0.5 rounded"
                  style={{ 
                    backgroundColor: `${getTechnologyColor(item.dominantTechnology)}20`,
                    color: getTechnologyColor(item.dominantTechnology)
                  }}
                >
                  {item.dominantTechnology}
                </span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400">
                  B{item.dominantBand}
                </span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {item.nodebCount > 0 && (
                <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Antenna className="h-2.5 w-2.5" />
                  {item.nodebCount}
                </span>
              )}
              {item.cellCount > 0 && (
                <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                  {item.cellCount} cells
                </span>
              )}
              <span className="text-slate-400 text-xs">
                {expandedPci === item.pci ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {/* Expanded Details */}
          {expandedPci === item.pci && (
            <div className="border-t border-slate-700 bg-slate-900/50 p-2 space-y-2">
              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-1">
                <MetricMiniCard 
                  label="RSRP" 
                  value={item.avgRsrp?.avg} 
                  unit="dBm"
                  color={parseFloat(item.avgRsrp?.avg) >= -90 ? "green" : 
                         parseFloat(item.avgRsrp?.avg) >= -105 ? "yellow" : "red"}
                />
                <MetricMiniCard 
                  label="RSRQ" 
                  value={item.avgRsrq?.avg} 
                  unit="dB"
                  color="blue"
                />
                <MetricMiniCard 
                  label="SINR" 
                  value={item.avgSinr?.avg} 
                  unit="dB"
                  color="green"
                />
                <MetricMiniCard 
                  label="MOS" 
                  value={item.avgMos?.avg} 
                  unit=""
                  color="yellow"
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                <MetricMiniCard 
                  label="DL" 
                  value={item.avgDl?.avg} 
                  unit="Mbps"
                  color="cyan"
                />
                <MetricMiniCard 
                  label="UL" 
                  value={item.avgUl?.avg} 
                  unit="Mbps"
                  color="orange"
                />
                <MetricMiniCard 
                  label="Latency" 
                  value={item.avgLatency?.avg} 
                  unit="ms"
                  color={parseFloat(item.avgLatency?.avg) <= 50 ? "green" : 
                         parseFloat(item.avgLatency?.avg) <= 100 ? "yellow" : "red"}
                />
                <MetricMiniCard 
                  label="Jitter" 
                  value={item.avgJitter?.avg} 
                  unit="ms"
                  color="purple"
                />
              </div>

              {/* Cell IDs */}
              {item.cellIds.length > 0 && (
                <div className="text-[9px]">
                  <span className="text-slate-400">Cell IDs: </span>
                  <span className="text-cyan-400">{item.cellIds.slice(0, 5).join(', ')}</span>
                  {item.cellIds.length > 5 && (
                    <span className="text-slate-500"> +{item.cellIds.length - 5} more</span>
                  )}
                </div>
              )}

              {/* NodeB IDs */}
              {item.nodebIds.length > 0 && (
                <div className="text-[9px]">
                  <span className="text-slate-400">NodeB IDs: </span>
                  <span className="text-orange-400">{item.nodebIds.slice(0, 5).join(', ')}</span>
                  {item.nodebIds.length > 5 && (
                    <span className="text-slate-500"> +{item.nodebIds.length - 5} more</span>
                  )}
                </div>
              )}

              {/* Band Distribution */}
              {Object.keys(item.bands).length > 1 && (
                <div className="space-y-1">
                  <span className="text-[9px] text-slate-400">Band Distribution:</span>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(item.bands)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 5)
                      .map(([band, count], bidx) => (
                        <span 
                          key={bidx}
                          className="text-[9px] px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${getBandColor(band)}20`,
                            color: getBandColor(band)
                          }}
                        >
                          {band}: {count}
                        </span>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Metric Mini Card Component
const MetricMiniCard = ({ label, value, unit, color }) => {
  const colors = {
    green: "text-green-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
    blue: "text-blue-400",
    cyan: "text-cyan-400",
    orange: "text-orange-400",
    purple: "text-purple-400",
  };

  return (
    <div className="bg-slate-800 rounded p-1.5 text-center">
      <div className="text-[8px] text-slate-500">{label}</div>
      <div className={`text-[11px] font-bold ${colors[color] || 'text-white'}`}>
        {value != null ? `${value}${unit ? ` ${unit}` : ''}` : 'N/A'}
      </div>
    </div>
  );
};

// Provider View Component
const PCIByProviderView = ({ providerData }) => {
  const [expandedProvider, setExpandedProvider] = useState(null);

  if (!providerData?.length) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No provider data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      

      {/* Provider Cards */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto scrollbar-hide">
        {providerData.map((provider, idx) => (
          <div
            key={idx}
            className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
          >
            {/* Provider Header */}
            <div
              className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-800 transition-colors"
              onClick={() => setExpandedProvider(expandedProvider === provider.name ? null : provider.name)}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: provider.color }}
                />
                <span className="font-semibold text-white text-xs">{provider.name}</span>
                <span className="text-[10px] text-slate-400">
                  ({provider.pciCount} PCIs)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                  {provider.totalCount} samples
                </span>
                <span className="text-[9px] text-orange-400 bg-orange-500/10 px-1.5 py-0.5 rounded">
                  {provider.cellCount} cells
                </span>
                <span 
                  className="text-[9px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${getTechnologyColor(provider.dominantTechnology)}20`,
                    color: getTechnologyColor(provider.dominantTechnology)
                  }}
                >
                  {provider.dominantTechnology}
                </span>
                <span className="text-slate-400 text-xs">
                  {expandedProvider === provider.name ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {/* Metrics Summary */}
            <div className="grid grid-cols-6 gap-1 px-2 pb-2">
              <MetricMiniCard 
                label="RSRP" 
                value={provider.avgRsrp?.avg} 
                unit=""
                color={parseFloat(provider.avgRsrp?.avg) >= -90 ? "green" : 
                       parseFloat(provider.avgRsrp?.avg) >= -105 ? "yellow" : "red"}
              />
              <MetricMiniCard label="SINR" value={provider.avgSinr?.avg} unit="" color="green" />
              <MetricMiniCard label="MOS" value={provider.avgMos?.avg} unit="" color="yellow" />
              <MetricMiniCard label="DL" value={provider.avgDl?.avg} unit="" color="cyan" />
              <MetricMiniCard label="UL" value={provider.avgUl?.avg} unit="" color="orange" />
              <MetricMiniCard 
                label="Latency" 
                value={provider.avgLatency?.avg} 
                unit=""
                color={parseFloat(provider.avgLatency?.avg) <= 50 ? "green" : "yellow"}
              />
            </div>

            {/* Expanded PCI List */}
            {expandedProvider === provider.name && (
              <div className="border-t border-slate-700 bg-slate-900/50 p-2">
                <div className="text-[9px] text-slate-400 mb-1.5 font-medium">
                  PCIs for {provider.name}
                </div>
                <div className="max-h-[180px] overflow-y-auto scrollbar-hide">
                  <table className="w-full text-[9px]">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="border-b border-slate-700">
                        <th className="text-left p-1 text-slate-400">PCI</th>
                        <th className="text-center p-1 text-slate-400">Samples</th>
                        <th className="text-center p-1 text-slate-400">Cells</th>
                        <th className="text-center p-1 text-slate-400">Tech</th>
                        <th className="text-center p-1 text-slate-400">Band</th>
                        <th className="text-center p-1 text-slate-400">RSRP</th>
                        <th className="text-center p-1 text-slate-400">DL</th>
                        <th className="text-center p-1 text-slate-400">MOS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {provider.pcis.slice(0, 20).map((pci, pidx) => (
                        <tr key={pidx} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="p-1 font-medium text-white">{pci.pci}</td>
                          <td className="p-1 text-center text-slate-300">{pci.count}</td>
                          <td className="p-1 text-center text-cyan-400">{pci.cellCount}</td>
                          <td className="p-1 text-center">
                            <span 
                              className="text-[8px] px-1 py-0.5 rounded"
                              style={{
                                backgroundColor: `${getTechnologyColor(pci.dominantTech)}20`,
                                color: getTechnologyColor(pci.dominantTech)
                              }}
                            >
                              {pci.dominantTech}
                            </span>
                          </td>
                          <td className="p-1 text-center text-blue-400">{pci.dominantBand}</td>
                          <td className={`p-1 text-center font-medium ${
                            parseFloat(pci.avgRsrp?.avg) >= -90 ? "text-green-400" : 
                            parseFloat(pci.avgRsrp?.avg) >= -105 ? "text-yellow-400" : "text-red-400"
                          }`}>
                            {pci.avgRsrp?.avg || "-"}
                          </td>
                          <td className="p-1 text-center text-cyan-400">{pci.avgDl?.avg || "-"}</td>
                          <td className="p-1 text-center text-yellow-400">{pci.avgMos?.avg || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {provider.pcis.length > 20 && (
                    <div className="text-center text-[9px] text-slate-500 mt-1">
                      +{provider.pcis.length - 20} more PCIs
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Technology View Component
const PCIByTechnologyView = ({ technologyData }) => {
  if (!technologyData?.length) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No technology data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Technology Distribution Chart */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-[10px] text-slate-400 mb-2 font-medium">Technology Distribution</div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={technologyData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, count }) => `${name}: ${count}`}
                outerRadius={60}
                dataKey="count"
              >
                {technologyData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "#1e293b", 
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  fontSize: "10px" 
                }} 
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-slate-800/50 rounded-lg p-2">
          <div className="text-[10px] text-slate-400 mb-2 font-medium">Performance by Technology</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={technologyData} layout="vertical" margin={{ left: 50, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" tick={{ fill: "#94A3B8", fontSize: 9 }} />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fill: "#94A3B8", fontSize: 9 }}
                width={50}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "#1e293b", 
                  border: "1px solid #475569",
                  borderRadius: "8px",
                  fontSize: "10px" 
                }} 
              />
              <Bar dataKey={(d) => parseFloat(d.avgDl?.avg) || 0} fill="#06b6d4" name="Avg DL (Mbps)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Technology Cards */}
      <div className="space-y-2 max-h-[250px] overflow-y-auto scrollbar-hide">
        {technologyData.map((tech, idx) => (
          <div 
            key={idx}
            className="bg-slate-800/50 rounded-lg p-2 border border-slate-700"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: tech.color }}
                />
                <span className="font-semibold text-white text-xs">{tech.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">
                  {tech.count} samples
                </span>
                <span className="text-[9px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                  {tech.pciCount} PCIs
                </span>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-1">
              <MetricMiniCard label="RSRP" value={tech.avgRsrp?.avg} unit="" color="green" />
              <MetricMiniCard label="SINR" value={tech.avgSinr?.avg} unit="" color="green" />
              <MetricMiniCard label="MOS" value={tech.avgMos?.avg} unit="" color="yellow" />
              <MetricMiniCard label="DL" value={tech.avgDl?.avg} unit="" color="cyan" />
              <MetricMiniCard label="UL" value={tech.avgUl?.avg} unit="" color="orange" />
              <MetricMiniCard label="Latency" value={tech.avgLatency?.avg} unit="" color="purple" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Cell/NodeB View Component
const PCIByCellView = ({ cellData }) => {
  if (!cellData?.length) {
    return (
      <div className="text-center py-4 text-slate-400 text-sm">
        No cell data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-1">
        <StatCard label="NodeBs" value={[...new Set(cellData.map(c => c.nodebId))].length} color="orange" />
        <StatCard label="Cells" value={cellData.length} color="cyan" />
        <StatCard label="Total PCIs" value={[...new Set(cellData.flatMap(c => c.pcis))].length} color="blue" />
        <StatCard label="Samples" value={cellData.reduce((sum, c) => sum + c.count, 0)} color="green" />
      </div>

      {/* Cell Table */}
      <div className="bg-slate-800/50 rounded-lg overflow-hidden">
        <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
          <table className="w-full text-[10px]">
            <thead className="sticky top-0 bg-slate-900 z-10">
              <tr className="border-b border-slate-700">
                <th className="text-left p-2 text-slate-400 font-medium">NodeB</th>
                <th className="text-center p-2 text-slate-400 font-medium">Cell</th>
                <th className="text-center p-2 text-slate-400 font-medium">PCIs</th>
                <th className="text-center p-2 text-slate-400 font-medium">Samples</th>
                <th className="text-center p-2 text-slate-400 font-medium">Tech</th>
                <th className="text-center p-2 text-slate-400 font-medium">Band</th>
                <th className="text-center p-2 text-slate-400 font-medium">RSRP</th>
                <th className="text-center p-2 text-slate-400 font-medium">DL</th>
                <th className="text-center p-2 text-slate-400 font-medium">MOS</th>
              </tr>
            </thead>
            <tbody>
              {cellData.slice(0, 50).map((cell, idx) => (
                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="p-2 font-medium text-orange-400">{cell.nodebId}</td>
                  <td className="p-2 text-center text-cyan-400">{cell.cellId || '-'}</td>
                  <td className="p-2 text-center">
                    <span className="text-blue-400">{cell.pciCount}</span>
                    {cell.pciCount > 0 && (
                      <span className="text-[8px] text-slate-500 ml-1">
                        ({cell.pcis.slice(0, 3).join(',')}{cell.pcis.length > 3 ? '...' : ''})
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-center text-slate-300">{cell.count}</td>
                  <td className="p-2 text-center">
                    <span 
                      className="text-[8px] px-1 py-0.5 rounded"
                      style={{
                        backgroundColor: `${getTechnologyColor(cell.dominantTech)}20`,
                        color: getTechnologyColor(cell.dominantTech)
                      }}
                    >
                      {cell.dominantTech}
                    </span>
                  </td>
                  <td className="p-2 text-center text-blue-400">{cell.dominantBand}</td>
                  <td className={`p-2 text-center font-medium ${
                    parseFloat(cell.avgRsrp?.avg) >= -90 ? "text-green-400" : 
                    parseFloat(cell.avgRsrp?.avg) >= -105 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {cell.avgRsrp?.avg || "-"}
                  </td>
                  <td className="p-2 text-center text-cyan-400">{cell.avgDl?.avg || "-"}</td>
                  <td className="p-2 text-center text-yellow-400">{cell.avgMos?.avg || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {cellData.length > 50 && (
            <div className="text-center text-[10px] text-slate-500 p-2 bg-slate-900">
              Showing 50 of {cellData.length} cells
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Performance View Component
const PCIPerformanceView = ({ pciColorMap }) => (
  <div className="space-y-3">
    {/* Performance Charts */}
    <div className="grid grid-cols-2 gap-2">
      <div className="bg-slate-800/50 rounded-lg p-2">
        <div className="text-[10px] text-slate-400 mb-1 font-medium">RSRP & MOS by PCI</div>
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={pciColorMap} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="pci"
              angle={-45}
              textAnchor="end"
              height={40}
              tick={{ fill: "#94A3B8", fontSize: 8 }}
            />
            <YAxis yAxisId="left" tick={{ fill: "#94A3B8", fontSize: 9 }} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 5]} tick={{ fill: "#94A3B8", fontSize: 9 }} />
            <Tooltip contentStyle={{ ...CHART_CONFIG.tooltip, fontSize: '10px' }} />
            <Legend wrapperStyle={{ fontSize: "9px" }} />
            <Bar 
              yAxisId="left" 
              dataKey={(d) => parseFloat(d.avgRsrp?.avg) || 0} 
              fill="#3b82f6" 
              name="RSRP" 
              radius={[4, 4, 0, 0]} 
            />
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey={(d) => parseFloat(d.avgMos?.avg) || 0} 
              stroke="#facc15" 
              name="MOS" 
              strokeWidth={2} 
              dot={{ r: 3 }} 
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-800/50 rounded-lg p-2">
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Throughput by PCI</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={pciColorMap} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="pci"
              angle={-45}
              textAnchor="end"
              height={40}
              tick={{ fill: "#94A3B8", fontSize: 8 }}
            />
            <YAxis tick={{ fill: "#94A3B8", fontSize: 9 }} />
            <Tooltip contentStyle={{ ...CHART_CONFIG.tooltip, fontSize: '10px' }} />
            <Legend wrapperStyle={{ fontSize: "9px" }} />
            <Bar 
              dataKey={(d) => parseFloat(d.avgDl?.avg) || 0} 
              fill="#06b6d4" 
              name="DL (Mbps)" 
              radius={[4, 4, 0, 0]} 
            />
            <Bar 
              dataKey={(d) => parseFloat(d.avgUl?.avg) || 0} 
              fill="#fb923c" 
              name="UL (Mbps)" 
              radius={[4, 4, 0, 0]} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Performance Table */}
    <div className="bg-slate-800/50 rounded-lg overflow-hidden">
      <div className="max-h-[200px] overflow-y-auto scrollbar-hide">
        <table className="w-full text-[10px]">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="border-b border-slate-700">
              <th className="text-left p-1.5 text-slate-400 font-medium">PCI</th>
              <th className="text-center p-1.5 text-slate-400 font-medium">Samples</th>
              <th className="text-center p-1.5 text-slate-400 font-medium">Cells</th>
              <th className="text-center p-1.5 text-slate-400 font-medium">RSRP</th>
              <th className="text-center p-1.5 text-slate-400 font-medium">SINR</th>
              <th className="text-center p-1.5 text-slate-400 font-medium">MOS</th>
              <th className="text-center p-1.5 text-slate-400 font-medium">DL</th>
              <th className="text-center p-1.5 text-slate-400 font-medium">Latency</th>
            </tr>
          </thead>
          <tbody>
            {pciColorMap.map((item, idx) => (
              <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800/30">
                <td className="p-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="font-medium text-white">{item.pci}</span>
                  </div>
                </td>
                <td className="p-1.5 text-center text-slate-300">{item.count}</td>
                <td className="p-1.5 text-center text-cyan-400">{item.cellCount}</td>
                <td className={`p-1.5 text-center font-medium ${
                  parseFloat(item.avgRsrp?.avg) >= -90 ? "text-green-400" : 
                  parseFloat(item.avgRsrp?.avg) >= -105 ? "text-yellow-400" : "text-red-400"
                }`}>
                  {item.avgRsrp?.avg || "-"}
                </td>
                <td className="p-1.5 text-center text-green-400">{item.avgSinr?.avg || "-"}</td>
                <td className="p-1.5 text-center text-yellow-400">{item.avgMos?.avg || "-"}</td>
                <td className="p-1.5 text-center text-cyan-400">{item.avgDl?.avg || "-"}</td>
                <td className={`p-1.5 text-center ${
                  parseFloat(item.avgLatency?.avg) <= 50 ? "text-green-400" : 
                  parseFloat(item.avgLatency?.avg) <= 100 ? "text-yellow-400" : "text-red-400"
                }`}>
                  {item.avgLatency?.avg || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);

// Distribution View Component  
const PCIDistributionView = ({ pciColorMap, locations, summary }) => (
  <div className="space-y-3">
    {/* Summary Stats */}
    <div className="grid grid-cols-6 gap-1">
      <StatCard label="PCIs" value={summary.totalPcis || pciColorMap.length} color="blue" />
      <StatCard label="Samples" value={summary.totalSamples || locations.length} color="green" />
      <StatCard label="Sessions" value={summary.totalSessions} color="purple" />
      <StatCard label="NodeBs" value={summary.totalNodebs} color="orange" />
      <StatCard label="Cells" value={summary.totalCells} color="cyan" />
      <StatCard label="Providers" value={summary.totalProviders} color="pink" />
    </div>

    <div className="grid grid-cols-2 gap-2">
      {/* PCI Distribution Pie */}
      <div className="bg-slate-800/50 rounded-lg p-2">
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Top 10 PCIs by Samples</div>
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

      {/* Samples per PCI Bar Chart */}
      <div className="bg-slate-800/50 rounded-lg p-2">
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Sample Count Distribution</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={pciColorMap.slice(0, 15)} margin={{ top: 5, right: 10, left: -10, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="pci"
              angle={-45}
              textAnchor="end"
              height={40}
              tick={{ fill: "#94A3B8", fontSize: 8 }}
            />
            <YAxis tick={{ fill: "#94A3B8", fontSize: 9 }} />
            <Tooltip contentStyle={{ ...CHART_CONFIG.tooltip, fontSize: '10px' }} />
            <Bar dataKey="count" name="Samples" radius={[4, 4, 0, 0]}>
              {pciColorMap.slice(0, 15).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>

    {/* Quick Stats by Category */}
    <div className="grid grid-cols-3 gap-2">
      {/* Top Providers */}
      <div className="bg-slate-800/50 rounded-lg p-2">
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Top Providers</div>
        <div className="space-y-1">
          {[...new Set(locations.map(l => l.provider).filter(Boolean))]
            .map(provider => ({
              name: provider,
              count: locations.filter(l => l.provider === provider).length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((p, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getProviderColor(p.name) }}
                  />
                  <span className="text-[10px] text-slate-300">{p.name}</span>
                </div>
                <span className="text-[10px] text-slate-400">{p.count}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Top Technologies */}
      <div className="bg-slate-800/50 rounded-lg p-2">
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Top Technologies</div>
        <div className="space-y-1">
          {[...new Set(locations.map(l => l.technology).filter(Boolean))]
            .map(tech => ({
              name: tech,
              count: locations.filter(l => l.technology === tech).length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((t, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getTechnologyColor(t.name) }}
                  />
                  <span className="text-[10px] text-slate-300 truncate max-w-[80px]">{t.name}</span>
                </div>
                <span className="text-[10px] text-slate-400">{t.count}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* Top Bands */}
      <div className="bg-slate-800/50 rounded-lg p-2">
        <div className="text-[10px] text-slate-400 mb-1 font-medium">Top Bands</div>
        <div className="space-y-1">
          {[...new Set(locations.map(l => l.band).filter(Boolean))]
            .map(band => ({
              name: band,
              count: locations.filter(l => l.band === band).length
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
            .map((b, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getBandColor(b.name) }}
                  />
                  <span className="text-[10px] text-slate-300">Band {b.name}</span>
                </div>
                <span className="text-[10px] text-slate-400">{b.count}</span>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  </div>
);

// Stat Card Component
const StatCard = ({ label, value, color }) => {
  const colors = {
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
    orange: "text-orange-400",
    cyan: "text-cyan-400",
    pink: "text-pink-400",
    yellow: "text-yellow-400",
    red: "text-red-400",
  };

  return (
    <div className="bg-slate-800/50 rounded p-1.5 text-center">
      <div className="text-[9px] text-slate-400 mb-0.5">{label}</div>
      <div className={`text-lg font-bold ${colors[color] || 'text-white'}`}>
        {value ?? 0}
      </div>
    </div>
  );
};

PciColorLegend.displayName = "PciColorLegend";