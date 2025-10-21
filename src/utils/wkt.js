// // src/utils/wkt.js
// // Parse POLYGON/MULTIPOLYGON WKT into rings usable by Google Maps
// export const parseWKTToRings = (wkt) => {
//   if (!wkt || typeof wkt !== "string") return [];

//   const clean = wkt.trim();
//   const isMulti = /^MULTIPOLYGON/i.test(clean);
//   const extract = clean.replace(/^\w+\s*KATEX_INLINE_OPEN/, "").replace(/KATEX_INLINE_CLOSE\s*$/, "");

//   const toLatLng = (pair) => {
//     const [x, y] = pair.trim().split(/\s+/).map(Number);
//     if (Number.isFinite(x) && Number.isFinite(y)) {
//       // WKT is lon lat
//       return { lat: y, lng: x };
//     }
//     return null;
//   };

//   if (isMulti) {
//     // MULTIPOLYGON((((x y,...)),((x y,...))), (((x y,...))))
//     const polys = [];
//     let depth = 0, curr = "", groups = [];
//     for (const ch of extract) {
//       if (ch === "(") depth++;
//       if (ch === ")") depth--;
//       if (ch === "," && depth === 1) {
//         groups.push(curr);
//         curr = "";
//       } else {
//         curr += ch;
//       }
//     }
//     if (curr) groups.push(curr);

//     for (const g of groups) {
//       const ringsRaw = g.replace(/^KATEX_INLINE_OPEN+|KATEX_INLINE_CLOSE+$/g, "").split("),(");
//       const rings = ringsRaw.map((ring) =>
//         ring.split(",").map(toLatLng).filter(Boolean)
//       );
//       if (rings.length) polys.push(rings);
//     }
//     return polys;
//   } else {
//     // POLYGON(((x y, ...), (hole...)))
//     const ringsRaw = extract.replace(/^KATEX_INLINE_OPEN+|KATEX_INLINE_CLOSE+$/g, "").split("),(");
//     const rings = ringsRaw.map((ring) =>
//       ring.split(",").map(toLatLng).filter(Boolean)
//     );
//     return [rings];
//   }
// };


// src/utils/wkt.js
// Parse both POLYGON and MULTIPOLYGON WKTs into coordinates usable by Google Maps.
// Keeps backward compatibility (returns flat array of {lat,lng}) but also exposes full structure.

/**
 * Convert "lng lat" → {lat, lng}
 */
function toLatLng(pair) {
  const [x, y] = pair.trim().split(/\s+/).map(Number);
  return Number.isFinite(x) && Number.isFinite(y)
    ? { lat: y, lng: x } // WKT order: lon lat
    : null;
}

/**
 * Parse WKT string to nested array structure
 * POLYGON → [ [ [ LatLng ] ] ]
 * MULTIPOLYGON → [ [ [ LatLng ] ], [ [ LatLng ] ] ]
 */
function parseToNested(wkt) {
  if (!wkt || typeof wkt !== "string") return [];

  const text = wkt.trim();
  const isMulti = /^MULTIPOLYGON/i.test(text);

  if (isMulti) {
    const inner = text
      .replace(/^MULTIPOLYGON\s*KATEX_INLINE_OPEN\s*/, "")
      .replace(/\s*KATEX_INLINE_CLOSE\s*$/, "");

    // separate polygons
    const polys = inner.match(/KATEX_INLINE_OPENKATEX_INLINE_OPEN[^()]+KATEX_INLINE_CLOSEKATEX_INLINE_CLOSE/g) || [];
    return polys.map((poly) => {
      const cleaned = poly.replace(/^KATEX_INLINE_OPENKATEX_INLINE_OPEN/, "").replace(/KATEX_INLINE_CLOSEKATEX_INLINE_CLOSE$/, "");
      const ringsRaw = cleaned.split(/KATEX_INLINE_CLOSE\s*,\s*KATEX_INLINE_OPEN/);
      return ringsRaw.map((ring) =>
        ring.split(",").map(toLatLng).filter(Boolean)
      );
    });
  }

  // handle simple polygon
  const inner = text
    .replace(/^POLYGON\s*KATEX_INLINE_OPEN\s*/, "")
    .replace(/\s*KATEX_INLINE_CLOSE\s*$/, "")
    .replace(/^KATEX_INLINE_OPEN/, "")
    .replace(/KATEX_INLINE_CLOSE$/, "");

  const ringsRaw = inner.split(/KATEX_INLINE_CLOSE\s*,\s*KATEX_INLINE_OPEN/);
  const rings = ringsRaw.map((ring) =>
    ring.split(",").map(toLatLng).filter(Boolean)
  );

  return [rings];
}

/**
 * Main export with backward‑compatible structure.
 *
 * @param {string} wkt - POLYGON or MULTIPOLYGON text
 * @returns {{ coordinates: {lat,lng}[], rawRings: any[] }}
 *
 * `coordinates`  – flat array for easy `.paths` use (outer ring of first polygon)
 * `rawRings`     – nested array [[outer],[holes], …] for future complex use
 */
export function parseWKTToCoordinates(wkt) {
  const nested = parseToNested(wkt);                     // full structure
  const coordinates = nested[0]?.[0] ?? [];              // backward compatible
  return { coordinates, rawRings: nested };
}

export default parseWKTToCoordinates;