// src/components/NetworkPlannerMap.jsx
import React, { useEffect, useState, useRef } from "react";
import { PolygonF } from "@react-google-maps/api";
import { cellSiteApi } from "@/api/apiEndpoints";


function computeOffset(center, distanceMeters, headingDegrees) {
  const earthRadius = 6371000; // Earth radius in meters
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

// Map network/operator to color
function getColorForNetwork(network) {
  if (!network) return "#808080"; // gray for unknown
  
  const networkLower = network.toLowerCase();
  
  if (networkLower.includes("airtel")) return "#ef4444"; // red
  if (networkLower.includes("jio")) return "#3b82f6"; // blue
  if (networkLower.includes("vi") || networkLower.includes("vodafone")) return "#a855f7"; // purple
  if (networkLower.includes("bsnl")) return "#22c55e"; // green
  if (networkLower.includes("idea")) return "#f59e0b"; // orange
  
  return "#808080"; // default gray
}

// Generate sectors from site data
function generateSectorsFromSite(site) {
  const sectors = [];
  const sectorCount = site.sector_count || 3;
  const baseAzimuth = site.azimuth_deg_5 || 0;
  const beamwidth = site.beamwidth_deg_est || 65;
  const color = getColorForNetwork(site.network);
  
  // Default range based on network type
  let range = 60; 
  if (site.network?.toLowerCase().includes("5g") || site.network?.toLowerCase().includes("jio")) {
    range = 45;
  } else if (site.network?.toLowerCase().includes("vi") || site.network?.toLowerCase().includes("900")) {
    range = 80;
  }
  
  // Generate sectors evenly spaced
  const azimuthSpacing = 360 / sectorCount;
  
  for (let i = 0; i < sectorCount; i++) {
    const azimuth = (baseAzimuth + (i * azimuthSpacing)) % 360;
    
    sectors.push({
      id: `${site.cell_id_representative}-${i + 1}`,
      cell_id: site.cell_id_representative,
      site_key: site.site_key_inferred,
      lat: site.lat_pred,
      lng: site.lon_pred,
      azimuth: azimuth,
      beamwidth: beamwidth,
      color: color,
      network: site.network,
      range: range,
      samples: site.samples,
      pci: site.pci_or_psi,
      earfcn: site.earfcn_or_narfcn,
      azimuth_reliability: site.azimuth_reliability,
    });
  }
  
  return sectors;
}

// ========================================
// COMPONENT
// ========================================

let instanceCounter = 0;

const NetworkPlannerMap = ({ 
  radius = 120, 
  projectId,
  sectors: externalSectors = null,
  onSectorClick = null,
  viewport = null,
  options = {}
}) => {
  const instanceId = useRef(++instanceCounter);
  const [internalSectors, setInternalSectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchedProjectId = useRef(null);

  // Use external sectors if provided, otherwise use internal
  const sectors = externalSectors || internalSectors;

  console.log(` [Instance ${instanceId.current}] NetworkPlannerMap RENDER:`, {
    projectId,
    sectorsCount: sectors.length,
    hasExternalSectors: !!externalSectors,
    loading,
    fetchedProjectId: fetchedProjectId.current,
  });

  useEffect(() => {
    // Skip fetch if external sectors provided
    if (externalSectors && externalSectors.length > 0) {
      console.log(`ℹ️ [Instance ${instanceId.current}] Using external sectors (${externalSectors.length})`);
      return;
    }

    if (!projectId) {
      console.warn(`⚠️ [Instance ${instanceId.current}] No projectId and no external sectors`);
      return;
    }

    console.log(`🔄 [Instance ${instanceId.current}] useEffect triggered - projectId:`, projectId);
    
    const fetchSite = async () => {
      if (fetchedProjectId.current === projectId) {
        console.log(`ℹ️ [Instance ${instanceId.current}] Already fetched data for project`, projectId);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        console.log(`📡 [Instance ${instanceId.current}] Fetching site data for project:`, projectId);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
          console.error(`⏱️ [Instance ${instanceId.current}] Request timeout`);
        }, 30000);

        const res = await cellSiteApi.siteNoml(projectId, controller.signal);
        
        clearTimeout(timeoutId);
        
        console.log(`📦 [Instance ${instanceId.current}] Raw API response:`, res);
        
        if (res && res.data) {
          const siteData = Array.isArray(res.data) ? res.data : [res.data];
          
          console.log(`🏢 [Instance ${instanceId.current}] Site data received:`, siteData.length, "sites");
          
          const allSectors = siteData.flatMap(site => generateSectorsFromSite(site));
          
          console.log(`📍 [Instance ${instanceId.current}] Generated sectors:`, allSectors.length);
          setInternalSectors(allSectors);
          fetchedProjectId.current = projectId;
          console.log(`✅ [Instance ${instanceId.current}] Sectors set in state for project`, projectId);
        } else {
          console.warn(`⚠️ [Instance ${instanceId.current}] No data received from siteNoml`);
          setInternalSectors([]);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          const errMsg = 'Request timeout - Server took too long to respond';
          setError(errMsg);
          console.error(`❌ [Instance ${instanceId.current}]`, errMsg);
        } else if (error.response) {
          const errMsg = `Server error: ${error.response.status}`;
          setError(errMsg);
          console.error(`❌ [Instance ${instanceId.current}] API Error Response:`, error.response);
        } else if (error.request) {
          const errMsg = 'No response from server';
          setError(errMsg);
          console.error(`❌ [Instance ${instanceId.current}] No response received:`, error.request);
        } else {
          const errMsg = error.message || 'Failed to fetch site data';
          setError(errMsg);
          console.error(`❌ [Instance ${instanceId.current}] Failed to fetch site data:`, error);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchSite();
  }, [projectId, externalSectors]);

  // Component lifecycle logging
  useEffect(() => {
    console.log(`🎬 [Instance ${instanceId.current}] Component MOUNTED`);
    return () => {
      console.log(`🔚 [Instance ${instanceId.current}] Component UNMOUNTED`);
    };
  }, []);

  // Show loading state
  if (loading && !externalSectors) {
    console.log(`⏳ [Instance ${instanceId.current}] Showing loading state`);
    return (
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
      }}>
        <div className="spinner" style={{
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          width: '40px',
          height: '40px',
          animation: 'spin 1s linear infinite'
        }}></div>
        <div>Loading site data...</div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show error state
  if (error && !externalSectors) {
    console.log(`❌ [Instance ${instanceId.current}] Showing error state:`, error);
    return (
      <div style={{ 
        position: 'absolute', 
        top: '50%', 
        left: '50%', 
        transform: 'translate(-50%, -50%)',
        background: '#fee',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        zIndex: 1000,
        maxWidth: '400px'
      }}>
        <div style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: '10px' }}>
          ⚠️ Error Loading Site Data
        </div>
        <div style={{ color: '#991b1b' }}>{error}</div>
        <button 
          onClick={() => {
            fetchedProjectId.current = null;
            window.location.reload();
          }}
          style={{
            marginTop: '10px',
            padding: '8px 16px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Show info if no sectors
  if (sectors.length === 0) {
    console.log(`⚠️ [Instance ${instanceId.current}] No sectors to display`);
    return null;
  }

  console.log(`✅ [Instance ${instanceId.current}] Rendering ${sectors.length} sectors on map`);

  // Filter by viewport if provided
  const visibleSectors = viewport
    ? sectors.filter((sector) => {
        const { lat, lng } = sector;
        return (
          lat >= viewport.south &&
          lat <= viewport.north &&
          lng >= viewport.west &&
          lng <= viewport.east
        );
      })
    : sectors;

  console.log(`   Visible in viewport: ${visibleSectors.length} / ${sectors.length}`);

  return (
    <>
      {visibleSectors.map((sector, index) => {
        try {
          const p0 = { lat: sector.lat, lng: sector.lng };
          const bw = sector.beamwidth ?? 65;
          const r = (sector.range ?? radius) * (options.scale ?? 1);


          const p1 = computeOffset(p0, r, sector.azimuth - bw / 2);
          const p2 = computeOffset(p0, r, sector.azimuth + bw / 2);

          const triangleCoords = [p0, p1, p2];

          return (
            <PolygonF
              key={sector.id || `sector-${index}`}
              paths={triangleCoords}
              options={{
                fillColor: sector.color,
                fillOpacity: 0.5,
                strokeColor: sector.color,
                strokeWeight: 1.5,
                zIndex: options.zIndex || 200,
                clickable: !!onSectorClick,
              }}
              onClick={() => {
                if (onSectorClick) {
                  console.log(`🖱️ Sector clicked:`, sector);
                  onSectorClick(sector);
                }
              }}
            />
          );
        } catch (err) {
          console.error(`❌ [Instance ${instanceId.current}] Error rendering sector:`, sector, err);
          return null;
        }
      })}
    </>
  );
};

export default NetworkPlannerMap;