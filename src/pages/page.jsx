// src/pages/page.jsx
import React from 'react';

// This page component is deprecated and its functionality has been split into:
// - src/pages/HighPerfMap.jsx (for filtered logs and drawing)
// - src/pages/PredictionMap.jsx (for prediction data display)
// - src/pages/MapView.jsx (for viewing specific session logs via URL)
//
// You can safely remove this file and update the corresponding route in src/App.jsx.

export default function DeprecatedMapView() {
  return (
    <div className="p-6 h-screen flex items-center justify-center text-center">
        <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 p-4 rounded">
            <h1 className="font-bold text-lg mb-2">Page Deprecated</h1>
            <p>The functionality previously here has been moved.</p>
            <ul className="list-disc list-inside text-left mt-2 text-sm">
                <li>For general map viewing with filters and drawing, see '/mapview'.</li>
                <li>For viewing prediction data, see '/prediction-map'.</li>
                <li>For viewing specific session logs (e.g., from Drive Sessions page), see '/map?session=ID'.</li>
            </ul>
        </div>
    </div>
  );
}