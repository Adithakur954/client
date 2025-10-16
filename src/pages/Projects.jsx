import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from 'react-router-dom';
import { Trash2, Map } from 'lucide-react';
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
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { mapViewApi, excelApi } from "../api/apiEndpoints";
import Spinner from "../components/common/Spinner";

/* --- Reliable Dropdown for Polygon --- */
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

/* --- Reliable Multi Dropdown for Sessions --- */
const SessionMultiDropdown = ({ sessions, selectedSessions, setSelectedSessions }) => {
  const toggle = (id) => {
    setSelectedSessions((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };



  const handleSelect = (e) => {
    const selected = Array.from(e.target.selectedOptions, (opt) =>
      Number(opt.value)
    );
    setSelectedSessions(selected);
  };

  return (
    <div className="w-full border rounded p-2 bg-white">
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
      {/* <select
  multiple
  value={selectedSessions.map(String)}   // ✅ ensures selections stay highlighted
  onChange={(e) => {
    const selected = Array.from(e.target.selectedOptions, opt => Number(opt.value));
    setSelectedSessions(selected);
  }}
  className="w-full border rounded px-3 py-2 bg-white text-black"
  size={5}  // shows few items at a time
>
  {sessions.map((s) => (
    <option key={s.value} value={s.value}>
      {s.label}
    </option>
  ))}
</select> */}
    </div>
  );
};

const CreateProjectPage = () => {
  const [projectName, setProjectName] = useState("");
  const [polygons, setPolygons] = useState([]);
  const [selectedPolygon, setSelectedPolygon] = useState(null);
  const [loading, setLoading] = useState(false);

  const [existingProjects, setExistingProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [sessionsInRange, setSessionsInRange] = useState([]);
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const navigate = useNavigate();

  const fetchPageData = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const [projectsRes, polygonsRes] = await Promise.all([
        mapViewApi.getProjects(),
         mapViewApi.getProjectPolygons(0),
      ]);

      setExistingProjects(Array.isArray(projectsRes?.Data) ? projectsRes.Data : []);
      if (polygonsRes) {
        const shapeList = polygonsRes.Data ?? polygonsRes;
        setPolygons(shapeList.map((p) => ({ value: p.id, label: p.name })));
      }
    } catch {
      toast.error("Failed to load data.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  // --- THIS IS THE MAIN FIX ---
  // It now accepts the whole project object to get both ID and session IDs.
  const handleViewOnMap = (project) => {
    if (!project || !project.id) {
        toast.warn("Project has no ID to view on map.");
        return;
    }
    console.log(project)
    // Correctly constructs the URL with both `project_id` and `session` parameters.
    navigate(`/map?project_id=${project.id}&session=${encodeURIComponent(project.ref_session_id || '')}`);
  };


  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

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
      console.log("get session ka response dekhne ke liye ",response); // yaha bhi console hai
      const fetched = response.Data || [];
      console.log("fethced data of response ",fetched)
      setSessionsInRange(
        fetched.map((s) => ({
          value: s.id,
          label: s.label || `Session ${s.id}`,
        }))
      );
      console.log("session ki structure ",sessionsInRange)
      if (fetched.length === 0) toast.info("No sessions found.");
    } catch {
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
        SessionIds: selectedSessions? selectedSessions : [] // yeh line yaad rakkho  
      };
      console.log("payload dekh raha", payload)

      // Real API call
      const res = await mapViewApi.createProjectWithPolygons(payload);
      if (res.Status === 1) {
        toast.success(`Project "${projectName}" created successfully!`);
      } else {
        toast.error(res.Message || "Error creating project.");
      }

      setProjectName("");
      setSelectedPolygon(null);
      setSelectedSessions([]);
      setSessionsInRange([]);
      fetchPageData();
    } catch (err) {
      toast.error(`Failed to create project: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = projectName.trim() && (selectedPolygon || selectedSessions.length > 0);

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString() : "N/A");

  return (
    <div className="p-6 h-full bg-gray-100">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Create New Project</CardTitle>
            <CardDescription>
              Link one polygon with test sessions to create a project.
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

              <div >
                <Label>Select Sessions</Label>
                <SessionMultiDropdown
                  sessions={sessionsInRange}
                  selectedSessions={selectedSessions}
                  setSelectedSessions={setSelectedSessions}
                />
              </div>

              <div className="flex justify-end pt-4">
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
            <CardDescription>All created projects.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-gray-50">
                  <TableRow>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Created On</TableHead>
                    <TableHead>Provider</TableHead>
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
                                    {/* --- THIS IS THE SECOND FIX --- */}
                                    {/* It now passes the entire project object `p` */}
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
