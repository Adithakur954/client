// components/project/ExistingProjectsTable.jsx
import React from "react";
import { useNavigate } from 'react-router-dom';
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Map, Folder, Calendar, Building2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Spinner from "../common/Spinner";

export const ExistingProjectsTable = ({ projects, loading }) => {
  const navigate = useNavigate();

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
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Existing Projects</CardTitle>
        <CardDescription>All created projects</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-32">
            <Spinner />
          </div>
        ) : projects.length ? (
          <div className="max-h-[400px] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="group relative flex flex-col items-center p-4 rounded-lg hover:bg-gray-50 transition-all duration-200 cursor-pointer"
                  onClick={() => handleViewOnMap(p)}
                >
                  {/* Project Icon */}
                  <div className="relative mb-3">
                    <Folder 
                      className="h-16 w-16 text-blue-500 group-hover:text-blue-600 transition-colors" 
                      fill="currentColor"
                      fillOpacity={0.2}
                    />
                    {/* Small map indicator */}
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      <Map className="h-3 w-3 text-gray-600" />
                    </div>
                  </div>
                  
                  {/* Project Name */}
                  <h3 className="text-sm font-medium text-center text-gray-900 mb-1 line-clamp-2 w-full">
                    {p.project_name}
                  </h3>
                  
                  {/* Project Details - shown on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1 mb-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(p.created_on)}</span>
                      </div>
                      {p.provider && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          <span>{p.provider}</span>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                        <div className="border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Date info below name */}
                  <span className="text-xs text-gray-500">
                    {formatDate(p.created_on)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Folder className="h-12 w-12 mb-2 text-gray-300" />
            <span>No projects found.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};