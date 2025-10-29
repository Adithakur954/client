// components/project/BuildingGenerator.jsx
import React from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Building, Download } from "lucide-react";
import { buildingApi } from "../../api/apiEndpoints";
import Spinner from "../common/Spinner";

export const BuildingGenerator = ({ 
  selectedPolygonData, 
  generatedBuildings, 
  setGeneratedBuildings,
  buildingLoading,
  setBuildingLoading 
}) => {
  const handleGenerateBuildings = async () => {
    if (!selectedPolygonData) {
      toast.warn("Please select a polygon first");
      return;
    }

    if (!selectedPolygonData.wkt) {
      toast.error("Selected polygon has no WKT data");
      return;
    }

    setBuildingLoading(true);
    
    try {
      console.log("🏗️ Generating buildings for:", selectedPolygonData.label);
      const payload = { WKT: selectedPolygonData.wkt };
      const response = await buildingApi.generateBuildings(payload);

      if (response.Status === 1 && response.Stats?.total_buildings > 0) {
        toast.success(response.Message);
        setGeneratedBuildings(response.Data);
        downloadGeoJSON(response.Data, `buildings_${selectedPolygonData.label}.geojson`);
      } else if (response.Status === 0 && response.Stats?.total_buildings === 0) {
        toast.info(response.Message || "No buildings found in this area. Try a larger area.");
        setGeneratedBuildings(null);
      } else {
        toast.warning(response.Message || "Unexpected response from server");
      }
    } catch (error) {
      console.error("❌ Building generation error:", error);
      if (error.response?.data?.Message) {
        toast.error(error.response.data.Message);
      } else if (error.request) {
        toast.error("Python backend not responding. Is it running on port 5001?");
      } else {
        toast.error(`Error: ${error.message}`);
      }
    } finally {
      setBuildingLoading(false);
    }
  };

  const downloadGeoJSON = (geojson, filename) => {
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded: ${filename}`);
  };

  if (!selectedPolygonData) return null;

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGenerateBuildings}
        disabled={buildingLoading}
      >
        {buildingLoading ? (
          <>
            <Spinner className="mr-2 h-4 w-4" />
            Generating Buildings...
          </>
        ) : (
          <>
            <Building className="mr-2 h-4 w-4" />
            Generate Buildings from OpenStreetMap
          </>
        )}
      </Button>

      {generatedBuildings && (
        <div className="p-3 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">
                ✓ Buildings Generated
              </p>
              <p className="text-xs text-green-600">
                {generatedBuildings.features?.length || 0} buildings found
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => downloadGeoJSON(
                generatedBuildings,
                `buildings_${selectedPolygonData?.label}.geojson`
              )}
            >
              <Download className="h-4 w-4 mr-1" />
              Download
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};