import React, { useState, useEffect, useCallback, memo } from 'react';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Spinner from '../components/common/Spinner';
import { X, Plus, Save } from 'lucide-react';
import { settingApi } from '../api/apiEndpoints';

const PARAMETERS = {
    rsrp: "RSRP",
    rsrq: "RSRQ",
    sinr: "SINR",
    dl_thpt: "DL Throughput",
    ul_thpt: "UL Throughput",
    volte_call: "VoLTE Call",
    lte_bler: "LTE BLER",
    mos: "MOS",
    coveragehole: "Coverage Hole"
};

const DEFAULT_ROW = { range: '', min: 0, max: 0, color: '#00ff00' };
const DEFAULT_COVERAGE_HOLE = -110;

// Single Row Component
const ThresholdRow = memo(({ row, index, onChange, onDelete }) => {
    // Use local state to handle input
    const [min, setMin] = useState(row.min ?? 0);
    const [max, setMax] = useState(row.max ?? 0);
    const [color, setColor] = useState(row.color || '#00ff00');

    // Update local state when row prop changes
    useEffect(() => {
        setMin(row.min ?? 0);
        setMax(row.max ?? 0);
        setColor(row.color || '#00ff00');
    }, [row.min, row.max, row.color]);

    return (
        <div className="grid grid-cols-4 gap-3 items-center p-2 bg-slate-700/50 rounded">
            <Input
                className="text-white"
                type="number"
                placeholder="Min"
                value={min}
                onChange={e => setMin(e.target.valueAsNumber || 0)}
                onBlur={e => onChange(index, 'min', e.target.valueAsNumber || 0)}
            />
            <Input
                className="text-white"
                type="number"
                placeholder="Max"
                value={max}
                onChange={e => setMax(e.target.valueAsNumber || 0)}
                onBlur={e => onChange(index, 'max', e.target.valueAsNumber || 0)}
            />
            <div className="flex items-center gap-2">
                <Input
                    type="color"
                    value={color}
                    onChange={e => {
                        setColor(e.target.value);
                        onChange(index, 'color', e.target.value);
                    }}
                    className="w-12 h-10 p-1 cursor-pointer"
                />
                <Input
                    className="text-white flex-1"
                    placeholder="#00ff00"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    onBlur={e => onChange(index, 'color', e.target.value)}
                />
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(index)}
                className="justify-self-end"
            >
                <X className="h-4 w-4 text-red-400" />
            </Button>
        </div>
    );
});

ThresholdRow.displayName = 'ThresholdRow';

// Threshold Form Component
const ThresholdForm = memo(({ paramKey, paramName, initialData, onUpdate, onClose }) => {
    const [localData, setLocalData] = useState(initialData);

    // Reset local data when initialData changes (switching tabs)
    useEffect(() => {
        setLocalData(initialData);
    }, [initialData]);

    const handleChange = useCallback((index, field, value) => {
        setLocalData(prev => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
    }, []);

    const addRow = useCallback(() => {
        setLocalData(prev => [...prev, { ...DEFAULT_ROW }]);
    }, []);

    const deleteRow = useCallback((index) => {
        setLocalData(prev => prev.filter((_, i) => i !== index));
    }, []);

    // Sync to parent with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            onUpdate(localData);
        }, 300);
        return () => clearTimeout(timer);
    }, [localData, onUpdate]);

    return (
        <div className="mt-4 p-4 border rounded-lg bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">{paramName}</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Header */}
            <div className="grid grid-cols-4 gap-3 text-xs text-gray-400 px-2 mb-2">
                <div>Min</div>
                <div>Max</div>
                <div>Color</div>
                <div></div>
            </div>

            {/* Rows */}
            <div className="space-y-2">
                {localData.map((row, index) => (
                    <ThresholdRow
                        key={`${paramKey}-${index}`}
                        row={row}
                        index={index}
                        onChange={handleChange}
                        onDelete={deleteRow}
                    />
                ))}
            </div>

            {localData.length === 0 && (
                <div className="text-center py-4 text-gray-400">No thresholds configured</div>
            )}

            <Button onClick={addRow} variant="outline" className="mt-4">
                <Plus className="h-4 w-4 mr-1" />
                Add Row
            </Button>
        </div>
    );
});

ThresholdForm.displayName = 'ThresholdForm';

