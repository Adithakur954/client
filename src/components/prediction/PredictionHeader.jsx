// src/components/prediction/PredictionHeader.jsx
import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, SlidersHorizontal, Search, XCircle } from "lucide-react"; // Removed unused icons
// import { Label } from "@/components/ui/label"; // Removed unused
import MapSideFilter from "./PredictionSide"; // Correct path

export default function PredictionHeader({
  // Props for MapSideFilter integration
  projectId,
  setProjectId,
  metric,
  setMetric,
  reloadData,
  showPolys,
  setShowPolys,
  onlyInside,
  setOnlyInside,
  loading, // Pass loading state to disable Reload button

  // Existing props (may need adjustment if some were only for drawing tools)
  ui,
  onUIChange,
  // hasLogs, // Likely not needed here anymore
  // polygonStats, // Likely not needed here anymore
  // onDownloadStatsCsv, // Likely not needed here anymore
  // onDownloadRawCsv, // Likely not needed here anymore
  // initialFilters, // Likely not needed here anymore
  isSearchOpen,
  onSearchToggle,
}) {
  const { user, logout } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Removed dropdown logic related to drawing tools

  return (
    <header className="h-16 bg-slate-900 text-white shadow flex items-center justify-between px-4 sm:px-6">
      {/* Left: Logo + Title */}
      <div className="flex items-center space-x-3">
        {/* <img src={img} alt="Logo" className="h-9" /> */}
        <span className="font-semibold text-lg tracking-wide">Prediction Viewer</span>
      </div>

      {/* Center: Placeholder or other controls if needed */}
      <div></div>

      {/* Right: Header controls + User */}
      <div className="flex items-center space-x-4">
        {/* Removed Search Button - add back if needed */}
        {/* <Button
          size="sm"
          onClick={onSearchToggle}
        >
          {isSearchOpen ? <XCircle/> : <Search /> }
        </Button> */}

        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white"
          onClick={() => setFiltersOpen(true)}
          title="Open filters & view options"
        >
          <SlidersHorizontal className="h-4 w-4 mr-2" />
          {filtersOpen ? 'Close Filters' : 'Open Filters'}
        </Button>

        {/* MapSideFilter now holds the prediction-specific controls */}
        <MapSideFilter
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          // Pass prediction-specific props
          projectId={projectId}
          setProjectId={setProjectId}
          metric={metric}
          setMetric={setMetric}
          reloadData={reloadData}
          showPolys={showPolys}
          setShowPolys={setShowPolys}
          onlyInside={onlyInside}
          setOnlyInside={setOnlyInside}
          loading={loading}
          // Pass general UI props
          onUIChange={onUIChange}
          ui={ui}
          // Configure appearance
          position="left" // Or "right" if preferred
          autoCloseOnApply={true}
        />

        <p className="text-gray-300 text-sm">
          Welcome,&nbsp;<span className="font-semibold text-white">{user?.name || "User"}</span>
        </p>
        <Button onClick={logout} variant="default" size="sm" className="bg-gray-700 hover:bg-gray-600 text-white">
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </Button>
      </div>
    </header>
  );
}