// src/pages/MapView.jsx (Simplified for specific session logs)
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-toastify';

import { mapViewApi, settingApi } from '../api/apiEndpoints';
import Spinner from '../components/common/Spinner';
import MapWithMultipleCircles from '../components/MapwithMultipleCircle';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '@/lib/googleMapsLoader';

const defaultThresholds = {
    rsrp: [], rsrq: [], sinr: [], dl_thpt: [], ul_thpt: [], mos: [], lte_bler: [],
};

// --- Canonical Operator Name Function (Keep existing) ---
const canonicalOperatorName = (raw) => {
    if (!raw && raw !== 0) return "Unknown";
    let s = String(raw).trim();
    s = s.replace(/^IND[-\s]*/i, "");
    const lower = s.toLowerCase();
    if (lower === "//////" || lower === "404011") return "Unknown";
    if (lower.includes("jio")) return "JIO";
    if (lower.includes("airtel")) return "Airtel";
    if (lower.includes("vodafone") || lower.startsWith("vi")) return "Vi (Vodafone Idea)";
    return s;
};


const SimpleMapView = () => {
    const [rawLocations, setRawLocations] = useState([]);
    const [thresholds, setThresholds] = useState(defaultThresholds);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchParams] = useSearchParams();
    const [activeMarker, setActiveMarker] = useState(null);
    const [selectedMetric, setSelectedMetric] = useState("rsrp"); // Default metric

    const sessionIds = useMemo(() => {
        const sessionParam = searchParams.get('session');
        // Handle single or multiple comma-separated IDs
        return sessionParam ? sessionParam.split(',').map(id => id.trim()).filter(id => id) : [];
    }, [searchParams]);

    const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

    // Load thresholds
    useEffect(() => {
        const run = async () => {
            try {
                const res = await settingApi.getThresholdSettings();
                const d = res?.Data;
                if (d) {
                    setThresholds({
                        rsrp: JSON.parse(d.rsrp_json || '[]'),
                        rsrq: JSON.parse(d.rsrq_json || '[]'),
                        sinr: JSON.parse(d.sinr_json || '[]'),
                        dl_thpt: JSON.parse(d.dl_thpt_json || '[]'),
                        ul_thpt: JSON.parse(d.ul_thpt_json || '[]'),
                        mos: JSON.parse(d.mos_json || '[]'),
                        lte_bler: JSON.parse(d.lte_bler_json || '[]'),
                    });
                }
            } catch (e) {
                console.error("Failed to load thresholds:", e);
                // Fallback colors will be used by MapWithMultipleCircles
            }
        };
        run();
    }, []);

    // Fetch session logs based on URL params
    useEffect(() => {
        if (sessionIds.length === 0) {
            setError('No session ID provided in the URL.');
            setLoading(false);
            return;
        }

        const fetchSessionLogs = async () => {
            setLoading(true);
            setError(null);
            try {
                // Fetch logs for all session IDs concurrently
                const promises = sessionIds.map(sessionId =>
                    mapViewApi.getNetworkLog({ session_id: sessionId }) // Removed limit for full data
                );
                const results = await Promise.all(promises);

                const allLogs = results.flatMap(resp => resp?.Data ?? resp?.data ?? resp ?? []);

                if (allLogs.length === 0) {
                    toast.warn('No location data found for the specified session(s).');
                    setRawLocations([]);
                } else {
                    // Normalize points for the map
                    const formattedLocations = allLogs.map((log) => {
                        const lat = parseFloat(log.lat ?? log.Lat ?? log.latitude ?? log.Latitude);
                        const lng = parseFloat(log.lon ?? log.lng ?? log.Lng ?? log.longitude ?? log.Longitude);
                        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
                        return {
                            lat, lng,
                            radius: 18, // Default radius, can be adjusted
                            timestamp: log.timestamp ?? log.time ?? log.created_at ?? log.createdAt,
                            // Include all relevant metrics for potential switching
                            rsrp: log.rsrp ?? log.RSRP ?? log.rsrp_dbm,
                            rsrq: log.rsrq ?? log.RSRQ,
                            sinr: log.sinr ?? log.SINR,
                            dl_thpt: log.dl_thpt ?? log.dl_tpt ?? log.DL ?? log.download,
                            ul_thpt: log.ul_thpt ?? log.ul_tpt ?? log.UL ?? log.upload,
                            mos: log.mos ?? log.MOS,
                            lte_bler: log.lte_bler ?? log.LTE_BLER ?? log.bler,
                            operator: canonicalOperatorName(log.operator_name), // Normalize operator
                            technology: log.technology,
                            band: log.band,
                            // Add other potentially useful fields from log if needed for InfoWindow
                        };
                    }).filter(Boolean); // Remove null entries
                    setRawLocations(formattedLocations);
                }
            } catch (err) {
                console.error("Error fetching session logs:", err);
                toast.error(`Failed to fetch session data: ${err.message || 'Unknown error'}`);
                setError(`Failed to load data for session ID(s): ${sessionIds.join(', ')}`);
                setRawLocations([]);
            } finally {
                setLoading(false);
            }
        };

        fetchSessionLogs();
    }, [sessionIds]); // Refetch only when session IDs change

    if (!isLoaded) return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
    if (loadError) return <div className="flex items-center justify-center h-screen text-red-500">Error loading map library.</div>;
    if (loading) return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-500 p-4 text-center">{error}</div>;

    return (
        <div className="p-4 md:p-6 h-screen flex flex-col bg-gray-50">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
                <h1 className="text-xl md:text-2xl font-semibold">
                    Drive Session Map View
                    <span className="text-base font-normal text-gray-600 block sm:inline sm:ml-2">
                        (ID: {sessionIds.join(', ')})
                    </span>
                </h1>
                <Link to="/drive-test-sessions" className="text-blue-600 hover:underline text-sm sm:text-base">
                    ← Back to All Sessions
                </Link>
            </div>

            {/* Simple Metric Selector */}
            <div className="mb-4 flex items-center gap-2">
                <label htmlFor="metricSelect" className="text-sm font-medium text-gray-700">Display Metric:</label>
                <select
                    id="metricSelect"
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                    <option value="rsrp">RSRP</option>
                    <option value="rsrq">RSRQ</option>
                    <option value="sinr">SINR</option>
                    <option value="dl_thpt">DL Throughput</option>
                    <option value="ul_thpt">UL Throughput</option>
                    <option value="mos">MOS</option>
                    <option value="lte_bler">LTE BLER</option>
                </select>
                <p className="text-xs text-gray-500 ml-auto">
                    Showing {rawLocations.length} locations. Colors reflect {selectedMetric.toUpperCase()} thresholds.
                </p>
            </div>


            {/* Map Container */}
            <div className="flex-grow rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                {rawLocations.length > 0 ? (
                    <MapWithMultipleCircles
                        isLoaded={isLoaded}
                        loadError={loadError}
                        locations={rawLocations}
                        thresholds={thresholds}
                        selectedMetric={selectedMetric} // Pass selected metric
                        activeMarkerIndex={activeMarker}
                        onMarkerClick={setActiveMarker}
                        // Note: No onLoad needed here if this component doesn't need the map instance
                    />
                ) : (
                    <div className="flex items-center justify-center h-full bg-gray-100">
                        <p className="text-gray-600">No valid location data to display for this session.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimpleMapView;