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
import { BuildingGenerator, generateBuildingsForPolygon } from "./BuildingGenerator";
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

  // ✅ ADD: Validation function
  const validateForm = () => {
    const errors = [];
    
    if (!projectName.trim()) {
      errors.push("Project name is required");
    }
    
    if (projectName.length > 255) {
      errors.push("Project name is too long (max 255 characters)");
    }
    
    if (!selectedPolygon && (!selectedSessions || selectedSessions.length === 0)) {
      errors.push("Please select at least one polygon or session");
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ IMPROVED: Validation
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      const errorMsg = validationErrors.join(", ");
      toast.error(errorMsg);
      console.error("❌ Validation errors:", validationErrors);
      return;
    }

    setLoading(true);
    let projectId = null;
    let projectData = null;
    let buildingsToSave = generatedBuildings;
    
    try {
      // ============================================
      // STEP 0: AUTO-GENERATE BUILDINGS IF POLYGON SELECTED
      // ============================================
      if (selectedPolygonData && !generatedBuildings) {
        setCurrentStep("Generating buildings from OpenStreetMap...");
        console.log("🏗️ Step 0: Auto-generating buildings...");
        setBuildingLoading(true);
        
        try {
          const buildingResult = await generateBuildingsForPolygon(selectedPolygonData);
          
          if (buildingResult.success && buildingResult.data) {
            setGeneratedBuildings(buildingResult.data);
            buildingsToSave = buildingResult.data;
            toast.success(`✅ Generated ${buildingResult.count} buildings`);
            console.log(`✅ Generated ${buildingResult.count} buildings`);
          } else {
            console.warn("⚠️ No buildings generated:", buildingResult.message);
            toast.info(buildingResult.message);
            buildingsToSave = null;
          }
        } catch (buildingError) {
          console.error("❌ Building generation error:", buildingError);
          toast.warn(`Could not generate buildings: ${buildingError.message}`);
          buildingsToSave = null;
        } finally {
          setBuildingLoading(false);
        }
      } else if (generatedBuildings) {
        console.log("ℹ️ Using previously generated buildings");
        buildingsToSave = generatedBuildings;
      }

      // ============================================
      // STEP 1: CREATE PROJECT AND GET PROJECT ID
      // ============================================
      setCurrentStep("Creating project...");
      console.log("📝 Step 1: Creating project...");
      
      // ✅ FIXED: Ensure proper payload structure
      const projectPayload = {
        ProjectName: projectName.trim(),
        PolygonIds: selectedPolygon ? [selectedPolygon] : [],
        SessionIds: Array.isArray(selectedSessions) ? selectedSessions : [], 
      };

      console.log("📤 Project payload:", projectPayload);

      const projectRes = await mapViewApi.createProjectWithPolygons(projectPayload);
      console.log("📥 Project response:", projectRes);
      
      // ✅ IMPROVED: Better response handling
      if (!projectRes || projectRes.Status !== 1) {
        const errorMsg = projectRes?.Message || projectRes?.message || "Unknown error creating project";
        throw new Error(errorMsg);
      }

      // ✅ IMPROVED: Multiple ways to extract project ID
      projectId = projectRes.Data?.projectId || 
                  projectRes.Data?.project_id ||
                  projectRes.Data?.ProjectId ||
                  projectRes.Data?.project?.id ||
                  projectRes.Data?.project?.ID ||
                  projectRes.projectId ||
                  projectRes.project_id;
      
      projectData = projectRes.Data?.project || projectRes.Data || projectRes;
      
      console.log("🔍 Extracted data:", {
        projectId,
        projectData,
        fullResponse: projectRes
      });
      
      if (!projectId) {
        console.error("❌ Failed to extract project ID from response:", projectRes);
        console.error("   Available keys in Data:", Object.keys(projectRes.Data || {}));
        throw new Error("No project ID received from server. Check server response structure.");
      }

      const projectNameDisplay = projectData?.project_name || 
                                 projectData?.ProjectName || 
                                 projectData?.name || 
                                 projectName;

      toast.success(`✅ Project "${projectNameDisplay}" created! ID: ${projectId}`);
      console.log("✅ Project created successfully:");
      console.log("   - Project ID:", projectId);
      console.log("   - Project Name:", projectNameDisplay);
      console.log("   - Sessions:", projectData?.ref_session_id || selectedSessions);
      console.log("   - Created:", projectData?.created_on || new Date().toISOString());

      // ============================================
      // STEP 2: SEND BUILDING DATA WITH PROJECT ID
      // ============================================
      if (buildingsToSave && selectedPolygonData) {
        setCurrentStep("Saving buildings to project...");
        console.log("🏢 Step 2: Sending building data for project ID:", projectId);
        
        try {
          const buildingPayload = {
            project_id: projectId,
            polygon_wkt: selectedPolygonData.wkt,
            polygon_label: selectedPolygonData.label,
            buildings_geojson: buildingsToSave,
          };

          console.log("📤 Building payload:", {
            project_id: buildingPayload.project_id,
            polygon_label: buildingPayload.polygon_label,
            total_buildings: buildingsToSave.features?.length || 0
          });
          
          const buildingRes = await buildingApi.saveBuildingsWithProject(buildingPayload);
          console.log("📥 Building response:", buildingRes);
          
          if (buildingRes.Status === 1 || buildingRes.success) {
            const count = buildingsToSave.features?.length || 0;
            toast.success(`✅ ${count} buildings saved to project!`);
            console.log("✅ Buildings saved successfully");
          } else {
            console.warn("⚠️ Buildings could not be saved:", buildingRes.Message || buildingRes.error);
            toast.warn("Buildings could not be saved, but project was created");
          }
        } catch (buildingError) {
          console.error("❌ Building save error:", buildingError);
          toast.warn(`Building save failed: ${buildingError.message}`);
        }
      } else if (selectedPolygonData && !buildingsToSave) {
        console.log("ℹ️ No buildings to save (generation may have failed or returned 0 results)");
      } else {
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
          
          formData.append('file', siteFile);
          formData.append('project_id', projectId.toString());
          formData.append('project_name', projectNameDisplay);
          formData.append('method', uploadMethod);
          formData.append('min_samples', uploadParams.minSamples.toString());
          formData.append('bin_size', uploadParams.binSize.toString());
          formData.append('soft_spacing', uploadParams.softSpacing.toString());
          formData.append('use_ta', uploadParams.useTA.toString());
          formData.append('make_map', uploadParams.makeMap.toString());

          if (uploadMethod === 'ml') {
            if (uploadParams.modelPath) formData.append('model_path', uploadParams.modelPath);
            if (uploadParams.trainPath) formData.append('train_path', uploadParams.trainPath);
          }

          console.log("📤 Sending site upload request...");
          const uploadRes = await cellSiteApi.uploadSite(formData);
          console.log("📥 Site upload response:", uploadRes);
          
          if (uploadRes.success || uploadRes.Status === 1) {
            const message = uploadRes.message || uploadRes.Message || "Site file processed successfully!";
            toast.success(`✅ ${message}`);
            console.log("✅ Site file processed successfully");
            
            if (uploadRes.results) {
              console.log("📥 Available downloads:", uploadRes.results);
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
      
      const finalMessage = `Project "${projectNameDisplay}" (ID: ${projectId}) created successfully!`;
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
      
      if (onProjectCreated) {
        onProjectCreated({
          projectId: projectId,
          projectData: projectData
        });
      }

    } catch (err) {
      console.error("❌ PROJECT CREATION ERROR:");
      console.error("   Message:", err.message);
      console.error("   Stack:", err.stack);
      
      // ✅ IMPROVED: Extract detailed error information
      let errorMessage = "Failed to create project";
      
      if (err.response) {
        console.error("   Response Status:", err.response.status);
        console.error("   Response Data:", err.response.data);
        console.error("   Response Headers:", err.response.headers);
        
        const data = err.response.data;
        
        // Extract error message from various possible locations
        if (data?.InnerException) {
          errorMessage = `Database Error: ${data.InnerException}`;
        } else if (data?.Message) {
          errorMessage = data.Message;
        } else if (data?.message) {
          errorMessage = data.message;
        } else if (data?.errors) {
          // ASP.NET validation errors
          const validationErrors = Object.entries(data.errors)
            .map(([field, messages]) => {
              const msgArray = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${msgArray.join(', ')}`;
            })
            .join('; ');
          errorMessage = `Validation Error: ${validationErrors}`;
        } else if (typeof data === 'string') {
          errorMessage = data;
        }
      } else if (err.request) {
        console.error("   No response received");
        errorMessage = "No response from server. Please check your connection.";
      } else {
        errorMessage = err.message || "Unknown error occurred";
      }
      
      toast.error(errorMessage);
      
      if (projectId) {
        toast.info(`Note: Project ID ${projectId} was created but some operations failed.`, {
          autoClose: 5000
        });
      }
    } finally {
      setLoading(false);
      setBuildingLoading(false);
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
            <Label className="pb-1">
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., City Coverage Analysis"
              required
              disabled={loading}
              maxLength={255}
            />
            <p className="text-xs text-gray-500 mt-1">
              {projectName.length}/255 characters
            </p>
          </div>

          {/* Polygon Selection */}
          <div className="space-y-2">
            <Label>Select Polygon</Label>
            <PolygonDropdown
              polygons={polygons}
              selectedPolygon={selectedPolygon}
              setSelectedPolygon={setSelectedPolygon}
            />
            
            {selectedPolygonData && !generatedBuildings && (
              <div className="text-sm text-blue-600 mt-1">
                ℹ️ Buildings will be generated automatically from OpenStreetMap when you create the project
              </div>
            )}
            
            <BuildingGenerator
              selectedPolygonData={selectedPolygonData}
              generatedBuildings={generatedBuildings}
              setGeneratedBuildings={setGeneratedBuildings}
              buildingLoading={buildingLoading}
              setBuildingLoading={setBuildingLoading}
            />
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