// Coverage Hole Form
const CoverageHoleForm = memo(({ value, setValue, onClose }) => {
    const [localValue, setLocalValue] = useState(value);

    useEffect(() => {
        setLocalValue(value);
    }, [value]);

    const handleBlur = useCallback((e) => {
        const num = Number(e.target.value);
        if (!isNaN(num)) {
            const finalValue = num > 0 ? -num : num;
            setLocalValue(finalValue);
            setValue(finalValue);
        }
    }, [setValue]);

    return (
        <div className="mt-4 p-4 border rounded-lg bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Coverage Hole</h3>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    value={localValue}
                    onChange={e => setLocalValue(Number(e.target.value) || 0)}
                    onBlur={handleBlur}
                    className="w-32 text-white"
                />
                <span className="text-gray-400 text-sm">dBm</span>
            </div>
        </div>
    );
});

CoverageHoleForm.displayName = 'CoverageHoleForm';

// Parse backend data
const parseThresholdData = (data) => {
    const parsedData = { id: data.id };

    Object.keys(PARAMETERS).forEach(key => {
        if (key === "coveragehole") {
            parsedData[key] = Number(data.coveragehole_json) || DEFAULT_COVERAGE_HOLE;
        } else {
            const jsonString = data[`${key}_json`];
            let parsed = [];
            if (jsonString) {
                try { 
                    parsed = JSON.parse(jsonString); 
                } catch { 
                    parsed = []; 
                }
            }
            parsedData[key] = Array.isArray(parsed) ? parsed : [parsed];
        }
    });

    return parsedData;
};

// Build payload for save
const buildSavePayload = (thresholds) => {
    const payload = { id: thresholds.id };

    Object.keys(PARAMETERS).forEach(key => {
        if (key === "coveragehole") {
            payload.coveragehole_json = String(thresholds[key] ?? DEFAULT_COVERAGE_HOLE);
        } else if (key === "volte_call") {
            payload.volte_call = JSON.stringify(thresholds[key] || []);
        } else {
            payload[`${key}_json`] = JSON.stringify(thresholds[key] || []);
        }
    });

    return payload;
};

// Main Page
const SettingsPage = () => {
    const [thresholds, setThresholds] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeParam, setActiveParam] = useState(null);

    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                const response = await settingApi.getThresholdSettings();
                if (mounted) {
                    if (response?.Status === 1 && response.Data) {
                        setThresholds(parseThresholdData(response.Data));
                    } else {
                        toast.error("Failed to load settings");
                    }
                    setLoading(false);
                }
            } catch (error) {
                if (mounted) {
                    toast.error(`Error: ${error.message}`);
                    setLoading(false);
                }
            }
        };

        fetchData();
        return () => { mounted = false; };
    }, []);

    const updateParam = useCallback((key, data) => {
        setThresholds(prev => prev ? { ...prev, [key]: data } : null);
    }, []);

    const handleSave = useCallback(async () => {
        if (!thresholds) return;
        setSaving(true);
        try {
            const response = await settingApi.saveThreshold(buildSavePayload(thresholds));
            if (response?.Status === 1) {
                toast.success("Saved!");
            } else {
                toast.error("Save failed");
            }
        } catch (error) {
            toast.error(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }, [thresholds]);

    const handleClose = useCallback(() => {
        setActiveParam(null);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-gray-800">
                <Spinner />
            </div>
        );
    }

    if (!thresholds) {
        return (
            <div className="flex items-center justify-center h-full w-full bg-gray-800 text-white">
                Failed to load settings
            </div>
        );
    }

    return (
        <div className="bg-gray-800 text-white h-full w-full p-4">
            <h1 className="text-2xl font-bold mb-6">Settings</h1>

            <Card>
                <CardHeader>
                    <CardTitle>Thresholds</CardTitle>
                    <CardDescription>Configure color ranges for map visualization</CardDescription>
                </CardHeader>

                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(PARAMETERS).map(([key, name]) => (
                            <Button
                                key={key}
                                variant={activeParam === key ? "default" : "outline"}
                                onClick={() => setActiveParam(prev => prev === key ? null : key)}
                            >
                                {name}
                            </Button>
                        ))}
                    </div>

                    {activeParam === "coveragehole" && (
                        <CoverageHoleForm
                            key="coveragehole"
                            value={thresholds.coveragehole}
                            setValue={val => updateParam("coveragehole", val)}
                            onClose={handleClose}
                        />
                    )}

                    {activeParam && activeParam !== "coveragehole" && (
                        <ThresholdForm
                            key={activeParam}
                            paramKey={activeParam}
                            paramName={PARAMETERS[activeParam]}
                            initialData={thresholds[activeParam] || []}
                            onUpdate={data => updateParam(activeParam, data)}
                            onClose={handleClose}
                        />
                    )}
                </CardContent>

                <CardFooter className="justify-end">
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Spinner className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default SettingsPage;