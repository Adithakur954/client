export const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', 
  '#EC4899', '#F97316', '#06B6D4', '#EF4444', 
  '#84CC16', '#6366F1'
];

export const NETWORK_COLORS = {
  '5G': '#8B5CF6',
  '4G': '#3B82F6',
  '3G': '#10B981',
  '2G': '#F59E0B',
};

export const RSRP_COLORS = {
  EXCELLENT: '#10B981',
  GOOD: '#86EFAC',
  FAIR: '#60A5FA',
  POOR: '#3B82F6',
  VERY_POOR: '#FDE047',
  BAD: '#F59E0B',
  VERY_BAD: '#EF4444',
};

export const METRICS = [
  { 
    value: 'rsrp', 
    label: 'RSRP (dBm)', 
    desc: 'Reference Signal Received Power', 
    icon: '📶',
    unit: 'dBm',
    domain: [-120, -60],
  },
  { 
    value: 'rsrq', 
    label: 'RSRQ (dB)', 
    desc: 'Reference Signal Received Quality', 
    icon: '📊',
    unit: 'dB',
    domain: [-20, -3],
  },
  { 
    value: 'sinr', 
    label: 'SINR (dB)', 
    desc: 'Signal to Interference plus Noise Ratio', 
    icon: '📡',
    unit: 'dB',
    domain: [-5, 30],
  },
  { 
    value: 'mos', 
    label: 'MOS', 
    desc: 'Mean Opinion Score (1-5)', 
    icon: '⭐',
    unit: '',
    domain: [1, 5],
  },
  { 
    value: 'jitter', 
    label: 'Jitter (ms)', 
    desc: 'Variation in packet delay', 
    icon: '⚡',
    unit: 'ms',
    domain: [0, 'auto'],
  },
  { 
    value: 'latency', 
    label: 'Latency (ms)', 
    desc: 'Round-trip time', 
    icon: '⏱️',
    unit: 'ms',
    domain: [0, 'auto'],
  },
  { 
    value: 'packetLoss', 
    label: 'Packet Loss (%)', 
    desc: 'Percentage of lost packets', 
    icon: '📉',
    unit: '%',
    domain: [0, 'auto'],
  },
  { 
    value: 'dlTpt', 
    label: 'DL Throughput (Mbps)', 
    desc: 'Download Speed', 
    icon: '⬇️',
    unit: 'Mbps',
    domain: [0, 'auto'],
  },
  { 
    value: 'ulTpt', 
    label: 'UL Throughput (Mbps)', 
    desc: 'Upload Speed', 
    icon: '⬆️',
    unit: 'Mbps',
    domain: [0, 'auto'],
  },
];

export const TOOLTIP_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px',
  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  color: '#111827'
};