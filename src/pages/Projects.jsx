// pages/CreateProjectPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { mapViewApi, checkAllServices } from "../api/apiEndpoints";
import { ProjectForm } from "../components/project/ProjectForm";
import { ExistingProjectsTable } from "../components/project/ExistingProjectsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle, CheckCircle, Server } from "lucide-react";

const CreateProjectPage = () => {
  const [polygons, setPolygons] = useState([]);
  const [existingProjects, setExistingProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [backendHealth, setBackendHealth] = useState(null);

  // Check both backends health
  // const checkBackendHealth = useCallback(async () => {
  //   try {
  //     const health = await checkAllServices();
  //     setBackendHealth(health);
  //     console.log("✅ Backend health check:", health);
      
  //     if (!health.python.healthy) {
  //       console.warn("⚠️ Python backend (port 5000) is not responding");
  //     }
  //     if (!health.csharp.healthy) {
  //       console.warn("⚠️ C# backend (port 5224) is not responding");
  //       toast.error("C# backend service is not responding");
  //     }
  //   } catch (error) {
  //     console.error("❌ Backend health check failed:", error);
  //     setBackendHealth({ 
  //       python: { healthy: false, error: error.message },
  //       csharp: { healthy: false, error: error.message }
  //     });
  //   }
  // }, []);

  const fetchPageData = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const [projectsRes, polygonsRes] = await Promise.all([
        mapViewApi.getProjects(),
        mapViewApi.getAvailablePolygons(-1),
      ]);
      
      console.log("🔍 Polygons Response:", polygonsRes);
      
      setExistingProjects(Array.isArray(projectsRes?.Data) ? projectsRes.Data : []);

      if (polygonsRes) {
        const shapeList = polygonsRes.Data ?? polygonsRes;
        console.log("📦 Processing", shapeList.length, "polygons");
        
        const mappedPolygons = shapeList.map((p) => ({
          value: p.id,
          label: p.name,
          wkt: p.wkt,
          geometry: null,
          geojson: null
        }));
        
        setPolygons(mappedPolygons);
        
        const withWkt = mappedPolygons.filter(p => p.wkt).length;
        console.log(`✅ Loaded ${withWkt}/${mappedPolygons.length} polygons with WKT`);
      }
    } catch (error) {
      toast.error("Failed to load data.");
      console.error("❌ Fetch Error:", error);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    
    fetchPageData();
  }, [fetchPageData]);

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Project Management</h1>
            <p className="text-gray-600 mt-1">Create and manage your projects with building extraction</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              
              fetchPageData();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Backend Status Alerts */}
        
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Project Form */}
        <ProjectForm 
          polygons={polygons} 
          onProjectCreated={fetchPageData}
          backendHealthy={{
            python: backendHealth?.python?.healthy || false,
            csharp: backendHealth?.csharp?.healthy || false,
          }}
        />

        {/* Existing Projects Table */}
        <ExistingProjectsTable 
          projects={existingProjects}
          loading={projectsLoading}
          onRefresh={fetchPageData}
        />
      </div>
    </div>
  );
};

export default CreateProjectPage;