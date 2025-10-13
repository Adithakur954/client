// @/context/MapContext.jsx
import React, { createContext, useContext, useState } from "react";

const MapContext = createContext();

export const useMapContext = () => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMapContext must be used within MapProvider");
  }
  return context;
};

export const MapProvider = ({ children }) => {
  const [ui, setUi] = useState({
    drawEnabled: false,
    shapeMode: "polygon",
    drawPixelateRect: false,
    drawCellSizeMeters: 100,
    drawClearSignal: 0,
  });
  const [hasLogs, setHasLogs] = useState(false);
  const [polygonStats, setPolygonStats] = useState(null);
  const [downloadHandlers, setDownloadHandlers] = useState({
    onDownloadStatsCsv: null,
    onDownloadRawCsv: null,
  });

  const updateUI = (partial) => setUi((prev) => ({ ...prev, ...partial }));

  return (
    <MapContext.Provider
      value={{
        ui,
        updateUI,
        hasLogs,
        setHasLogs,
        polygonStats,
        setPolygonStats,
        downloadHandlers,
        setDownloadHandlers,
      }}
    >
      {children}
    </MapContext.Provider>
  );
};