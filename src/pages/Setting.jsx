import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Spinner from '../components/common/Spinner';
import { X, Plus } from 'lucide-react';
import { settingApi } from '../api/apiEndpoints';

// --- Reusable Form for Range-Based Parameters ---
const ThresholdForm = ({ paramName, data, setData, onClose }) => {
    const handleInputChange = (index, field, value) => {
        const updatedData = [...data];
        updatedData[index][field] = value;
        setData(updatedData);
    };

    const addRow = () => {
        const newRow = { range: '', min: 0, max: 0, color: '#000000', level: '' };
        setData([...data, newRow]);
    };

    const deleteRow = (index) => {
        const updatedData = data.filter((_, i) => i !== index);
        setData(updatedData);
    };

    return (
        <div className="mt-4 p-4 border rounded-lg bg-muted/40 dark:bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Edit {paramName} Thresholds</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="space-y-2">
                {data.map((row, index) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-6 items-center gap-2 p-2 border rounded-md">
                        <Input
                            className="md:col-span-2 text-white"
                            placeholder="Range Description (e.g., Poor, Good)"
                            value={row.range || ''}
                            onChange={e => handleInputChange(index, 'range', e.target.value)}
                        />
                        <Input
                            placeholder="Min"
                            className="text-white"
                            type="number"
                            value={row.min ?? 0}
                            onChange={e => handleInputChange(index, 'min', e.target.valueAsNumber)}
                        />
                        <Input
                            placeholder="Max"
                            className="text-white"
                            type="number"
                            value={row.max ?? 0}
                            onChange={e => handleInputChange(index, 'max', e.target.valueAsNumber)}
                        />
                        <Input
                            type="color"
                            value={row.color || '#000000'}
                            onChange={e => handleInputChange(index, 'color', e.target.value)}
                            className="p-1 h-10 w-full text-white"
                        />
                        <Button variant="destructive" size="icon" onClick={() => deleteRow(index)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>

            <Button onClick={addRow} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Add Row
            </Button>
        </div>
    );
};

// --- Specialized Form for Single Negative Number (Coverage Hole) ---
const CoverageHoleForm = ({ value, setValue, onClose }) => {
    const [inputValue, setInputValue] = useState(
        value !== undefined && value !== null ? String(value) : "-110"
    );

    const handleChange = (val) => {
        setInputValue(val);
        const num = Number(val);
        if (!isNaN(num)) {
            setValue(num < 0 ? num : -Math.abs(num));
        }
    };

    return (
        <div className="mt-4 p-4 border rounded-lg bg-muted/40 dark:bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Edit Coverage Hole Threshold</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <Input
                type="text"
                value={inputValue}
                onChange={(e) => handleChange(e.target.value)}
                className="w-40 text-white"
            />
            <p className="text-sm text-gray-400 mt-1">
                Enter a negative dBm threshold (e.g., -110). Only negative values will be saved.
            </p>
        </div>
    );
};

// --- Main Settings Page ---
const SettingsPage = () => {
    const [thresholds, setThresholds] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeParam, setActiveParam] = useState(null);

    // ✅ FIXED: Match backend property names exactly
    const PARAMETERS = {
        rsrp: "RSRP",
        rsrq: "RSRQ",
        sinr: "SINR",
        dl_thpt: "DL Throughput",
        ul_thpt: "UL Throughput",
        volte_call: "VoLTE Call",
        lte_bler: "LTE BLER",
        mos: "MOS",
        coveragehole: "Coverage Hole"  // ✅ Removed underscore
    };

    // --- Fetch Threshold Settings ---
    useEffect(() => {
        const fetchThresholds = async () => {
            setLoading(true);
            try {
                const response = await settingApi.getThresholdSettings();
                console.log("Fetched Threshold Settings:", response);

                if (response && response.Status === 1 && response.Data) {
                    const data = response.Data;
                    const parsedData = {};

                    for (const key in PARAMETERS) {
                        if (key === "coveragehole") {  // ✅ Fixed
                            parsedData[key] = Number(data.coveragehole_json) || -110;
                        } else {
                            const jsonString = data[`${key}_json`];
                            let parsed = [];
                            try {
                                if (jsonString) parsed = JSON.parse(jsonString);
                            } catch {
                                console.error(`Failed to parse JSON for ${key}`);
                            }
                            parsedData[key] = Array.isArray(parsed) ? parsed : [parsed];
                        }
                    }

                    parsedData.id = data.id;
                    setThresholds(parsedData);
                } else {
                    toast.error(response?.Message || "Failed to load settings data.");
                }
            } catch (error) {
                toast.error(`Failed to load threshold settings: ${error.message}`);
            } finally {
                setLoading(false);
            }
        };

        fetchThresholds();
    }, []);

    const updateParamData = (paramKey, newData) => {
        setThresholds(prev => ({
            ...prev,
            [paramKey]: newData,
        }));
    };

    // ✅ FIXED: Save Settings with correct property names
    const handleSaveChanges = async () => {
        if (!thresholds) return;
        setLoading(true);
        try {
            const payload = { id: thresholds.id };

            for (const key in PARAMETERS) {
                if (key === "coveragehole") {  // ✅ Fixed
                    payload.coveragehole_json = String(thresholds[key] ?? -110);
                } else if (key === "volte_call") {  // ✅ Special case - no _json suffix
                    payload.volte_call = JSON.stringify(thresholds[key] || []);
                } else {
                    payload[`${key}_json`] = JSON.stringify(thresholds[key] || []);
                }
            }

            console.log("Payload being sent:", payload);
            const response = await settingApi.saveThreshold(payload);
            console.log("Response:", response);

            if (response && response.Status === 1) {
                toast.success("Thresholds saved successfully!");
                setActiveParam(null);
            } else {
                toast.error(response?.Message || "An unknown error occurred while saving.");
            }
        } catch (error) {
            toast.error(`Save failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !thresholds) return <Spinner />;

    return (
        <div className="bg-gray-800 text-white h-full w-full space-y-8 p-4">
            <h1 className="text-3xl font-bold">Settings</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Thresholds</CardTitle>
                    <CardDescription>
                        Select a parameter to configure its color levels and ranges for map visualization.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(PARAMETERS).map(([key, name]) => (
                            <Button
                                key={key}
                                variant={activeParam === key ? "default" : "outline"}
                                onClick={() => setActiveParam(key)}
                            >
                                {name}
                            </Button>
                        ))}
                    </div>

                    {activeParam && (
                        activeParam === "coveragehole" ? (  // ✅ Fixed
                            <CoverageHoleForm
                                value={thresholds.coveragehole}  // ✅ Fixed
                                setValue={(val) => updateParamData("coveragehole", val)}  // ✅ Fixed
                                onClose={() => setActiveParam(null)}
                            />
                        ) : (
                            <ThresholdForm
                                paramName={PARAMETERS[activeParam]}
                                data={thresholds[activeParam]}
                                setData={(newData) => updateParamData(activeParam, newData)}
                                onClose={() => setActiveParam(null)}
                            />
                        )
                    )}
                </CardContent>

                <CardFooter className="justify-end">
                    <Button onClick={handleSaveChanges} disabled={loading}>
                        {loading ? 'Saving...' : 'Save All Thresholds'}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default SettingsPage;