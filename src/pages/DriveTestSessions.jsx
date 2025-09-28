import React, { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../api/apiEndpoints';
import { toast } from 'react-toastify';
import Spinner from '../components/common/Spinner';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Map, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DriveTestSessionsPage = () => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const [currentPage, setCurrentPage] = useState(1);
    const [sessionsPerPage] = useState(10);

    const fetchSessions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await adminApi.getSessions();
            console.log('Fetched sessions:', data);
            setSessions(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(`Failed to fetch sessions: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const handleDelete = async (sessionId) => {
        if (window.confirm('Are you sure you want to delete this session? This will also remove all associated log data.')) {
            try {
                await adminApi.deleteSession(sessionId);
                toast.success('Session deleted successfully');
                fetchSessions();
            } catch (error) {
                toast.error(`Failed to delete session: ${error.message}`);
            }
        }
    };

    const handleViewOnMap = (sessionId) => {
        console.log('Navigating to map view for session:', sessionId);
        navigate(`/map?session=${encodeURIComponent(String(sessionId))}`);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleString();
    };

    const indexOfLastSession = currentPage * sessionsPerPage;
    const indexOfFirstSession = indexOfLastSession - sessionsPerPage;
    const currentSessions = sessions.slice(indexOfFirstSession, indexOfLastSession);
    const totalPages = Math.ceil(sessions.length / sessionsPerPage);

    const paginate = (pageNumber) => {
        if (pageNumber > 0 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    if (loading) {
        return <div className="flex items-center justify-center h-full"><Spinner /></div>;
    }

    return (
        <div className="p-6 h-full bg-gray-800 text-white flex flex-col">
            <h1 className="text-2xl font-semibold mb-4">Manage Drive Test Sessions</h1>
            <div className="rounded-lg border shadow-sm flex-grow overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            
                            <TableHead>User Details</TableHead>
                            <TableHead>Start Time - End Time</TableHead>
                            <TableHead>Start Location</TableHead>
                            <TableHead>End Location</TableHead>
                            <TableHead>Distance(in Km)</TableHead>
                            <TableHead>Capture Frequency</TableHead>
                            <TableHead>Session Remarks</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentSessions.map((session) => (
                            <TableRow key={session.id}>
                                

                                <TableCell className="whitespace-normal break-words max-w-[200px]">
                                    <div className="font-medium">{session.CreatedBy || 'Unknown User'} ({session.mobile || 'N/A'})</div>
                                    <div className="text-sm text-muted-foreground">
                                        {session.make}, {session.model}, {session.os}, {session.operator_name}
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-normal break-words max-w-[200px]"><div>{formatDate(session.start_time)}</div>
<div>{formatDate(session.end_time)}</div></TableCell>
                                <TableCell className="whitespace-normal break-words max-w-[200px]">{session.start_address
}</TableCell>
                                <TableCell className="whitespace-normal break-words max-w-[200px]">{session.end_address
}</TableCell>
                                <TableCell className="whitespace-normal break-words max-w-[200px]">{session.distance_km || 'N/A'}</TableCell>
                                <TableCell className="font-medium whitespace-normal break-words max-w-[200px]"><div>{session.capture_frequency}, {session.operator_name}
 </div></TableCell>
                                <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">{session.notes || 'No Remarks'}</TableCell>
                                
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => handleViewOnMap(session.id)}>
                                        <Map className="h-4 w-4 mr-2" />
                                        View on Map
                                    </Button>
                                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 ml-2" onClick={() => handleDelete(session.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-between p-4 border-t">
                <div className="text-sm text-muted-foreground">
                    Showing {indexOfFirstSession + 1} to {Math.min(indexOfLastSession, sessions.length)} of {sessions.length} entries.
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Previous
                    </Button>
                    <span className="text-sm">
                        Page {currentPage} of {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default DriveTestSessionsPage;