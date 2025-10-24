// src/components/NetworkPlannerMap.jsx
import React from "react";
import { PolygonF } from "@react-google-maps/api";

// Compute offset point given center, distance (m) and heading (deg)
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

// Expanded hardcoded sectors (12 sites x 3 sectors)
// Colors by operator: Airtel = red, JIO = blue, Vi = purple, BSNL = green
const TEST_SECTORS = [
  // Site 1 (Airtel)
  {
    site: "616218-5",
    cell_id: "616218-51",
    lat: 28.64453086,
    lng: 77.37324242,
    azimuth: 0,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 1800",
    operator: "Airtel",
    range: 280,
  },
  {
    site: "616218-5",
    cell_id: "616218-52",
    lat: 28.64453086,
    lng: 77.37324242,
    azimuth: 120,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 1800",
    operator: "Airtel",
    range: 280,
  },
  {
    site: "616218-5",
    cell_id: "616218-53",
    lat: 28.64453086,
    lng: 77.37324242,
    azimuth: 240,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 1800",
    operator: "Airtel",
    range: 280,
  },

  // Site 2 (JIO)
  {
    site: "616219-1",
    cell_id: "616219-11",
    lat: 28.64873086,
    lng: 77.37974242,
    azimuth: 30,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 220,
  },
  {
    site: "616219-1",
    cell_id: "616219-12",
    lat: 28.64873086,
    lng: 77.37974242,
    azimuth: 150,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 220,
  },
  {
    site: "616219-1",
    cell_id: "616219-13",
    lat: 28.64873086,
    lng: 77.37974242,
    azimuth: 270,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 220,
  },

  // Site 3 (Vi)
  {
    site: "616220-2",
    cell_id: "616220-21",
    lat: 28.63903086,
    lng: 77.37804242,
    azimuth: 60,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 350,
  },
  {
    site: "616220-2",
    cell_id: "616220-22",
    lat: 28.63903086,
    lng: 77.37804242,
    azimuth: 180,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 350,
  },
  {
    site: "616220-2",
    cell_id: "616220-23",
    lat: 28.63903086,
    lng: 77.37804242,
    azimuth: 300,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 350,
  },

  // Site 4 (BSNL)
  {
    site: "616221-3",
    cell_id: "616221-31",
    lat: 28.65243086,
    lng: 77.36704242,
    azimuth: 90,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 250,
  },
  {
    site: "616221-3",
    cell_id: "616221-32",
    lat: 28.65243086,
    lng: 77.36704242,
    azimuth: 210,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 250,
  },
  {
    site: "616221-3",
    cell_id: "616221-33",
    lat: 28.65243086,
    lng: 77.36704242,
    azimuth: 330,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 250,
  },

  // Site 5 (Airtel)
  {
    site: "616222-4",
    cell_id: "616222-41",
    lat: 28.63713086,
    lng: 77.36914242,
    azimuth: 15,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 2100",
    operator: "Airtel",
    range: 260,
  },
  {
    site: "616222-4",
    cell_id: "616222-42",
    lat: 28.63713086,
    lng: 77.36914242,
    azimuth: 135,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 2100",
    operator: "Airtel",
    range: 260,
  },
  {
    site: "616222-4",
    cell_id: "616222-43",
    lat: 28.63713086,
    lng: 77.36914242,
    azimuth: 255,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 2100",
    operator: "Airtel",
    range: 260,
  },

  // Site 6 (JIO)
  {
    site: "616223-1",
    cell_id: "616223-11",
    lat: 28.65533086,
    lng: 77.38444242,
    azimuth: 45,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 210,
  },
  {
    site: "616223-1",
    cell_id: "616223-12",
    lat: 28.65533086,
    lng: 77.38444242,
    azimuth: 165,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 210,
  },
  {
    site: "616223-1",
    cell_id: "616223-13",
    lat: 28.65533086,
    lng: 77.38444242,
    azimuth: 285,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 210,
  },

  // Site 7 (Vi)
  {
    site: "616224-2",
    cell_id: "616224-21",
    lat: 28.63303086,
    lng: 77.38284242,
    azimuth: 75,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 340,
  },
  {
    site: "616224-2",
    cell_id: "616224-22",
    lat: 28.63303086,
    lng: 77.38284242,
    azimuth: 195,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 340,
  },
  {
    site: "616224-2",
    cell_id: "616224-23",
    lat: 28.63303086,
    lng: 77.38284242,
    azimuth: 315,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 340,
  },

  // Site 8 (BSNL)
  {
    site: "616225-1",
    cell_id: "616225-11",
    lat: 28.65923086,
    lng: 77.36544242,
    azimuth: 105,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 240,
  },
  {
    site: "616225-1",
    cell_id: "616225-12",
    lat: 28.65923086,
    lng: 77.36544242,
    azimuth: 225,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 240,
  },
  {
    site: "616225-1",
    cell_id: "616225-13",
    lat: 28.65923086,
    lng: 77.36544242,
    azimuth: 345,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 240,
  },

  // Site 9 (Airtel)
  {
    site: "616226-3",
    cell_id: "616226-31",
    lat: 28.62963086,
    lng: 77.36174242,
    azimuth: 0,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 1800",
    operator: "Airtel",
    range: 280,
  },
  {
    site: "616226-3",
    cell_id: "616226-32",
    lat: 28.62963086,
    lng: 77.36174242,
    azimuth: 120,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 1800",
    operator: "Airtel",
    range: 280,
  },
  {
    site: "616226-3",
    cell_id: "616226-33",
    lat: 28.62963086,
    lng: 77.36174242,
    azimuth: 240,
    beamwidth: 65,
    color: "#ef4444",
    tech: "4G",
    band: "LTE 1800",
    operator: "Airtel",
    range: 280,
  },

  // Site 10 (JIO)
  {
    site: "616227-2",
    cell_id: "616227-21",
    lat: 28.65813086,
    lng: 77.37674242,
    azimuth: 30,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 210,
  },
  {
    site: "616227-2",
    cell_id: "616227-22",
    lat: 28.65813086,
    lng: 77.37674242,
    azimuth: 150,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 210,
  },
  {
    site: "616227-2",
    cell_id: "616227-23",
    lat: 28.65813086,
    lng: 77.37674242,
    azimuth: 270,
    beamwidth: 65,
    color: "#3b82f6",
    tech: "5G",
    band: "n78",
    operator: "JIO",
    range: 210,
  },

  // Site 11 (Vi)
  {
    site: "616228-1",
    cell_id: "616228-11",
    lat: 28.63113086,
    lng: 77.37534242,
    azimuth: 60,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 330,
  },
  {
    site: "616228-1",
    cell_id: "616228-12",
    lat: 28.63113086,
    lng: 77.37534242,
    azimuth: 180,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 330,
  },
  {
    site: "616228-1",
    cell_id: "616228-13",
    lat: 28.63113086,
    lng: 77.37534242,
    azimuth: 300,
    beamwidth: 65,
    color: "#a855f7",
    tech: "4G",
    band: "LTE 900",
    operator: "Vi",
    range: 330,
  },

  // Site 12 (BSNL)
  {
    site: "616229-5",
    cell_id: "616229-51",
    lat: 28.65933086,
    lng: 77.36074242,
    azimuth: 90,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 240,
  },
  {
    site: "616229-5",
    cell_id: "616229-52",
    lat: 28.65933086,
    lng: 77.36074242,
    azimuth: 210,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 240,
  },
  {
    site: "616229-5",
    cell_id: "616229-53",
    lat: 28.65933086,
    lng: 77.36074242,
    azimuth: 330,
    beamwidth: 65,
    color: "#22c55e",
    tech: "4G",
    band: "LTE 1800",
    operator: "BSNL",
    range: 240,
  },
];

const NetworkPlannerMap = ({ radius = 220 }) => {
  return (
    <>
      {TEST_SECTORS.map((sector) => {
        const p0 = { lat: sector.lat, lng: sector.lng };
        const bw = sector.beamwidth ?? 65;
        const r = sector.range ?? radius;

        const p1 = computeOffset(p0, r, sector.azimuth - bw / 2);
        const p2 = computeOffset(p0, r, sector.azimuth + bw / 2);

        const triangleCoords = [p0, p1, p2];

        return (
          <PolygonF
            key={sector.cell_id}
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