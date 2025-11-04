// src/pages/CreateProjectPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { mapViewApi } from "../api/apiEndpoints";
import { ProjectForm } from "../components/project/ProjectForm";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

const CreateProjectPage = () => {
  const [polygons, setPolygons] = useState([]);
  const [backendHealth, setBackendHealth] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPolygons = useCallback(async () => {
    setLoading(true);
    try {
      const polygonsRes = await mapViewApi.getAvailablePolygons(-1);
      if (polygonsRes) {
        const shapeList = polygonsRes.Data ?? polygonsRes;
        const mappedPolygons = shapeList.map((p) => ({
          value: p.id,
          label: p.name,
          wkt: p.wkt,
          geometry: null,
          geojson: null,
        }));
        setPolygons(mappedPolygons);
       
      }
    } catch (error) {
      toast.error("Failed to load polygons.");
      console.error("❌ Polygon fetch error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolygons();
  }, [fetchPolygons]);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create Project</h1>
          <p className="text-gray-600 mt-1">
            Create a new project using available building extraction areas.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPolygons}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Project Form */}
      <ProjectForm
        polygons={polygons}
        backendHealthy={{
          python: backendHealth?.python?.healthy || false,
          csharp: backendHealth?.csharp?.healthy || false,
        }}
        onProjectCreated={fetchPolygons}
      />
    </div>
  );
};

export default CreateProjectPage;
