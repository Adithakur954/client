export const COLORS = {
  CHART_PALETTE: [
    "#3b82f6", "#8b5cf6", "#10b981", 
    "#f59e0b", "#ef4444", "#06b6d4"
  ],
  TECH_COLORS: {
    LTE: "#10b981",
    "5G": "#8b5cf6",
    "4G": "#3b82f6",
    "3G": "#f59e0b",
    "Wi-Fi": "#6b7280",
  },
  STAT_CARD: {
    blue: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    green: "bg-green-500/10 text-green-500 border-green-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
    yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    cyan: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  }
};

export const TABS = [
  { id: "overview", label: "Overview", icon: "BarChart3" },
  { id: "signal", label: "Signal", icon: "Signal" },
  { id: "network", label: "Comparison", icon: "Wifi" },
  // { id: "performance", label: "Performance", icon: "Zap" },
  { id: "Application", label: "Apps", icon: "PieChartIcon" },
];

export const CHART_CONFIG = {
  margin: { top: 10, right: 30, left: 0, bottom: 20 },
  tooltip: {
    backgroundColor: "#1e293b",
    border: "1px solid #475569",
    borderRadius: "8px",
    color: "#fff",
  },
  grid: {
    strokeDasharray: "3 3",
    stroke: "#374151",
  },
};