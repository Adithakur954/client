
export const normalizeProviderName = (rawName) => {
  if (!rawName) return ;

  const invalidValues = ["000 000", " 000 000 ", "404440", "404011"];
  const s = String(rawName).trim();

  // Handle only slashes like /, //, ///
  if (/^\/+$/.test(s)) return ;

  if (invalidValues.includes(s)) return ;

  const cleaned = s.toUpperCase().replace(/[\s\-_]/g, "");

  if (cleaned.includes("JIO") || cleaned.includes("JIOTRUE")) {
    return "Jio";
  }

  if (cleaned.includes("AIRTEL")) {
    return "Airtel";
  }

  if (
    cleaned === "VI" ||
    cleaned.includes("VIINDIA") ||
    cleaned.includes("VODAFONE") ||
    cleaned.includes("IDEA")
  ) {
    return "VI India";
  }

  if (cleaned.includes("YAS") || cleaned.includes("BROADBAND")) {
    return "Yas";
  }

  if (cleaned.includes("BSNL")) {
    return "BSNL";
  }

  return s;
};



export const normalizeTechName = (tech) => {
  if (!tech) return "Unknown";

  const techStr = String(tech).trim();
  
  const InvalidValues = [
    "000", 
    "00", 
    "Unknown/No Service", 
    "Unknown / No Service",  
    "Unknown",               
    "404440", 
    "404011"
  ];
  
  if (InvalidValues.includes(techStr)) return "Unknown";

  const t = techStr.toUpperCase();

  if (t.includes("5G") || t.includes("NR")) return "5G";
  if (t.includes("LTE") || t.includes("4G")) return "4G";
  if (t.includes("3G")) return "3G";
  if (t.includes("2G") || t.includes("EDGE")) return "2G";
  
  return tech;  
};


export const COLOR_SCHEMES = {
  provider: {
    Jio: "#3B82F6",
    Airtel: "#EF4444",
    "VI India": "#22C55E",
    BSNL: "#F59E0B",
    Yas: "#7d1b49",  
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
    B7: "#10B781",
    Unknown: "#6B7280",
  },
};


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

export const providerColors = (provider) => COLOR_SCHEMES.provider[normalizeProviderName(provider)];