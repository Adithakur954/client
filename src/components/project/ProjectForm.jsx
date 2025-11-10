// components/project/ProjectForm.jsx
import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  AlertCircle,
  FileText,
  X,
  CheckSquare,
  Square,
  Download,
  Info,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { mapViewApi, buildingApi, excelApi, cellSiteApi } from "../../api/apiEndpoints";
import Spinner from "../common/Spinner";
import {
  BuildingGenerator,
  generateBuildingsForPolygon,
} from "./BuildingGenerator";

const PolygonDropdown = ({ polygons, selectedPolygon, setSelectedPolygon }) => {
  const safePolygons = Array.isArray(polygons) ? polygons : [];

  return (
    <div>
      <select
        className="w-full border rounded px-3 py-2 bg-white text-black"
        value={selectedPolygon || ""}
        onChange={(e) =>
          setSelectedPolygon(e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">
          {safePolygons.length === 0
            ? "No polygons available"
            : "Select polygon..."}
        </option>
        {safePolygons.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}{" "}
            {p.sessionIds?.length > 0
              ? `(${p.sessionIds.length} sessions)`
              : ""}
          </option>
        ))}
      </select>

      <div className="text-xs text-gray-500 mt-1">
        {safePolygons.length === 0 ? (
          <span className="text-orange-600">⚠ No polygons loaded yet</span>
        ) : (
          <span className="text-green-600">
            ✓ {safePolygons.length} polygon(s) available
          </span>
        )}
      </div>
    </div>
  );
};

const PolygonSessionSelector = ({
  sessions,
  selectedSessions,
  setSelectedSessions,
}) => {
  const allSelected =
    sessions.length > 0 && selectedSessions.length === sessions.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedSessions([]);
    } else {
      setSelectedSessions([...sessions]);
    }
  };

  const toggleSession = (sessionId) => {
    if (selectedSessions.includes(sessionId)) {
      setSelectedSessions(selectedSessions.filter((id) => id !== sessionId));
    } else {
      setSelectedSessions([...selectedSessions, sessionId]);
    }
  };

  if (!sessions || sessions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-blue-900">
          Available Sessions ({sessions.length})
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleAll}
          className="h-7 text-xs"
        >
          {allSelected ? (
            <>
              <CheckSquare className="h-3 w-3 mr-1" />
              Deselect All
            </>
          ) : (
            <>
              <Square className="h-3 w-3 mr-1" />
              Select All
            </>
          )}
        </Button>
      </div>

      <div className="space-y-1 max-h-48 overflow-y-auto">
        {sessions.map((sessionId) => (
          <label
            key={sessionId}
            className="flex items-center gap-2 p-2 hover:bg-blue-100 rounded cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedSessions.includes(sessionId)}
              onChange={() => toggleSession(sessionId)}
              className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              Session ID: {sessionId}
            </span>
          </label>
        ))}
      </div>

      <div className="text-xs text-blue-600 mt-2">
        {selectedSessions.length === 0
          ? "⚠ No sessions selected"
          : selectedSessions.length === sessions.length
          ? `✓ All ${sessions.length} sessions selected`
          : `✓ ${selectedSessions.length} of ${sessions.length} sessions selected`}
      </div>
    </div>
  );
};

