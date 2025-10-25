import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { Trash2, Map, Building, Download } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DatePicker } from "@/components/ui/date-picker";
import { mapViewApi, excelApi, buildingApi } from "../api/apiEndpoints";
import Spinner from "../components/common/Spinner";

/* --- Polygon Dropdown --- */
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

/* --- Session Multi Dropdown --- */
const SessionMultiDropdown = ({ sessions, selectedSessions, setSelectedSessions }) => {
  return (
    <div className="w-full border rounded p-2 bg-white max-h-60 overflow-auto">
      {sessions.map((s) => (
        <label key={s.value} className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={selectedSessions.includes(s.value)}
            onChange={() =>
              setSelectedSessions((prev) =>
                prev.includes(s.value) ? prev.filter((v) => v !== s.value) : [...prev, s.value]
              )
            }
          />
          <span>{s.label}</span>
        </label>
      ))}
    </div>
  );
};

const CreateProjectPage = () => {
  const [projectName, setProjectName] = useState("");
  const [polygons, setPolygons] = useState([]);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [selectedPolygonData, setSelectedPolygonData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [buildingLoading, setBuildingLoading] = useState(false);
  const [generatedBuildings, setGeneratedBuildings] = useState(null);

  const [existingProjects, setExistingProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sessionsInRange, setSessionsInRange] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  
  const navigate = useNavigate();

  // ============ SIMPLE DATA FETCHING (NO WKB PARSING!) ============
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
        
        // Simple mapping - backend now returns WKT directly!
        const mappedPolygons = shapeList.map((p) => {
          console.log(`✅ ${p.name}:`, p.wkt ? 'Has WKT' : 'No WKT');
          
          return {
            value: p.id,
            label: p.name,
            wkt: p.wkt,  // ← Backend returns WKT string directly
            geometry: null,
            geojson: null
          };
        });
        
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

  // Update selected polygon data
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

  // ============ GENERATE BUILDINGS ============
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
    console.log("📤 Sending WKT:", selectedPolygonData.wkt.substring(0, 100) + '...');
    
    const payload = { WKT: selectedPolygonData.wkt };

    const response = await buildingApi.generateBuildings(payload);

    console.log("📥 Response:", response);

    if (response.Status === 1 && response.Stats?.total_buildings > 0) {
      // Success - buildings found
      toast.success(response.Message);
      setGeneratedBuildings(response.Data);
      downloadGeoJSON(response.Data, `buildings_${selectedPolygonData.label}.geojson`);
    } else if (response.Status === 0 && response.Stats?.total_buildings === 0) {
      // No buildings found - not an error, just empty result
      toast.info(response.Message || "No buildings found in this area. Try a larger area.");
      console.log("📊 Area info:", response.Stats);
      setGeneratedBuildings(null);
    } else {
      toast.warning(response.Message || "Unexpected response from server");
    }
    
  } catch (error) {
    console.error("❌ Building generation error:", error);
    
    if (error.response?.data?.Message) {
      toast.error(error.response.data.Message);
    } else if (error.response) {
      toast.error(`Server error: ${error.response.statusText}`);
    } else if (error.request) {
      toast.error("Python backend not responding. Is it running on port 5001?");
    } else {
      toast.error(`Error: ${error.message}`);
    }
  } finally {
    setBuildingLoading(false);
  }
};

  // Download GeoJSON helper
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

  const handleFetchSessions = async () => {
    if (!startDate || !endDate) {
      toast.warn("Please select both start and end dates.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after end date.");
      return;
    }

    setSessionsLoading(true);
    setSelectedSessions([]);
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    try {
      const response = await excelApi.getSessions(start, end);
      const fetched = response.Data || [];
      setSessionsInRange(
        fetched.map((s) => ({
          value: s.id,
          label: s.label || `Session ${s.id}`,
        }))
      );
      if (fetched.length === 0) toast.info("No sessions found.");
    } catch (error) {
      toast.error("Failed to fetch sessions.");
    } finally {
      setSessionsLoading(false);
    }
  };

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
        SessionIds: selectedSessions ? selectedSessions : [],
        Buildings: generatedBuildings || null
      };

      const res = await mapViewApi.createProjectWithPolygons(payload);
      
      if (res.Status === 1) {
        toast.success(`Project "${projectName}" created successfully!`);
        setProjectName("");
        setSelectedPolygon(null);
        setSelectedSessions([]);
        setSessionsInRange([]);
        setGeneratedBuildings(null);
        fetchPageData();
      } else {
        toast.error(res.Message || "Error creating project.");
      }

    } catch (err) {
      toast.error(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = projectName.trim() && (selectedPolygon || selectedSessions.length > 0);
  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "N/A");

  const handleViewOnMap = (project) => {
    if (!project || !project.id) {
      toast.warn("Project has no ID to view on map.");
      return;
    }
    
    const params = new URLSearchParams({
      project_id: project.id,
    });
    
    if (project.ref_session_id) {
      params.set("session", project.ref_session_id);
    }
    
    navigate(`/unified-map?${params.toString()}`);
  };

  return (
    <div className="p-6 h-full bg-gray-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Select polygon and generate building data from OpenStreetMap
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label>Project Name</Label>
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
                
                {selectedPolygon && (
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
                )}
              </div>

              <div className="border rounded-lg p-4 bg-gray-50 space-y-4">
                <Label>Fetch Sessions (Optional)</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                  <DatePicker date={startDate} setDate={setStartDate} />
                  <DatePicker date={endDate} setDate={setEndDate} />
                  <Button
                    type="button"
                    onClick={handleFetchSessions}
                    disabled={sessionsLoading}
                  >
                    {sessionsLoading ? <Spinner /> : "Fetch Sessions"}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Select Sessions</Label>
                <SessionMultiDropdown
                  sessions={sessionsInRange}
                  selectedSessions={selectedSessions}
                  setSelectedSessions={setSelectedSessions}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline">
                  Upload Site
                </Button>
                <Button type="button" variant="outline">
                  Predict Sample
                </Button>
                <Button type="submit" disabled={loading || !canSubmit}>
                  {loading ? <Spinner /> : "Create Project"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Existing Projects</CardTitle>
            <CardDescription>All created projects</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50">
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Created On</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        <Spinner />
                      </TableCell>
                    </TableRow>
                  ) : existingProjects.length ? (
                    existingProjects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.project_name}</TableCell>
                        <TableCell>{formatDate(p.created_on)}</TableCell>
                        <TableCell>{p.provider || "N/A"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" onClick={() => handleViewOnMap(p)}>
                            <Map className="h-4 w-4 mr-2" />
                            View on Map
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No projects found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateProjectPage;