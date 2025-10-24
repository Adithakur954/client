import React from "react";
import { PolygonF } from "@react-google-maps/api";

// === Utility to compute offset point ===
function computeOffset(center, distanceMeters, headingDegrees) {
  const earthRadius = 6378137; // meters
  const lat1 = (center.lat * Math.PI) / 180;
  const lng1 = (center.lng * Math.PI) / 180;
  const heading = (headingDegrees * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceMeters / earthRadius) +
      Math.cos(lat1) * Math.sin(distanceMeters / earthRadius) * Math.cos(heading)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(heading) * Math.sin(distanceMeters / earthRadius) * Math.cos(lat1),
      Math.cos(distanceMeters / earthRadius) - Math.sin(lat1) * Math.sin(lat2)
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (lng2 * 180) / Math.PI };
}

// === Hardcoded test data (3 sectors for 1 site) ===
const TEST_SECTORS = [
  {
    site: "616218-5",
    cell_id: "616218-51",
    lat: 28.64453086,
    lng: 77.37324242,
    azimuth: 0,
    beamwidth: 60,
    color: "#ef4444", // red
    tech: "4G",
  },
  {
    site: "616218-5",
    cell_id: "616218-52",
    lat: 28.64453086,
    lng: 77.37324242,
    azimuth: 120,
    beamwidth: 60,
    color: "#3b82f6", // blue
    tech: "4G",
  },
  {
    site: "616218-5",
    cell_id: "616218-53",
    lat: 28.64453086,
    lng: 77.37324242,
    azimuth: 240,
    beamwidth: 60,
    color: "#22c55e", // green
    tech: "4G",
  },
];

const NetworkPlannerMap = () => {
  const radius = 200; // meters (length of triangle)

  return (
    <>
      {TEST_SECTORS.map((sector, i) => {
        const p0 = { lat: sector.lat, lng: sector.lng };
        const p1 = computeOffset(p0, radius, sector.azimuth - sector.beamwidth / 2);
        const p2 = computeOffset(p0, radius, sector.azimuth + sector.beamwidth / 2);

        const triangleCoords = [p0, p1, p2];

        return (
          <PolygonF
            key={i}
            paths={triangleCoords}
            options={{
              fillColor: sector.color,
              fillOpacity: 0.35,
              strokeColor: sector.color,
              strokeWeight: 1.5,
            }}
          />
        );
      })}
    </>
  );
};

export default NetworkPlannerMap;
