// src/pages/PredictionMap.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Circle } from '@react-google-maps/api';
import { toast } from 'react-toastify';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../lib/googleMapsLoader';
import { mapViewApi } from '../api/apiEndpoints';
import Spinner from '../components/common/Spinner';

const MAP_CONTAINER_STYLE = { height: '100%', width: '100%' };
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.2090 };

const PredictionMapPage = () => {
    const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);
    const [predictionData, setPredictionData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [map, setMap] = useState(null); // State to hold the map instance

    // --- FILTERS ---
    const [projectId, setProjectId] = useState(1); // Default to a project ID for demo
    const [metric, setMetric] = useState('RSRP');
    const [pointsInsideBuilding, setPointsInsideBuilding] = useState(false);

    const fetchPredictionData = async () => {
        if (!projectId) {
            toast.info("Please enter a Project ID.");
            return;
        }
        setLoading(true);
        setPredictionData(null);
        try {
            const params = {
                projectId,
                metric,
                pointsInsideBuilding: pointsInsideBuilding ? 1 : 0,
            };
            const response = await mapViewApi.getPredictionLog(params);
            if (response.Status === 1 && response.Data) {
                setPredictionData(response.Data);
                toast.success(`Loaded ${response.Data.dataList.length} prediction points.`);
            } else {
                toast.error(response.Message || "Failed to fetch prediction data.");
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const { dataList = [], avgRsrp, avgRsrq, avgSinr, colorSetting = [], coveragePerfGraph } = predictionData || {};

    // Memoize chart data to prevent re-renders
    const chartData = useMemo(() => {
        return coveragePerfGraph?.series?.[0]?.data.map((item, index) => ({
            name: coveragePerfGraph.Category[index] || `Range ${index + 1}`,
            value: item.y,
            color: item.color,
        })) || [];
    }, [coveragePerfGraph]);

    // This effect will run when the map or data changes to fit the map to the data points.
    useEffect(() => {
        if (!map || !dataList || dataList.length === 0 || !window.google) return;

        const bounds = new window.google.maps.LatLngBounds();
        dataList.forEach(point => {
            if (Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
                bounds.extend({ lat: point.lat, lng: point.lon });
            }
        });

        if (!bounds.isEmpty()) {
            map.fitBounds(bounds);
            // Optional: prevent zooming in too close on a single point
            const listener = window.google.maps.event.addListenerOnce(map, 'idle', () => {
                if (map.getZoom() > 17) {
                    map.setZoom(17);
                }
            });
            // Clean up the listener
            return () => window.google.maps.event.removeListener(listener);
        }
    }, [map, dataList]);


    if (loadError) return <div>Error loading map.</div>;

    return (
        <div className="h-screen flex flex-col p-4 gap-4 bg-gray-50">
            {/* Header & Filters */}
            <div className="flex-shrink-0 bg-white p-4 rounded-lg shadow-md border">
                <h1 className="text-xl font-bold mb-4">Prediction Data Viewer</h1>
                <div className="flex flex-wrap items-end gap-4">
                    <div>
                        <label className="text-sm font-medium">Project ID</label>
                        <input
                            type="number"
                            value={projectId}
                            onChange={(e) => setProjectId(Number(e.target.value))}
                            className="w-full border rounded px-2 py-1"
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Metric</label>
                        <select
                            value={metric}
                            onChange={(e) => setMetric(e.target.value)}
                            className="w-full border rounded px-2 py-1"
                        >
                            <option value="RSRP">RSRP</option>
                            <option value="RSRQ">RSRQ</option>
                            <option value="SINR">SINR</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="insideBuilding"
                            checked={pointsInsideBuilding}
                            onChange={(e) => setPointsInsideBuilding(e.target.checked)}
                        />
                        <label htmlFor="insideBuilding" className="text-sm font-medium">
                            Show Points Inside Building Only
                        </label>
                    </div>
                    <button
                        onClick={fetchPredictionData}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                    >
                        {loading ? 'Loading...' : 'Load Data'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Map */}
                <div className="lg:col-span-2 rounded-lg border shadow-md overflow-hidden">
                    {!isLoaded ? <Spinner /> : (
                        <GoogleMap
                            mapContainerStyle={MAP_CONTAINER_STYLE}
                            center={DEFAULT_CENTER}
                            zoom={5}
                            onLoad={setMap} // Set the map instance on load
                        >
                            {dataList.map((point, index) => (
                                <Circle
                                    key={index}
                                    center={{ lat: point.lat, lng: point.lon }}
                                    radius={15}
                                    options={{
                                        strokeWeight: 0,
                                        fillColor: colorSetting.find(c => point.prm >= c.min && point.prm <= c.max)?.color || '#808080',
                                        fillOpacity: 0.8,
                                    }}
                                />
                            ))}
                        </GoogleMap>
                    )}
                </div>

                {/* Stats & Charts */}
                <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg shadow-md border">
                        <h2 className="font-semibold mb-2">Averages</h2>
                        <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div>
                                <div className="text-gray-500">RSRP</div>
                                <div className="font-bold text-lg">{avgRsrp?.toFixed(2) ?? 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-gray-500">RSRQ</div>
                                <div className="font-bold text-lg">{avgRsrq?.toFixed(2) ?? 'N/A'}</div>
                            </div>
                            <div>
                                <div className="text-gray-500">SINR</div>
                                <div className="font-bold text-lg">{avgSinr?.toFixed(2) ?? 'N/A'}</div>
                            </div>
                        </div>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-md border h-80">
                        <h2 className="font-semibold mb-2">Performance Distribution (%)</h2>
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                    <XAxis type="number" domain={[0, 100]} />
                                    <YAxis type="category" dataKey="name" width={80} />
                                    <Tooltip formatter={(value) => `${value}%`} />
                                    <Bar dataKey="value" background={{ fill: '#eee' }}>
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="text-center text-gray-500 pt-10">No chart data to display.</div>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PredictionMapPage;