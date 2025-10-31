// components/project/ProjectForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, AlertCircle, FileText, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mapViewApi, buildingApi, cellSiteApi } from "../../api/apiEndpoints";
import Spinner from "../common/Spinner";
import { BuildingGenerator } from "./BuildingGenerator";
import { SessionSelector } from "./SessionSelector";

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
  const [currentStep, setCurrentStep] = useState("");
  
  // File upload states
  const [siteFile, setSiteFile] = useState(null);
  const [uploadMethod, setUploadMethod] = useState("noml");
  const [uploadParams, setUploadParams] = useState({
    minSamples: 30,
    binSize: 5,
    softSpacing: false,
    useTA: false,
    makeMap: true,
    modelPath: "",
    trainPath: ""
  });
  
  const fileInputRef = useRef(null);

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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      if (['csv', 'xlsx', 'xls'].includes(ext)) {
        setSiteFile(selectedFile);
        toast.success(`File selected: ${selectedFile.name}`);
      } else {
        toast.error('Invalid file type. Only CSV, XLSX, XLS allowed');
        e.target.value = null;
      }
    }
  };

  const removeFile = () => {
    setSiteFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!projectName.trim() || (!selectedPolygon && selectedSessions.length === 0)) {
      toast.warn("Please provide a project name and select polygon or session.");
      return;
    }

    setLoading(true);
    let projectId = null;
    let projectData = null;
    
    try {
      // ============================================
      // STEP 1: CREATE PROJECT AND GET PROJECT ID
      // ============================================
      setCurrentStep("Creating project...");
      console.log("📝 Step 1: Creating project...");
      
      const projectPayload = {
        ProjectName: projectName,
        PolygonIds: selectedPolygon ? [selectedPolygon] : [],
        SessionIds: selectedSessions || [],
      };

      console.log("Project payload:", projectPayload);

      const projectRes = await mapViewApi.createProjectWithPolygons(projectPayload);
      console.log("Project response:", projectRes);
      
      // Check if the request was successful
      if (projectRes.Status !== 1) {
        throw new Error(projectRes.Message || "Error creating project");
      }

      // Extract project ID from the response structure
      // Based on your response: Data.projectId or Data.project.id
      projectId = projectRes.Data?.projectId || projectRes.Data?.project?.id;
      projectData = projectRes.Data?.project;
      
      if (!projectId) {
        console.error("Failed to extract project ID from response:", projectRes);
        throw new Error("No project ID received from server");
      }

      toast.success(`✅ Project "${projectData?.project_name || projectName}" created! ID: ${projectId}`);
      console.log("✅ Project created successfully:");
      console.log("   - Project ID:", projectId);
      console.log("   - Project Name:", projectData?.project_name);
      console.log("   - Sessions:", projectData?.ref_session_id);
      console.log("   - Created:", projectData?.created_on);

      // ============================================
      // STEP 2: SEND BUILDING DATA WITH PROJECT ID
      // ============================================
      if (generatedBuildings && selectedPolygonData) {
        setCurrentStep("Sending building data...");
        console.log("🏢 Step 2: Sending building data for project ID:", projectId);
        
        try {
          const buildingPayload = {
            project_id: projectId,  // Send the project ID
            polygon_id: selectedPolygon,
            polygon_wkt: selectedPolygonData.wkt,
            polygon_label: selectedPolygonData.label,
            buildings_geojson: generatedBuildings,
            total_buildings: generatedBuildings.features?.length || 0,
            // Additional metadata
            created_by: "user", // You might want to get this from auth context
            created_at: new Date().toISOString()
          };
          
          console.log("Building payload:", {
            project_id: buildingPayload.project_id,
            polygon_id: buildingPayload.polygon_id,
            total_buildings: buildingPayload.total_buildings
          });
          
          // Call Python backend to save buildings
          const buildingRes = await buildingApi.saveBuildingsWithProject(buildingPayload);
          console.log("Building response:", buildingRes);
          
          if (buildingRes.Status === 1 || buildingRes.success) {
            toast.success(`✅ ${buildingPayload.total_buildings} buildings saved to project!`);
            console.log("✅ Buildings saved successfully");
          } else {
            console.warn("⚠️ Buildings could not be saved:", buildingRes.Message || buildingRes.error);
            toast.warn("Buildings could not be saved, but project was created");
          }
        } catch (buildingError) {
          console.error("❌ Building save error:", buildingError);
          toast.warn(`Building save failed: ${buildingError.message}`);
        }
      } else if (generatedBuildings) {
        console.log("ℹ️ Skipping building save - no polygon selected");
      }

      // ============================================
      // STEP 3: UPLOAD SITE FILE WITH PROJECT ID
      // ============================================
      if (siteFile) {
        setCurrentStep("Processing site file...");
        console.log("📡 Step 3: Uploading site file for project ID:", projectId);
        
        try {
          const formData = new FormData();
          
          // Add file and project ID
          formData.append('file', siteFile);
          formData.append('project_id', projectId.toString());
          
          // Add project metadata
          formData.append('project_name', projectData?.project_name || projectName);
          
          // Add processing parameters
          formData.append('method', uploadMethod);
          formData.append('min_samples', uploadParams.minSamples.toString());
          formData.append('bin_size', uploadParams.binSize.toString());
          formData.append('soft_spacing', uploadParams.softSpacing.toString());
          formData.append('use_ta', uploadParams.useTA.toString());
          formData.append('make_map', uploadParams.makeMap.toString());

          // Add ML parameters if using ML method
          if (uploadMethod === 'ml') {
            if (uploadParams.modelPath) formData.append('model_path', uploadParams.modelPath);
            if (uploadParams.trainPath) formData.append('train_path', uploadParams.trainPath);
          }

          // Log FormData contents for debugging
          console.log("Site upload FormData:");
          for (let [key, value] of formData.entries()) {
            if (key === 'file') {
              console.log(`  ${key}: ${value.name} (${value.size} bytes)`);
            } else {
              console.log(`  ${key}: ${value}`);
            }
          }

          const uploadRes = await cellSiteApi.uploadSiteWithProject(formData);
          console.log("Site upload response:", uploadRes);
          
          if (uploadRes.success || uploadRes.Status === 1) {
            const message = uploadRes.message || uploadRes.Message || "Site file processed successfully!";
            toast.success(`✅ ${message}`);
            console.log("✅ Site file processed successfully");
            
            // Log available downloads if any
            if (uploadRes.results) {
              console.log("📥 Available downloads:", uploadRes.results);
              
              // You might want to store these results for download later
              if (uploadRes.output_dir) {
                console.log("📁 Output directory:", uploadRes.output_dir);
              }
            }
          } else {
            const errorMsg = uploadRes.error || uploadRes.Message || "Site file processing failed";
            console.warn("⚠️ Site file processing failed:", errorMsg);
            toast.warn(`Site processing issue: ${errorMsg}`);
          }
        } catch (uploadError) {
          console.error("❌ Site upload error:", uploadError);
          toast.error(`Site upload failed: ${uploadError.message}`);
        }
      } else {
        console.log("ℹ️ No site file to upload");
      }

      // ============================================
      // STEP 4: SUCCESS - CLEANUP AND RESET
      // ============================================
      setCurrentStep("Finalizing...");
      
      // Final success message
      const finalMessage = `Project "${projectData?.project_name || projectName}" (ID: ${projectId}) created successfully!`;
      toast.success(`🎉 ${finalMessage}`);
      console.log("✅ All operations completed successfully!");
      
      // Reset form
      setProjectName("");
      setSelectedPolygon(null);
      setSelectedSessions([]);
      setGeneratedBuildings(null);
      setSiteFile(null);
      setUploadParams({
        minSamples: 30,
        binSize: 5,
        softSpacing: false,
        useTA: false,
        makeMap: true,
        modelPath: "",
        trainPath: ""
      });
      
      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }
      
      // Notify parent component with project details
      if (onProjectCreated) {
        onProjectCreated({
          projectId: projectId,
          projectData: projectData
        });
      }

    } catch (err) {
      console.error("❌ Project creation error:", err);
      toast.error(`Failed: ${err.message}`);
      
      // If project was created but subsequent steps failed
      if (projectId) {
        toast.info(`Project ID ${projectId} was created but some operations failed.`);
      }
    } finally {
      setLoading(false);
      setCurrentStep("");
    }
  };

  const canSubmit = projectName.trim() && (selectedPolygon || selectedSessions.length > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Project</CardTitle>
        <CardDescription>
          Create a project with polygon, buildings, and site data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Project Name */}
          <div>
            <Label className="pb-1">Project Name</Label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., City Coverage Analysis"
              required
              disabled={loading}
            />
          </div>

          {/* Polygon Selection */}
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
            
            {/* Show building count if generated */}
            {generatedBuildings && (
              <div className="text-sm text-green-600 mt-1">
                ✓ {generatedBuildings.features?.length || 0} buildings ready to save
              </div>
            )}
          </div>

          {/* Session Selection */}
          <SessionSelector
            selectedSessions={selectedSessions}
            setSelectedSessions={setSelectedSessions}
          />

          {/* Site File Upload Section */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
            <Label>Upload Site Data (Optional)</Label>
            
            {!siteFile ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                />
                <Upload className="h-4 w-4 text-gray-500" />
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      {siteFile.name}
                    </p>
                    <p className="text-xs text-blue-600">
                      {(siteFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={removeFile}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="submit" disabled={loading || !canSubmit}>
              {loading ? (
                <>
                  <Spinner className="mr-2" />
                  {currentStep || "Processing..."}
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </div>

          {/* Progress Status */}
          {loading && currentStep && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Progress:</strong> {currentStep}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
};