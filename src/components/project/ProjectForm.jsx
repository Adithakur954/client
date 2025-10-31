// components/project/ProjectForm.jsx
import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mapViewApi } from "../../api/apiEndpoints";
import Spinner from "../common/Spinner";
import { BuildingGenerator } from "./BuildingGenerator";
import { SessionSelector } from "./SessionSelector";
import { UploadSiteModal } from "./UploadSiteModal";

const PolygonDropdown = ({ polygons, selectedPolygon, setSelectedPolygon }) => (
  <select
    className="w-full border rounded px-3 py-2 bg-white text-black"
    value={selectedPolygon || ""}
    onChange={(e) => setSelectedPolygon(e.target.value ? Number(e.target.value) : null)}
  >
    <option value="">Select polygon...</option>
    {polygons.map((p) => (
      <option key={p.value} value={p.value}>
        {p.label}
      </option>
    ))}
  </select>
);

export const ProjectForm = ({ polygons, onProjectCreated }) => {
  const [projectName, setProjectName] = useState("");
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [selectedPolygonData, setSelectedPolygonData] = useState(null);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [generatedBuildings, setGeneratedBuildings] = useState(null);
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  useEffect(() => {
    if (selectedPolygon) {
      const polygon = polygons.find(p => p.value === selectedPolygon);
      setSelectedPolygonData(polygon);
      setGeneratedBuildings(null);
      console.log("📍 Selected Polygon:", polygon);
    } else {
      setSelectedPolygonData(null);
      setGeneratedBuildings(null);
    }
  }, [selectedPolygon, polygons]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!projectName.trim() || (!selectedPolygon && selectedSessions.length === 0)) {
      toast.warn("Please provide a project name and select polygon or session.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ProjectName: projectName,
        PolygonIds: selectedPolygon ? [selectedPolygon] : [],
        SessionIds: selectedSessions || [],
        Buildings: generatedBuildings || null
      };

      const res = await mapViewApi.createProjectWithPolygons(payload);
      
      if (res.Status === 1) {
        toast.success(`Project "${projectName}" created successfully!`);
        
        setProjectName("");
        setSelectedPolygon(null);
        setSelectedSessions([]);
        setGeneratedBuildings(null);
        
        if (onProjectCreated) onProjectCreated();
      } else {
        toast.error(res.Message || "Error creating project.");
      }
    } catch (err) {
      toast.error(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (response) => {
    console.log("✅ Cell site upload successful:", response);
    toast.success("Cell site data processed successfully!");
  };

  const canSubmit = projectName.trim() && (selectedPolygon || selectedSessions.length > 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Create New Project</CardTitle>
          
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label className="pb-1">Project Name</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., City Coverage Analysis"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Select Polygon</Label>
              <PolygonDropdown
                polygons={polygons}
                selectedPolygon={selectedPolygon}
                setSelectedPolygon={setSelectedPolygon}
              />
              
              <BuildingGenerator
                selectedPolygonData={selectedPolygonData}
                generatedBuildings={generatedBuildings}
                setGeneratedBuildings={setGeneratedBuildings}
                buildingLoading={buildingLoading}
                setBuildingLoading={setBuildingLoading}
                
              />
            </div>

            <SessionSelector
              selectedSessions={selectedSessions}
              setSelectedSessions={setSelectedSessions}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                 
                  setUploadModalOpen(true);
                }}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Site
              </Button>
              
              <Button type="submit" disabled={loading || !canSubmit}>
                {loading ? <Spinner /> : "Create Project"}
              </Button>
            </div>

           
          </form>
        </CardContent>
      </Card>

      <UploadSiteModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUploadSuccess={handleUploadSuccess}
      />
    </>
  );
};