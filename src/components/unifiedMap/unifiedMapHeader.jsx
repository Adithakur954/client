import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, Filter, ChartBar, ChevronDown } from "lucide-react";
import { useLocation, Link, useSearchParams } from "react-router-dom";
import { mapViewApi } from "@/api/apiEndpoints";
import ProjectsDropdown from "../project/ProjectsDropdown";

export default function UnifiedHeader({
  onToggleControls,
  isControlsOpen,
  isLeftOpen,
  onLeftToggle,
  showAnalytics,
  projectId,
  sessionIds,
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Get project and session info from URL if not passed as props
  const effectiveProjectId =
    projectId || searchParams.get("project_id") || searchParams.get("project");
  const sessionParam =
    searchParams.get("sessionId") || searchParams.get("session");
  const effectiveSessionIds =
    sessionIds ||
    (sessionParam
      ? sessionParam
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id)
      : []);
  const [project, setProject] = useState(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const response = await mapViewApi.getProjects();

        const allProjects = response?.Data || [];

        if (!Array.isArray(allProjects)) {
          console.error("Unexpected API format:", allProjects);
          return;
        }

        const matchedProject = allProjects.find(
          (project) => project.id === Number(effectiveProjectId)
        );

        if (matchedProject) {
          setProject(matchedProject);
        } else {
          console.warn("⚠️ No project found with ID:", effectiveProjectId);
        }
      } catch (error) {
        console.error("❌ Error fetching project:", error);
      } finally {
        setLoading(false);
      }
    };

    if (effectiveProjectId) {
      fetchProject();
    }
  }, [effectiveProjectId]);
  // Detect if we're on the map page
  const isMapPage = location.pathname.includes("unified-map");

  return (
    <header className="h-14 bg-gray-800 text-white shadow-sm flex items-center justify-between px-6 flex-shrink-0 relative z-10">
      <div className="flex items-center gap-4">
        {isMapPage && (
          <>
            <h1 className="text-lg md:text-xl font-semibold">
              {project?.project_name || "Unified Map"}
              <span className="text-sm font-normal text-gray-400 ml-2">
                {effectiveProjectId && `(Project: ${effectiveProjectId})`}
              </span>
            </h1> 
            <Button
              onClick={onToggleControls}
              size="sm"
              className="flex gap-1 items-center bg-blue-600 hover:bg-blue-500 text-white"
            >
              <Filter className="h-4 w-4" />
              {isControlsOpen ? "Close" : "Open"} Filter
            </Button>
             <Button
              onClick={onLeftToggle}
              size="sm"
              className={`flex gap-1 items-center ${
                showAnalytics 
                  ? "bg-green-600 hover:bg-green-500" 
                  : "bg-blue-600 hover:bg-blue-500"
              } text-white`}
            >
              <ChartBar className="h-4 w-4" />
              {showAnalytics ? "Hide" : "Show"} Analytics
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center space-x-4">
        <Button>
          <Link to="/dashboard">Dashboard</Link>
        </Button>
        <Button>
          <Link to="/mapview">Map View</Link>
        </Button>
          <ProjectsDropdown currentProjectId={effectiveProjectId} />
        <p className="text-gray-300 text-sm">
          Welcome,{" "}
          <span className="font-semibold text-white">
            {user?.name || "User"}
          </span>
        </p>
        <Button
          onClick={logout}
          variant="default"
          size="sm"
          className="text-white"
        >
          <LogOut className="h-4 w-4 mr-2 text-white" />
          Logout
        </Button>
      </div>
    </header>
  );
}
