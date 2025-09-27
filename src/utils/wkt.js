// src/utils/wkt.js
// Parse POLYGON/MULTIPOLYGON WKT into rings usable by Google Maps
export const parseWKTToRings = (wkt) => {
  if (!wkt || typeof wkt !== "string") return [];

  const clean = wkt.trim();
  const isMulti = /^MULTIPOLYGON/i.test(clean);
  const extract = clean.replace(/^\w+\s*KATEX_INLINE_OPEN/, "").replace(/KATEX_INLINE_CLOSE\s*$/, "");

  const toLatLng = (pair) => {
    const [x, y] = pair.trim().split(/\s+/).map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      // WKT is lon lat
      return { lat: y, lng: x };
    }
    return null;
  };

  if (isMulti) {
    // MULTIPOLYGON((((x y,...)),((x y,...))), (((x y,...))))
    const polys = [];
    let depth = 0, curr = "", groups = [];
    for (const ch of extract) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 1) {
        groups.push(curr);
        curr = "";
      } else {
        curr += ch;
      }
    }
    if (curr) groups.push(curr);

    for (const g of groups) {
      const ringsRaw = g.replace(/^KATEX_INLINE_OPEN+|KATEX_INLINE_CLOSE+$/g, "").split("),(");
      const rings = ringsRaw.map((ring) =>
        ring.split(",").map(toLatLng).filter(Boolean)
      );
      if (rings.length) polys.push(rings);
    }
    return polys;
  } else {
    // POLYGON(((x y, ...), (hole...)))
    const ringsRaw = extract.replace(/^KATEX_INLINE_OPEN+|KATEX_INLINE_CLOSE+$/g, "").split("),(");
    const rings = ringsRaw.map((ring) =>
      ring.split(",").map(toLatLng).filter(Boolean)
    );
    return [rings];
  }
};