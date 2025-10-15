import React, { useState, useCallback, useEffect } from "react";
import { toast } from "react-toastify";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadCloud, File, X, Download } from "lucide-react";
import Spinner from "../components/common/Spinner";
import SessionSelector from "../components/common/SessionSelector";

import { excelApi } from "../api/apiEndpoints";

import { useFileUpload } from '../hooks/useFileUpload';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const FILE_TYPES = [
  'text/csv',
  'application/zip',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const POLYGON_TYPES = [
  'application/zip',
  'application/geo+json',
  'application/json',
  'text/csv',
];

const UploadDataPage = () => {
  const [sessionFiles, setSessionFiles] = useState([]);
  const [predictionFiles, setPredictionFiles] = useState([]);
  const [polygonFile, setPolygonFile] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedSessions, setSelectedSessions] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [activeTab, setActiveTab] = useState("session");
  const { loading, errorLog, uploadFile, setErrorLog } = useFileUpload();

  // --- NEW STATE FOR DATE FILTER AND SESSIONS ---
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  const handleUpload = async () => {
    const files = activeTab === 'session' ? sessionFiles : predictionFiles;
    if (!files.length) {
      toast.warn('Please select a main data file.');
      return;
    }

    if (activeTab === 'prediction' && !projectName.trim()) {
      toast.warn('Please enter a project name.');
      return;
    }

    const formData = new FormData();
    formData.append('UploadFile', files[0]);
    if (polygonFile) formData.append('UploadNoteFile', polygonFile);
    formData.append('UploadFileType', activeTab === 'session' ? '1' : '2');
    formData.append('remarks', remarks);
    formData.append('ProjectName', projectName);
    formData.append('SessionIds', selectedSessions.join(','));

    const result = await uploadFile(formData);
    console.log("Upload result:", result);
    
    if (result.success) {
      toast.success('File uploaded successfully!');
      resetForm();
      fetchUploadedFiles();
    }
  };

  const resetForm = () => {
    setSessionFiles([]);
    setPredictionFiles([]);
    setPolygonFile(null);
    setProjectName('');
    setRemarks('');
    setSelectedSessions([]);
    setErrorLog('');
  };

  const validateFile = (file, allowedTypes) => {
    if (![...allowedTypes, ""].includes(file.type)) {
      toast.error(`File type '${file.type || "unknown"}' not supported.`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File is too large. (Max 100MB)");
      return false;
    }
    return true;
  };

  const onDropSession = useCallback((files) => {
    const valid = files.filter((f) => validateFile(f, FILE_TYPES));
    if (valid.length) setSessionFiles(valid);
  }, []);

  const onDropPrediction = useCallback((files) => {
    const valid = files.filter((f) => validateFile(f, FILE_TYPES));
    if (valid.length) setPredictionFiles(valid);
  }, []);

  const onDropPolygon = useCallback((files) => {
    const valid = files.filter((f) => validateFile(f, POLYGON_TYPES));
    if (valid.length) setPolygonFile(valid[0]);
  }, []);

  const { getRootProps: getRootPropsSession, getInputProps: getInputPropsSession, isDragActive: isDragActiveSession } = useDropzone({ onDrop: onDropSession, multiple: false });
  const { getRootProps: getRootPropsPrediction, getInputProps: getInputPropsPrediction, isDragActive: isDragActivePrediction } = useDropzone({ onDrop: onDropPrediction, multiple: false });
  const { getRootProps: getRootPropsPolygon, getInputProps: getInputPropsPolygon, isDragActive: isDragActivePolygon } = useDropzone({ onDrop: onDropPolygon, multiple: false });

  const removeFile = (file, type) => {
    if (type === "session") setSessionFiles([]);
    else if (type === "prediction") setPredictionFiles([]);
    else if (type === "polygon") setPolygonFile(null);
  };

  const fetchUploadedFiles = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await excelApi.getUploadedFiles(activeTab === "session" ? 1 : 2);
      
      setUploadedFiles(response.Data || []);
    } catch {
      setUploadedFiles([]);
      toast.error("Failed to fetch uploaded files.");
    } finally {
      setHistoryLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchUploadedFiles();
  }, [fetchUploadedFiles, activeTab]);

  
