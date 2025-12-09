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
  Play,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  mapViewApi,
  buildingApi,
  excelApi,
  cellSiteApi,
  areaBreakdownApi,
  predictionApi,
} from "../../api/apiEndpoints";
import Spinner from "../common/Spinner";

// ============ REUSABLE COMPONENTS ============

const PolygonDropdown = ({ polygons, selectedPolygon, setSelectedPolygon, disabled }) => {
  const safePolygons = Array.isArray(polygons) ? polygons : [];

  return (
    <div>
      <select
        className="w-full border rounded px-3 py-2 bg-white text-black disabled:bg-gray-100"
        value={selectedPolygon || ""}
        onChange={(e) => setSelectedPolygon(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled}
      >
        <option value="">
          {safePolygons.length === 0 ? "No polygons available" : "Select polygon..."}
        </option>
        {safePolygons.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label} {p.sessionIds?.length > 0 ? `(${p.sessionIds.length} sessions)` : ""}
          </option>
        ))}
      </select>
    </div>
  );
};

const SessionSelector = ({ sessions, selectedSessions, setSelectedSessions, disabled }) => {
  const allSelected = sessions.length > 0 && selectedSessions.length === sessions.length;

  const toggleAll = () => {
    setSelectedSessions(allSelected ? [] : [...sessions]);
  };

  const toggleSession = (sessionId) => {
    setSelectedSessions(
      selectedSessions.includes(sessionId)
        ? selectedSessions.filter((id) => id !== sessionId)
        : [...selectedSessions, sessionId]
    );
  };

  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="space-y-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium text-blue-900">
          Sessions ({selectedSessions.length}/{sessions.length} selected)
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleAll}
          disabled={disabled}
          className="h-7 text-xs"
        >
          {allSelected ? <CheckSquare className="h-3 w-3 mr-1" /> : <Square className="h-3 w-3 mr-1" />}
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="space-y-1 max-h-32 overflow-y-auto">
        {sessions.map((sessionId) => (
          <label
            key={sessionId}
            className="flex items-center gap-2 p-2 hover:bg-blue-100 rounded cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedSessions.includes(sessionId)}
              onChange={() => toggleSession(sessionId)}
              disabled={disabled}
              className="h-4 w-4 text-blue-600 rounded"
            />
            <span className="text-sm text-gray-700">Session {sessionId}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

const GridSizeInput = ({ gridSize, setGridSize, minSamples, setMinSamples, disabled }) => {
  const presets = [50, 100, 200, 500];

  return (
    <div className="space-y-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      {/* Grid Size */}
      <div className="space-y-2">
        <Label>Area Grid Size (meters) <span className="text-red-500">*</span></Label>
        <div className="flex gap-2 items-center">
          <Input
            type="number"
            value={gridSize}
            onChange={(e) => setGridSize(e.target.value)}
            disabled={disabled}
            min="1"
            max="10000"
            className="w-24"
          />
          <div className="flex gap-1">
            {presets.map((size) => (
              <Button
                key={size}
                type="button"
                variant={gridSize == size ? "default" : "outline"}
                size="sm"
                onClick={() => setGridSize(size.toString())}
                disabled={disabled}
                className="h-8 px-2 text-xs"
              >
                {size}m
              </Button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500">Grid block size for area breakdown</p>
      </div>

      {/* Min Samples */}
      <div className="space-y-2">
        <Label>Min Samples for Clustering <span className="text-red-500">*</span></Label>
        <Input
          type="number"
          value={minSamples}
          onChange={(e) => setMinSamples(e.target.value)}
          disabled={disabled}
          min="1"
          max="1000"
          className="w-24"
        />
        <p className="text-xs text-gray-500">Minimum samples required for building clusters (default: 10)</p>
      </div>
    </div>
  );
};

// ============ PREDICTION OPTIONS COMPONENT ============

const PredictionOptions = ({ 
  enabled, 
  setEnabled, 
  indoorMode, 
  setIndoorMode,
  predictionGrid,
  setPredictionGrid,
  disabled,
  sessionCount 
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const gridPresets = [10, 22, 50, 100];

  return (
    <div className="space-y-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="run-prediction"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={disabled || sessionCount === 0}
            className="h-4 w-4 text-purple-600 rounded"
          />
          <Label htmlFor="run-prediction" className="text-sm font-medium text-purple-900 cursor-pointer">
            Run LTE Prediction Pipeline
          </Label>
        </div>
        
        {enabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="h-7 text-xs text-purple-700"
          >
            <Settings className="h-3 w-3 mr-1" />
            {showAdvanced ? "Hide" : "Options"}
            {showAdvanced ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
          </Button>
        )}
      </div>

      {sessionCount === 0 && (
        <p className="text-xs text-orange-600">
          ⚠️ Select sessions to enable prediction
        </p>
      )}

      {enabled && sessionCount > 0 && (
        <p className="text-xs text-purple-600">
          Will run prediction on {sessionCount} session(s) after project creation
        </p>
      )}

      {/* Advanced Options */}
      {enabled && showAdvanced && (
        <div className="pt-3 border-t border-purple-200 space-y-4">
          {/* Indoor Mode */}
          <div>
            <Label className="text-sm text-purple-800">Indoor Detection Mode <span className="text-red-500">*</span></Label>
            <select
              value={indoorMode}
              onChange={(e) => setIndoorMode(e.target.value)}
              disabled={disabled}
              className="w-full mt-1 border rounded px-3 py-2 bg-white text-sm"
            >
              <option value="heuristic">Heuristic (Default)</option>
              <option value="ml">Machine Learning</option>
              <option value="none">None</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Method used to detect indoor/outdoor locations
            </p>
          </div>

          {/* Prediction Grid Size */}
          <div className="space-y-2">
            <Label className="text-sm text-purple-800">Prediction Grid Size (meters) <span className="text-red-500">*</span></Label>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                value={predictionGrid}
                onChange={(e) => setPredictionGrid(e.target.value)}
                disabled={disabled}
                min="1"
                max="1000"
                className="w-24"
              />
              <div className="flex gap-1">
                {gridPresets.map((size) => (
                  <Button
                    key={size}
                    type="button"
                    variant={predictionGrid == size ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPredictionGrid(size.toString())}
                    disabled={disabled}
                    className="h-8 px-2 text-xs"
                  >
                    {size}m
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">Grid resolution for prediction output (default: 22m)</p>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ MAIN COMPONENT ============

export const ProjectForm = ({
  polygons,
  loading: parentLoading,
  onProjectCreated,
}) => {
  // Form state
  const [projectName, setProjectName] = useState("");
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [selectedPolygonData, setSelectedPolygonData] = useState(null);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [gridSize, setGridSize] = useState("100");
  const [minSamples, setMinSamples] = useState("10");
  const [siteFile, setSiteFile] = useState(null);

  // Prediction state
  const [runPrediction, setRunPrediction] = useState(false);
  const [indoorMode, setIndoorMode] = useState("heuristic");
  const [predictionGrid, setPredictionGrid] = useState("22");

  // UI state
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState("");

  const fileInputRef = useRef(null);

  // Update polygon data when selection changes
  useEffect(() => {
    if (selectedPolygon) {
      const polygon = polygons.find((p) => p.value === selectedPolygon);
      setSelectedPolygonData(polygon);
      setSelectedSessions(polygon?.sessionIds || []);
    } else {
      setSelectedPolygonData(null);
      setSelectedSessions([]);
    }
  }, [selectedPolygon, polygons]);

  // Reset prediction if no sessions selected
  useEffect(() => {
    if (selectedSessions.length === 0) {
      setRunPrediction(false);
    }
  }, [selectedSessions]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const ext = file.name.split(".").pop().toLowerCase();
      if (["csv", "xlsx", "xls"].includes(ext)) {
        setSiteFile(file);
        toast.success(`File selected: ${file.name}`);
      } else {
        toast.error("Invalid file type. Only CSV, XLSX, XLS allowed");
        e.target.value = null;
      }
    }
  };

  const removeFile = () => {
    setSiteFile(null);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const validateForm = () => {
    const errors = [];
    
    if (!projectName.trim()) {
      errors.push("Project name is required");
    }
    
    if (!selectedPolygon) {
      errors.push("Please select a polygon");
    }
    
    const numGridSize = parseFloat(gridSize);
    if (isNaN(numGridSize) || numGridSize < 1 || numGridSize > 10000) {
      errors.push("Grid size must be between 1 and 10000");
    }

    const numMinSamples = parseInt(minSamples, 10);
    if (isNaN(numMinSamples) || numMinSamples < 1 || numMinSamples > 1000) {
      errors.push("Min samples must be between 1 and 1000");
    }

    if (runPrediction) {
      const numPredictionGrid = parseFloat(predictionGrid);
      if (isNaN(numPredictionGrid) || numPredictionGrid < 1 || numPredictionGrid > 1000) {
        errors.push("Prediction grid must be between 1 and 1000");
      }
    }
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast.error(validationErrors.join(", "));
      return;
    }

    setLoading(true);
    let projectId = null;
    let projectData = null;
    let predictionResult = null;
    const completedSteps = [];

    try {
      // ========== STEP 1: Create Project ==========
      setCurrentStep("Creating project...");

      const projectRes = await mapViewApi.createProjectWithPolygons({
        ProjectName: projectName.trim(),
        PolygonIds: [selectedPolygon],
        SessionIds: selectedSessions,
      });

      if (!projectRes || projectRes.Status !== 1) {
        throw new Error(projectRes?.Message || "Project creation failed");
      }

      projectId = projectRes?.Data?.projectId || projectRes?.Data?.project_id || projectRes?.Data?.id;
      if (!projectId) throw new Error("No project ID received");

      projectData = projectRes.Data?.project || projectRes.Data;
      toast.success(`Project created! ID: ${projectId}`);
      completedSteps.push("project_created");

      // ========== STEP 2: Generate Buildings ==========
      if (selectedPolygonData?.wkt) {
        setCurrentStep("Generating buildings...");

        try {
          const buildingRes = await buildingApi.generateBuildings({
            WKT: selectedPolygonData.wkt,
            Name: selectedPolygonData.label || projectName.trim(),
            project_id: projectId,
          });

          if (buildingRes.Status === 1 || buildingRes.success) {
            toast.success(`Generated ${buildingRes.Stats?.extracted || 0} buildings`);
            completedSteps.push("buildings_generated");
          }
        } catch (err) {
          console.error("Building error:", err);
          toast.warn("Building generation skipped");
        }

        // ========== STEP 3: Area Breakdown ==========
        setCurrentStep(`Analyzing area (${gridSize}m grid, min ${minSamples} samples)...`);

        try {
          const breakdownRes = await areaBreakdownApi.getAreaBreakdown({
            WKT: selectedPolygonData.wkt,
            project_id: projectId,
            Name: projectName.trim(),
            grid: parseFloat(gridSize),
            min_samples: parseInt(minSamples, 10),
          });

          if (breakdownRes?.status === "success") {
            const details = breakdownRes.details || [];
            toast.success(`Area analysis complete: ${details.length} items processed`);
            completedSteps.push("breakdown_processed");
          }
        } catch (err) {
          console.error("Breakdown error:", err);
          toast.warn("Area breakdown failed: " + (err.message || "Unknown error"));
        }
      }

      // ========== STEP 4: Upload Site File (Optional) ==========
      if (siteFile) {
        setCurrentStep(`Processing ${siteFile.name}...`);

        try {
          const formData = new FormData();
          formData.append("file", siteFile);
          formData.append("project_id", projectId.toString());
          formData.append("project_name", projectName.trim());
          formData.append("method", "noml");

          const uploadRes = await cellSiteApi.uploadSite(formData);
          
          if (uploadRes.success || uploadRes.Status === 1) {
            toast.success("Site file processed");
            completedSteps.push("site_uploaded");
          }
        } catch (err) {
          toast.warn(`Site upload failed: ${err.message}`);
        }
      }

      // ========== STEP 5: Upload Sessions ==========
      if (selectedSessions.length > 0) {
        setCurrentStep(`Processing ${selectedSessions.length} sessions...`);

        try {
          const sessionRes = await cellSiteApi.uploadSessions({
            project_id: projectId,
            project_name: projectName.trim(),
            polygon_id: selectedPolygon,
            session_ids: selectedSessions,
            method: "noml",
          });

          if (sessionRes.success || sessionRes.Status === 1) {
            toast.success(`Processed ${selectedSessions.length} sessions`);
            completedSteps.push("sessions_uploaded");
          }
        } catch (err) {
          if (!err.message?.includes("already exists")) {
            toast.warn(`Session upload issue: ${err.message}`);
          }
        }
      }

      // ========== STEP 6: Run Prediction ==========
      if (runPrediction && selectedSessions.length > 0) {
        setCurrentStep(`Running LTE prediction (${predictionGrid}m grid)...`);

        try {
          const predRes = await predictionApi.runPrediction({
            Project_id: projectId,
            Session_ids: selectedSessions,
            indoor_mode: indoorMode,
            grid: parseFloat(predictionGrid),
          });

          if (predRes.status === "success" || predRes.message) {
            predictionResult = predRes;
            toast.success(`Prediction complete! ${predRes.predictions_saved || 0} predictions saved`);
            completedSteps.push("prediction_completed");
          }
        } catch (err) {
          console.error("Prediction error:", err);
          toast.warn(`Prediction failed: ${err.message}`);
        }
      }

      // ========== DONE ==========
      setCurrentStep("");
      toast.success("🎉 Project created successfully!", { autoClose: 5000 });

      // Reset form
      setProjectName("");
      setSelectedPolygon(null);
      setSelectedSessions([]);
      setSiteFile(null);
      setGridSize("100");
      setMinSamples("10");
      setRunPrediction(false);
      setIndoorMode("heuristic");
      setPredictionGrid("22");
      if (fileInputRef.current) fileInputRef.current.value = null;

      // Callback
      if (onProjectCreated) {
        onProjectCreated({
          projectId,
          projectData,
          completedSteps,
          predictionResult,
          gridSize: parseFloat(gridSize),
          minSamples: parseInt(minSamples, 10),
          predictionGrid: parseFloat(predictionGrid),
        });
      }

    } catch (err) {
      console.error("Project creation error:", err);
      
      let errorMessage = "Failed to create project";
      if (err.response?.data?.Message) {
        errorMessage = err.response.data.Message;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast.error(errorMessage, { autoClose: 8000 });

    } finally {
      setLoading(false);
      setCurrentStep("");
    }
  };

  const canSubmit = projectName.trim() && selectedPolygon && parseFloat(gridSize) > 0 && parseInt(minSamples, 10) > 0;
  const isLoadingPolygons = parentLoading && (!polygons || polygons.length === 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Project</CardTitle>
        <CardDescription>
          Set up a project with polygon, buildings, area breakdown, and optional prediction
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Project Name */}
          <div>
            <Label>
              Project Name <span className="text-red-500">*</span>
            </Label>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g., City Coverage Analysis"
              disabled={loading}
              maxLength={255}
              className="mt-1"
            />
          </div>

          {/* Polygon Selection */}
          <div className="space-y-3">
            <Label>
              Select Polygon <span className="text-red-500">*</span>
            </Label>

            {isLoadingPolygons ? (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                <Spinner className="h-4 w-4" />
                <span className="text-sm text-gray-600">Loading polygons...</span>
              </div>
            ) : (
              <PolygonDropdown
                polygons={polygons || []}
                selectedPolygon={selectedPolygon}
                setSelectedPolygon={setSelectedPolygon}
                disabled={loading}
              />
            )}

            {/* Show WKT info when polygon is selected */}
            {selectedPolygonData?.wkt && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800 font-medium">✓ Polygon WKT loaded</p>
                <p className="text-xs text-green-600 mt-1 truncate" title={selectedPolygonData.wkt}>
                  {selectedPolygonData.wkt.substring(0, 80)}...
                </p>
              </div>
            )}

            {/* Grid Size & Min Samples - Show when polygon selected */}
            {selectedPolygonData && (
              <GridSizeInput
                gridSize={gridSize}
                setGridSize={setGridSize}
                minSamples={minSamples}
                setMinSamples={setMinSamples}
                disabled={loading}
              />
            )}
          </div>

          {/* Session Selector */}
          {selectedPolygonData?.sessionIds?.length > 0 && (
            <SessionSelector
              sessions={selectedPolygonData.sessionIds}
              selectedSessions={selectedSessions}
              setSelectedSessions={setSelectedSessions}
              disabled={loading}
            />
          )}

          {/* Prediction Options */}
          {selectedPolygonData && (
            <PredictionOptions
              enabled={runPrediction}
              setEnabled={setRunPrediction}
              indoorMode={indoorMode}
              setIndoorMode={setIndoorMode}
              predictionGrid={predictionGrid}
              setPredictionGrid={setPredictionGrid}
              disabled={loading}
              sessionCount={selectedSessions.length}
            />
          )}

          {/* Site File Upload (Collapsible) */}
          <details className="group">
            <summary className="cursor-pointer list-none">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors">
                <Upload className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">
                  Upload Site Data (Optional)
                </span>
                {siteFile && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    1 file
                  </span>
                )}
                <ChevronDown className="h-4 w-4 ml-auto group-open:rotate-180 transition-transform" />
              </div>
            </summary>
            
            <div className="mt-2 p-4 bg-gray-50 rounded-lg border space-y-3">
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={() => excelApi.downloadTemplate(3)}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                >
                  <Download className="mr-1 h-3 w-3" />
                  Template
                </Button>
              </div>

              {!siteFile ? (
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={loading}
                />
              ) : (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium text-blue-900">{siteFile.name}</p>
                      <p className="text-xs text-blue-600">
                        {(siteFile.size / 1024).toFixed(1)} KB
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
          </details>

          {/* Progress Alert */}
          {loading && currentStep && (
            <Alert className="bg-blue-50 border-blue-200">
              <Spinner className="h-4 w-4" />
              <AlertDescription className="text-blue-900 ml-2">
                {currentStep}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={loading || !canSubmit || isLoadingPolygons}
              className="min-w-[180px]"
            >
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Create Project
                </>
              )}
            </Button>
          </div>

          {/* Summary Info */}
          {selectedPolygonData && !loading && (
            <div className="text-xs text-gray-500 border-t pt-3 mt-3 space-y-1">
              <p><strong>Pipeline Steps:</strong></p>
              <ol className="list-decimal list-inside space-y-0.5 ml-2">
                <li>Create project with polygon</li>
                <li>Generate buildings from WKT</li>
                <li>Area breakdown (grid: {gridSize}m, min samples: {minSamples})</li>
                {selectedSessions.length > 0 && <li>Process {selectedSessions.length} session(s)</li>}
                {siteFile && <li>Upload site data</li>}
                {runPrediction && selectedSessions.length > 0 && (
                  <li>Run prediction (grid: {predictionGrid}m, mode: {indoorMode})</li>
                )}
              </ol>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
};

export default ProjectForm;