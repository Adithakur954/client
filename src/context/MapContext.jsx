import React, { createContext, useContext, useState, useCallback, useMemo, useRef } from "react";

const MapContext = createContext(null);

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMapContext must be used within MapProvider");
  }
  return context;
};

export const MapProvider = ({ children }) => {
  // UI State
  const [ui, setUi] = useState({
    drawEnabled: false,
    shapeMode: "polygon",
    drawPixelateRect: false,
    drawCellSizeMeters: 100,
    drawClearSignal: 0,
    colorizeCells: true,
  });

  // Use refs for data that changes frequently
  const hasLogsRef = useRef(false);
  const polygonStatsRef = useRef(null);
  const downloadHandlersRef = useRef({
    onDownloadStatsCsv: null,
    onDownloadRawCsv: null,
    onFetchLogs: null,
  });

  // Stable updateUI
  const updateUI = useCallback((partial) => {
    setUi((prev) => {
      const hasChanges = Object.keys(partial).some(key => prev[key] !== partial[key]);
      if (!hasChanges) return prev;
      return { ...prev, ...partial };
    });
  }, []);

  // Ref setters (don't trigger re-renders)
  const setHasLogs = useCallback((value) => {
    hasLogsRef.current = value;
  }, []);

  const setPolygonStats = useCallback((value) => {
    polygonStatsRef.current = value;
  }, []);

  const setDownloadHandlers = useCallback((handlers) => {
    downloadHandlersRef.current = { ...downloadHandlersRef.current, ...handlers };
  }, []);

  // Memoized context value
  const contextValue = useMemo(() => ({
    ui,
    updateUI,
    hasLogsRef,
    polygonStatsRef,
    downloadHandlersRef,
    setHasLogs,
    setPolygonStats,
    setDownloadHandlers,
    // Legacy getters
    get hasLogs() { return hasLogsRef.current; },
    get polygonStats() { return polygonStatsRef.current; },
    get downloadHandlers() { return downloadHandlersRef.current; },
  }), [ui, updateUI, setHasLogs, setPolygonStats, setDownloadHandlers]);

  return (
    <MapContext.Provider value={contextValue}>
      {children}
    </MapContext.Provider>
  );
};