const handleFetchSessions = async () => {
    if (!startDate || !endDate) {
      toast.warn("Please select both a start and end date.");
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after the end date.");
      return;
    }
    setSessionsLoading(true);
    
    // Create Date objects from the selected dates.
    // This assumes the user's local timezone.
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Set the time of the end date to the very last millisecond of the day.
    // This makes the query inclusive of the entire selected end day.
    end.setHours(23, 59, 59, 999);

    // Convert the dates to the full ISO 8601 format in UTC (e.g., "2025-09-24T18:29:59.999Z")
    // This matches the format that works for you.
    const isoStartDate = start.toISOString();
    const isoEndDate = end.toISOString();

    try {
      // Pass the correctly formatted ISO date strings to the API.
      const response = await excelApi.getSessionsByDateRange(isoStartDate, isoEndDate);
      console.log("Fetched sessions:", response);
      setSessions(response.Data || []);
      if (!response.Data || response.Data.length === 0) {
        toast.info("No sessions found for the selected dates.");
      }
    }  catch (error) {
      console.error("Fetch sessions failed:", error);
      toast.error("Failed to fetch sessions.");
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
};

  const handleDownloadTemplate = async () => {
    try {
      const fileType = activeTab === "session" ? 1 : 2;
      const response = await excelApi.downloadTemplate(fileType);
      const blob = new Blob([response], { type: "application/zip" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = activeTab === "session" ? "Session_Template.zip" : "Prediction_Template.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download template.");
    }
  };

  const renderFileList = (files, type) =>
    files.length ? (
      <div className="mt-4 space-y-2">
        {files.map((file, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-700 rounded px-2 py-1">
            <div className="flex items-center gap-2">
              <File className="h-5 w-5 text-gray-500 dark:text-gray-300" />
              <span>{file.name}</span>
              <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
            <button onClick={(e) => { e.stopPropagation(); removeFile(file, type); }} className="text-red-500 hover:text-red-700" title="Remove">
              <X className="h-5 w-5" />
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const renderFileInput = (getRootProps, getInputProps, isActive, files, type, label) => (
    <div {...getRootProps()} className={`p-8 border-2 border-dashed rounded-lg cursor-pointer text-center transition-colors ${isActive ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900" : "border-gray-300 dark:border-gray-600"}`}>
      <input {...getInputProps()} />
      <UploadCloud className="mx-auto h-10 w-10 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{label || (isActive ? "Drop the file here..." : "Drag 'n' drop a file here, or click to select")}</p>
      {renderFileList(files, type)}
    </div>
  );

  return (
    <div className="p-6 flex flex-col items-center bg-gray-900  text-gray-100">
      <div className="max-w-4xl w-full">
        <h1 className="text-2xl font-semibold mb-4 text-center">Upload Data</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="session">Upload Session Data</TabsTrigger>
            <TabsTrigger value="prediction">Upload Prediction Data</TabsTrigger>
          </TabsList>

          <TabsContent value="session" className="space-y-4 mt-4">
            {renderFileInput(getRootPropsSession, getInputPropsSession, isDragActiveSession, sessionFiles, "session", "Session Data File (.csv or .zip)")}
            <Textarea placeholder="Remarks (Optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </TabsContent>

          <TabsContent value="prediction" className="space-y-4 mt-4">
            {renderFileInput(getRootPropsPrediction, getInputPropsPrediction, isDragActivePrediction, predictionFiles, "prediction", "Prediction Data File (.csv or .zip)")}
            <label className="block font-semibold mb-1">Inbound Polygon File (Required)</label>
            {renderFileInput(getRootPropsPolygon, getInputPropsPolygon, isDragActivePolygon, polygonFile ? [polygonFile] : [], "polygon", "Polygon File (.zip, .geojson, .json)")}
            <Input placeholder="Project Name" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            <SessionSelector selectedSessions={selectedSessions} setSelectedSessions={setSelectedSessions} />
            <Textarea placeholder="Remarks (Optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </TabsContent>
        </Tabs>

        {errorLog && (
          <div className="mt-6 p-4 bg-red-50 border border-red-300 text-red-700 rounded whitespace-pre-wrap max-h-60 overflow-auto">
            <strong>Error Log:</strong>
            <pre>{errorLog}</pre>
          </div>
        )}

        <div className="mt-8 flex justify-center gap-4">
          <Button onClick={handleUpload} disabled={loading} size="lg">
            {loading ? <Spinner /> : "Upload & Process"}
          </Button>
          <Button onClick={handleDownloadTemplate} variant="outline" size="lg">
            <Download className="mr-2 h-4 w-4" />
            Download Template
          </Button>
        </div>

        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Upload History for '{activeTab}'</h2>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Uploaded On</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center"><Spinner /></TableCell></TableRow>
                ) : uploadedFiles.length > 0 ? (
                  uploadedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>{file.file_name}</TableCell>
                      <TableCell>{file.uploaded_by}</TableCell>
                      <TableCell>{new Date(file.uploaded_on).toLocaleString()}</TableCell>
                      <TableCell className={file.status === "Success" ? "text-green-500" : "text-red-500"}>
                        {file.status}
                      </TableCell>
                      <TableCell>{file.remarks}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="text-center h-24">No history found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* --- NEW SECTION FOR FETCHING AND DISPLAYING SESSIONS ---
        <div className="mt-10">
          <h2 className="text-xl font-semibold mb-4">Fetch Sessions by Date Range</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 mb-4">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            <Button onClick={handleFetchSessions} disabled={sessionsLoading}className="">
              {sessionsLoading ? <Spinner /> : "Fetch Sessions"}
            </Button>
          </div>

          <div className="border rounded-lg mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionsLoading ? (
                  <TableRow><TableCell colSpan={2} className="text-center"><Spinner /></TableCell></TableRow>
                ) : sessions.length > 0 ? (
                  sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.id}</TableCell>
                      <TableCell>{session.label}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={2} className="text-center h-24">No sessions found for the selected date range. Select dates and click "Fetch Sessions".</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div> */}
        {/* </div> */}

      </div>
    </div>
  );
};

export default UploadDataPage;