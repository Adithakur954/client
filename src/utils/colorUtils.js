
export const normalizeProviderName = (raw) => {
  if (!raw) return "Unknown";
  const s = String(raw).trim();
  if (/^\/+$/.test(s)) return "Unknown";
  if (s.replace(/\s+/g, "") === "404011") return "Unknown";

  const cleaned = s.toUpperCase().replace(/[\s\-_]/g, "");

  if (cleaned.includes("JIO") || cleaned.includes("JIOTRUE")) return "Jio";
  if (cleaned.includes("AIRTEL") || cleaned.includes("airtel")) return "Airtel";
  if (cleaned === "VI" || cleaned.includes("VIINDIA") || cleaned.includes("VODAFONE") || cleaned.includes("IDEA")) return "VI India";
  if (cleaned.includes("BSNL")) return "BSNL";

  return "Unknown";
};

// Normalize technology names
export const normalizeTechName = (tech) => {
  if (!tech) return "Unknown";
  const t = String(tech).trim().toUpperCase();

  if (t.includes("5G") || t.includes("NR")) return "5G";
  if (t.includes("LTE") || t.includes("4G")) return "4G";
  if (t.includes("3G")) return "3G";
  if (t.includes("2G") || t.includes("EDGE")) return "2G";
  return "Unknown";
};

// Color schemes for different categories
export const COLOR_SCHEMES = {
  provider: {
    Jio: "#3B82F6",
    Airtel: "#EF4444",
    "VI India": "#22C55E",
    BSNL: "#F59E0B",
    Unknown: "#6B7280",
  },
  technology: {
    "5G": "#EC4899",
    "4G": "#8B5CF6",
    "3G": "#10B981",
    "2G": "#6B7280",
    Unknown: "#F59E0B",
  },
  band: {
    3: "#EF4444",
    5: "#F59E0B",
    8: "#10B981",
    40: "#3B82F6",
    41: "#8B5CF6",
    n28: "#EC4899",
    n78: "#F472B6",
    1: "#EF4444",
    2: "#F59E0B",
    7: "#10B781",
    Unknown: "#6B7280",
  },
};

// Get color for a log based on colorBy type
export const getLogColor = (colorBy, value, defaultColor = "#6B7280") => {
  if (!colorBy || !value) {
    return defaultColor;
  }

  const scheme = COLOR_SCHEMES[colorBy];
  if (!scheme) {
    return defaultColor;
  }

  let normalizedValue = String(value).trim();

  if (colorBy === "provider") {
    normalizedValue = normalizeProviderName(value);
  } else if (colorBy === "technology") {
    normalizedValue = normalizeTechName(value);
  } else if (colorBy === "band") {
    if (normalizedValue === "-1" || normalizedValue === "") {
      normalizedValue = "Unknown";
    }
  }

  if (scheme[normalizedValue]) {
    return scheme[normalizedValue];
  }

  const matchKey = Object.keys(scheme).find(
    (key) => key.toLowerCase() === normalizedValue.toLowerCase()
  );

  if (matchKey) {
    return scheme[matchKey];
  }

  return defaultColor;
};