export const ProjectForm = ({
  polygons,
  loading: parentLoading,
  onProjectCreated,
}) => {
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
    trainPath: "",
  });

  const fileInputRef = useRef(null);

  // Update polygon data when selection changes
  useEffect(() => {
    if (selectedPolygon) {
      const polygon = polygons.find((p) => p.value === selectedPolygon);

      setSelectedPolygonData(polygon);
      setGeneratedBuildings(null);

      if (polygon?.sessionIds && polygon.sessionIds.length > 0) {
        setSelectedSessions(polygon.sessionIds);
      } else {
        setSelectedSessions([]);
      }
    } else {
      setSelectedPolygonData(null);
      setGeneratedBuildings(null);
      setSelectedSessions([]);
    }
  }, [selectedPolygon, polygons]);

  // File upload handlers
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const ext = selectedFile.name.split(".").pop().toLowerCase();
      if (["csv", "xlsx", "xls"].includes(ext)) {
        setSiteFile(selectedFile);
        toast.success(`✓ File selected: ${selectedFile.name}`);
      } else {
        toast.error("❌ Invalid file type. Only CSV, XLSX, XLS allowed");
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

  const validateForm = () => {
    const errors = [];

    if (!projectName.trim()) {
      errors.push("Project name is required");
    }

    if (projectName.length > 255) {
      errors.push("Project name is too long (max 255 characters)");
    }

    if (!selectedPolygon) {
      errors.push("Please select a polygon");
    }

    // Validate polygon exists in list
    if (selectedPolygon) {
      const polygonExists = polygons?.some(p => p.value === selectedPolygon);
      if (!polygonExists) {
        errors.push("Selected polygon is no longer available. Please refresh and try again.");
      }
    }

    return errors;
  };

  /**
   * Extract project ID from various response structures
   */
  const extractProjectId = (response) => {
    return (
      response?.Data?.projectId ||
      response?.Data?.project_id ||
      response?.Data?.ProjectId ||
      response?.Data?.project?.id ||
      response?.Data?.project?.ID ||
      response?.Data?.id ||
      response?.projectId ||
      response?.project_id ||
      response?.id
    );
  };

  /**
   * Extract project name from response
   */
  const extractProjectName = (response, fallback) => {
    return (
      response?.Data?.project?.project_name ||
      response?.Data?.project?.ProjectName ||
      response?.Data?.project?.name ||
      response?.Data?.project_name ||
      response?.Data?.ProjectName ||
      response?.Data?.name ||
      response?.project?.project_name ||
      response?.project?.ProjectName ||
      response?.project_name ||
      response?.ProjectName ||
      fallback
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

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
    const completedSteps = [];

    try {
      // ========================================
      // STEP 0: AUTO-GENERATE BUILDINGS
      // ========================================
      if (selectedPolygonData && !generatedBuildings) {
        setCurrentStep("Generating buildings from OpenStreetMap...");
        setBuildingLoading(true);

        try {
          const buildingResult = await generateBuildingsForPolygon(
            selectedPolygonData
          );

          if (buildingResult.success && buildingResult.data) {
            setGeneratedBuildings(buildingResult.data);
            buildingsToSave = buildingResult.data;
            toast.success(`✓ Generated ${buildingResult.count} buildings`);
            completedSteps.push("buildings_generated");
          } else {
            console.warn("⚠ No buildings generated:", buildingResult.message);
            toast.info(buildingResult.message || "No buildings found in this area");
            buildingsToSave = null;
          }
        } catch (buildingError) {
          console.error("❌ Building generation error:", buildingError);
          toast.warn(`⚠ Could not generate buildings: ${buildingError.message}`);
          buildingsToSave = null;
        } finally {
          setBuildingLoading(false);
        }
      } else if (generatedBuildings) {
        buildingsToSave = generatedBuildings;
      }

      // ========================================
      // STEP 1: CREATE PROJECT IN C# BACKEND
      // ========================================
      setCurrentStep("Creating project in database...");

      // Validate polygon exists before sending
      if (selectedPolygon && !polygons?.some(p => p.value === selectedPolygon)) {
        throw new Error("Selected polygon is invalid or no longer exists. Please refresh.");
      }

      const projectPayload = {
        ProjectName: projectName.trim(),
        ...(selectedPolygon && { PolygonIds: [selectedPolygon] }),
        ...(selectedSessions.length > 0 && { SessionIds: selectedSessions }),
      };

      console.log("📤 Creating project with payload:", JSON.stringify(projectPayload, null, 2));

      const projectRes = await mapViewApi.createProjectWithPolygons(projectPayload);

      console.log("📥 Project creation response:", JSON.stringify(projectRes, null, 2));

      // Check response status
      if (!projectRes || projectRes.Status !== 1) {
        const errorMsg =
          projectRes?.Message ||
          projectRes?.message ||
          "Project creation failed - no valid response";
        throw new Error(errorMsg);
      }

      // Extract project ID
      projectId = extractProjectId(projectRes);

      if (!projectId) {
        console.error("❌ Failed to extract project ID from response:", projectRes);
        throw new Error("No project ID received from server. Project may not have been created.");
      }

      projectData = projectRes.Data?.project || projectRes.Data || projectRes;

      const projectNameDisplay = extractProjectName(projectRes, projectName);

      console.log(`✅ Project created successfully! ID: ${projectId}, Name: "${projectNameDisplay}"`);
      toast.success(`✅ Project "${projectNameDisplay}" created! ID: ${projectId}`);
      completedSteps.push("project_created");

      // Small delay to ensure database commit
      await new Promise(resolve => setTimeout(resolve, 500));

      // ========================================
      // STEP 2: VERIFY PROJECT EXISTS
      // ========================================
      setCurrentStep("Verifying project...");

      try {
        const verification = await cellSiteApi.verifyProject(projectId);
        
        if (!verification.exists) {
          console.warn("⚠️ Project not found in Python backend, but continuing...");
          // Don't throw error, just log - Python backend might not have the project yet
        } else {
          console.log(`✅ Project ${projectId} verified in Python backend`);
        }
      } catch (verifyError) {
        console.warn("⚠️ Project verification failed, but continuing:", verifyError);
        // Don't fail the whole process if verification fails
      }

      // ========================================
      // STEP 3: SAVE BUILDINGS TO PYTHON BACKEND
      // ========================================
      if (buildingsToSave && selectedPolygonData) {
        setCurrentStep("Saving buildings to project...");

        try {
          const buildingPayload = {
            project_id: projectId,
            polygon_wkt: selectedPolygonData.wkt,
            polygon_label: selectedPolygonData.label,
            buildings_geojson: buildingsToSave,
          };

          console.log(`📤 Saving ${buildingsToSave.features?.length || 0} buildings...`);

          const buildingRes = await buildingApi.saveBuildingsWithProject(buildingPayload);

          if (buildingRes.Status === 1 || buildingRes.success) {
            const count = buildingsToSave.features?.length || 0;
            toast.success(`✅ ${count} buildings saved to project!`);
            completedSteps.push("buildings_saved");
          } else {
            toast.warn("⚠ Buildings could not be saved, but project was created");
          }
        } catch (buildingError) {
          console.error("❌ Building save error:", buildingError);
          toast.warn(`⚠ Building save failed: ${buildingError.message}`);
          // Don't fail the whole process
        }
      }

      // ========================================
      // STEP 4: UPLOAD SITE FILE (if provided)
      // ========================================
      if (siteFile) {
        setCurrentStep(`Processing site file: ${siteFile.name}...`);
        console.log(`📤 Uploading site file: ${siteFile.name} (${(siteFile.size / 1024).toFixed(2)} KB)`);

        try {
          const formData = new FormData();

          formData.append("file", siteFile);
          formData.append("project_id", projectId.toString());
          formData.append("project_name", projectNameDisplay);
          formData.append("method", uploadMethod);
          formData.append("min_samples", uploadParams.minSamples.toString());
          formData.append("bin_size", uploadParams.binSize.toString());
          formData.append("soft_spacing", uploadParams.softSpacing.toString());
          formData.append("use_ta", uploadParams.useTA.toString());
          formData.append("make_map", uploadParams.makeMap.toString());

          if (uploadMethod === "ml") {
            if (uploadParams.modelPath)
              formData.append("model_path", uploadParams.modelPath);
            if (uploadParams.trainPath)
              formData.append("train_path", uploadParams.trainPath);
          }

          // Log FormData for debugging
          console.log("📋 FormData contents:");
          for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
              console.log(`  ${key}: ${value.name} (${value.size} bytes)`);
            } else {
              console.log(`  ${key}: ${value}`);
            }
          }

          const uploadRes = await cellSiteApi.uploadSite(formData);

          console.log("📥 Site upload response:", uploadRes);

          if (uploadRes.success || uploadRes.Status === 1) {
            const message =
              uploadRes.message ||
              uploadRes.Message ||
              "Site file processed successfully!";
            toast.success(`✅ ${message}`);
            completedSteps.push("site_file_uploaded");
          } else {
            const errorMsg =
              uploadRes.error ||
              uploadRes.Message ||
              "Site file processing failed";
            toast.warn(`⚠ Site processing issue: ${errorMsg}`);
          }
        } catch (uploadError) {
          console.error("❌ Site upload error:", uploadError);
          toast.error(`❌ Site upload failed: ${uploadError.message}`);
          // Don't fail the whole process
        }
      }

      // ========================================
      // STEP 5: UPLOAD SESSIONS (if selected)
      // ========================================
      if (selectedSessions && selectedSessions.length > 0) {
        setCurrentStep(`Processing ${selectedSessions.length} sessions...`);

        try {
          const sessionPayload = {
            project_id: projectId,
            project_name: projectName.trim(),
            polygon_id: selectedPolygon,
            session_ids: selectedSessions,
            method: uploadMethod,
          };

          console.log("📤 Uploading sessions:", JSON.stringify(sessionPayload, null, 2));

          const sessionRes = await cellSiteApi.uploadSessions(sessionPayload);

          console.log("📥 Session upload response:", sessionRes);

          if (sessionRes.success || sessionRes.Status === 1) {
            const processedCount = sessionRes.sessions_processed || selectedSessions.length;
            const logsCount = sessionRes.logs_processed || 0;
            toast.success(
              `✅ Processed ${processedCount} sessions (${logsCount} network logs)!`
            );
            completedSteps.push("sessions_uploaded");
          } else {
            toast.warn(
              `⚠ Session upload issue: ${sessionRes.Message || sessionRes.error || "Unknown error"}`
            );
          }
        } catch (sessionError) {
          console.error("❌ Session upload error:", sessionError);
          
          // Provide more specific error message
          let errorMsg = "Session upload failed";
          if (sessionError.response?.data?.error) {
            errorMsg = sessionError.response.data.error;
          } else if (sessionError.message) {
            errorMsg = sessionError.message;
          }
          
          toast.error(`❌ ${errorMsg}`);
          // Don't fail the whole process
        }
      } else {
        console.log("ℹ️ No sessions selected to upload.");
      }

      // ========================================
      // STEP 6: FINALIZE AND CLEANUP
      // ========================================
      setCurrentStep("Finalizing...");

      const successSummary = [
        `✅ Project "${projectNameDisplay}" (ID: ${projectId}) created successfully!`,
        completedSteps.includes("buildings_saved") && `✅ ${buildingsToSave?.features?.length || 0} buildings saved`,
        completedSteps.includes("site_file_uploaded") && `✅ Site file processed`,
        completedSteps.includes("sessions_uploaded") && `✅ ${selectedSessions.length} sessions processed`,
      ].filter(Boolean).join("\n");

      console.log("\n" + "=".repeat(60));
      console.log("🎉 PROJECT CREATION SUCCESSFUL!");
      console.log("=".repeat(60));
      console.log(successSummary);
      console.log("=".repeat(60) + "\n");

      toast.success(`🎉 Project created successfully!`, {
        autoClose: 5000,
      });

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
        trainPath: "",
      });

      if (fileInputRef.current) {
        fileInputRef.current.value = null;
      }

      // Notify parent component
      if (onProjectCreated) {
        onProjectCreated({
          projectId: projectId,
          projectData: projectData,
          completedSteps: completedSteps,
        });
      }

    } catch (err) {
      console.error("\n" + "=".repeat(60));
      console.error("❌ PROJECT CREATION ERROR");
      console.error("=".repeat(60));
      console.error("Error object:", err);
      console.error("Error stack:", err.stack);
      console.error("=".repeat(60) + "\n");

      let errorMessage = "Failed to create project";
      let technicalDetails = "";

      if (err.response?.data) {
        const data = err.response.data;
        
        console.log("📋 Error response data:", JSON.stringify(data, null, 2));

        if (data?.InnerException) {
          technicalDetails = data.InnerException;
          errorMessage = `Database Error: ${data.InnerException}`;
          
          // Check for specific patterns
          if (technicalDetails.toLowerCase().includes("foreign key")) {
            errorMessage = "Invalid polygon or session reference. Please refresh and try again.";
          } else if (technicalDetails.toLowerCase().includes("unique")) {
            errorMessage = "A project with this name already exists.";
          } else if (technicalDetails.toLowerCase().includes("null")) {
            errorMessage = "Required field is missing. Please ensure all fields are filled.";
          }
        } else if (data?.Message || data?.message) {
          errorMessage = data.Message || data.message;
          technicalDetails = errorMessage;
        } else if (data?.errors) {
          const validationErrors = Object.entries(data.errors)
            .map(([field, messages]) => {
              const msgArray = Array.isArray(messages) ? messages : [messages];
              return `${field}: ${msgArray.join(", ")}`;
            })
            .join("; ");
          errorMessage = `Validation Error: ${validationErrors}`;
          technicalDetails = validationErrors;
        } else if (typeof data === "string") {
          errorMessage = data;
          technicalDetails = data;
        }
      } else if (err.request) {
        errorMessage = "No response from server. Please check your connection.";
        technicalDetails = "Network timeout or server unavailable";
      } else {
        errorMessage = err.message || "Unknown error occurred";
        technicalDetails = err.message;
      }

      // Display user-friendly error
      toast.error(`❌ ${errorMessage}`, {
        autoClose: 8000,
      });

      // Log technical details
      if (technicalDetails) {
        console.error("🔍 Technical details:", technicalDetails);
      }

      // If project was created but other operations failed
      if (projectId) {
        const partialSuccessMsg = [
          `ℹ️ Project ID ${projectId} was created, but some operations failed:`,
          !completedSteps.includes("buildings_saved") && "❌ Buildings not saved",
          !completedSteps.includes("site_file_uploaded") && siteFile && "❌ Site file not uploaded",
          !completedSteps.includes("sessions_uploaded") && selectedSessions.length > 0 && "❌ Sessions not uploaded",
        ].filter(Boolean).join("\n");

        console.warn(partialSuccessMsg);
        toast.info(
          `ℹ️ Project ${projectId} was created but some operations failed. Check console for details.`,
          { autoClose: 10000 }
        );

        // Still call the callback with partial success
        if (onProjectCreated) {
          onProjectCreated({
            projectId: projectId,
            projectData: projectData,
            completedSteps: completedSteps,
            partialSuccess: true,
          });
        }
      }
    } finally {
      setLoading(false);
      setBuildingLoading(false);
      setCurrentStep("");
    }
  };

  const canSubmit = projectName.trim() && selectedPolygon;
  const isLoadingPolygons =
    parentLoading && (!polygons || polygons.length === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Project</CardTitle>
        <CardDescription>
          Create a project with polygon, sessions, buildings, and site data
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
            <Label>
              Select Polygon <span className="text-red-500">*</span>
            </Label>

            {isLoadingPolygons ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <Spinner className="h-4 w-4" />
                <span className="text-sm text-gray-600">
                  Loading polygons...
                </span>
              </div>
            ) : (
              <PolygonDropdown
                polygons={polygons || []}
                selectedPolygon={selectedPolygon}
                setSelectedPolygon={setSelectedPolygon}
              />
            )}

            {selectedPolygonData && !generatedBuildings && (
              <div className="flex items-center gap-2 text-sm text-blue-600 mt-1 p-2 bg-blue-50 rounded">
                <Info className="h-4 w-4" />
                <span>Buildings will be generated automatically from OpenStreetMap</span>
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

          {/* Session Selector */}
          {selectedPolygonData?.sessionIds &&
            selectedPolygonData.sessionIds.length > 0 && (
              <PolygonSessionSelector
                sessions={selectedPolygonData.sessionIds}
                selectedSessions={selectedSessions}
                setSelectedSessions={setSelectedSessions}
              />
            )}

          {/* Site File Upload Section */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <Label>Upload Site Data (Optional)</Label>
              <Button
                type="button"
                onClick={() => excelApi.downloadTemplate(3)}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
              >
                <Download className="mr-1 h-3 w-3" />
                Download Template
              </Button>
            </div>

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
            <Button
              type="submit"
              disabled={loading || !canSubmit || isLoadingPolygons}
              className="min-w-[200px]"
            >
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
            <Alert className="bg-blue-50 border-blue-200">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-900">
                <strong>Progress:</strong> {currentStep}
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  );
};