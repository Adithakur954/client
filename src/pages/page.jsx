import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { adminApi, excelApi, mapViewApi } from '../api/apiEndpoints';
import { toast } from 'react-toastify';
import Spinner from '../components/common/Spinner';
import MapWithMultipleCircles from '../components/MapwithMultipleCircle';

const MapView = () => {
    const [locations, setLocations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchParams] = useSearchParams();
    const [activeMarker, setActiveMarker] = useState(null);

    // Get the session ID from the URL (e.g., /map-view?session=123)
    const sessionId = useMemo(() => searchParams.get('session'), [searchParams]);

    useEffect(() => {
        if (!sessionId) {
            setError('No session ID provided.');
            setLoading(false);
            return;
        }

        const fetchSessionLogs = async () => {
            try {
                setLoading(true);
                // NOTE: You need to create this API function to get logs for one session
                const logs = await mapViewApi.getNetworkLog({ session_id: sessionId, limit: 10000 });

                if (!Array.isArray(logs) || logs.length === 0) {
                    toast.warn('No location data found for this session.');
                    setLocations([]);
                    return;
                }

                const formattedLocations = logs
                    .filter(log => log.lat && log.lon)
                    .map((log, index, arr) => {
                        let color = '#007BFF';
                        if (index === 0) color = '#28a745';
                        if (index === arr.length - 1) color = '#dc3545';

                        return {
                            // Map Data
                            lat: parseFloat(log.lat),
                            lng: parseFloat(log.lon),
                            color: color,
                            radius: 15,
                            // InfoWindow Data
                            timestamp: log.timestamp,
                            rsrp: log.rsrp,
                            rsrq: log.rsrq,
                            sinr: log.sinr,
                        };
                    });
                
                setLocations(formattedLocations);

            } catch (err) {
                toast.error(`Failed to fetch session data: ${err.message}`);
                setError(`Failed to load data for session ID: ${sessionId}`);
            } finally {
                setLoading(false);
            }
        };

        fetchSessionLogs();
    }, [sessionId]);

    if (loading) return <div className="flex items-center justify-center h-screen"><Spinner /></div>;
    if (error) return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;

    return (
        <div className="p-6 h-screen flex flex-col">
            <div className="flex justify-between items-center mb-4">
                 <h1 className="text-2xl font-semibold">
                    Drive Session Map View (ID: {sessionId})
                </h1>
                <Link to="/drive-test-sessions" className="text-blue-500 hover:underline">
                    &larr; Back to Sessions
                </Link>
            </div>
            <p className="mb-4 text-muted-foreground">
                Showing {locations.length} recorded locations. The path starts <span className="text-green-500 font-bold">green</span> and ends <span className="text-red-500 font-bold">red</span>.
            </p>
            <div className="flex-grow rounded-lg border shadow-sm overflow-hidden">
                {locations.length > 0 ? (
                    <MapWithMultipleCircles locations={locations} activeMarkerIndex={activeMarker}
                        onMarkerClick={setActiveMarker} />
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <p>No valid location data to display.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MapView;