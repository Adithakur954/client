import React, { useState, useEffect, useCallback, memo } from 'react';
import { toast } from 'react-toastify';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Spinner from '../components/common/Spinner';
import { X, Plus, Save, RefreshCw } from 'lucide-react';
import { settingApi } from '../api/apiEndpoints';
import { useAuth } from '@/context/AuthContext';

const PARAMETERS = {
    rsrp: "RSRP",
    rsrq: "RSRQ",
    sinr: "SINR",
    dl_thpt: "DL Throughput",
    ul_thpt: "UL Throughput",
    volte_call: "VoLTE Call",
    
    mos: "MOS",
    coveragehole: "Coverage Hole"
};

const DEFAULT_ROW = { min: 0, max: 0, color: '#00ff00', label: '' };
const DEFAULT_COVERAGE_HOLE = -110;

// ✅ Generate range string from min/max
const generateRangeString = (min, max) => {
    if (min === undefined || max === undefined || min === null || max === null) {
        return '';
    }
    return `${min} to ${max}`;
};

// ✅ Clean and normalize threshold row data
const normalizeRow = (row) => {
    const min = Number(row.min) || 0;
    const max = Number(row.max) || 0;
    
    return {
        min,
        max,
        color: row.color || '#00ff00',
        label: row.label || '',
        range: generateRangeString(min, max), // Auto-generate range
    };
};

// Single Row Component
const ThresholdRow = memo(({ row, index, onChange, onDelete, paramKey }) => {
    const [min, setMin] = useState(row.min ?? 0);
    const [max, setMax] = useState(row.max ?? 0);
    const [color, setColor] = useState(row.color || '#00ff00');
    const [label, setLabel] = useState(row.label || '');

    // Update local state when row prop changes
    useEffect(() => {
        setMin(row.min ?? 0);
        setMax(row.max ?? 0);
        setColor(row.color || '#00ff00');
        setLabel(row.label || '');
    }, [row.min, row.max, row.color, row.label]);

    // Handle min change
    const handleMinChange = (value) => {
        setMin(value);
    };

    const handleMinBlur = () => {
        onChange(index, { 
            min, 
            max, 
            color, 
            label,
            range: generateRangeString(min, max) 
        });
    };

    // Handle max change
    const handleMaxChange = (value) => {
        setMax(value);
    };

    const handleMaxBlur = () => {
        onChange(index, { 
            min, 
            max, 
            color, 
            label,
            range: generateRangeString(min, max) 
        });
    };

    // Handle color change
    const handleColorChange = (value) => {
        setColor(value);
        onChange(index, { 
            min, 
            max, 
            color: value, 
            label,
            range: generateRangeString(min, max) 
        });
    };

    // Handle label change
    const handleLabelBlur = () => {
        onChange(index, { 
            min, 
            max, 
            color, 
            label,
            range: generateRangeString(min, max) 
        });
    };

    return (
        <div className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-700/50 rounded-lg">
            {/* Min */}
            <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Min</label>
                <Input
                    className="text-white bg-slate-800 border-slate-600"
                    type="number"
                    value={min}
                    onChange={e => handleMinChange(e.target.valueAsNumber || 0)}
                    onBlur={handleMinBlur}
                />
            </div>

            {/* Max */}
            <div className="col-span-2">
                <label className="text-xs text-gray-400 block mb-1">Max</label>
                <Input
                    className="text-white bg-slate-800 border-slate-600"
                    type="number"
                    value={max}
                    onChange={e => handleMaxChange(e.target.valueAsNumber || 0)}
                    onBlur={handleMaxBlur}
                />
            </div>

            {/* Color */}
            <div className="col-span-3">
                <label className="text-xs text-gray-400 block mb-1">Color</label>
                <div className="flex items-center gap-2">
                    <Input
                        type="color"
                        value={color}
                        onChange={e => handleColorChange(e.target.value)}
                        className="w-10 h-9 p-1 cursor-pointer rounded"
                    />
                    <Input
                        className="text-white bg-slate-800 border-slate-600 flex-1 text-xs"
                        placeholder="#00ff00"
                        value={color}
                        onChange={e => setColor(e.target.value)}
                        onBlur={e => handleColorChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Label */}
            <div className="col-span-3">
                <label className="text-xs text-gray-400 block mb-1">Label</label>
                <Input
                    className="text-white bg-slate-800 border-slate-600"
                    placeholder="e.g., Good, Poor"
                    value={label}
                    onChange={e => setLabel(e.target.value)}
                    onBlur={handleLabelBlur}
                />
            </div>

            {/* Range Preview & Delete */}
            <div className="col-span-2 flex items-end gap-2">
                <div className="flex-1">
                    <label className="text-xs text-gray-400 block mb-1">Range</label>
                    <div 
                        className="text-xs px-2 py-2 rounded text-center font-medium"
                        style={{ backgroundColor: color + '40', color: color }}
                    >
                        {generateRangeString(min, max) || 'N/A'}
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(index)}
                    className="h-9 w-9 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
});

ThresholdRow.displayName = 'ThresholdRow';

const ThresholdForm = memo(({ paramKey, paramName, initialData, onUpdate, onClose }) => {
    const [localData, setLocalData] = useState([]);

    // Initialize with normalized data
    useEffect(() => {
        const normalized = (initialData || []).map(normalizeRow);
        setLocalData(normalized);
    }, [initialData]);

    // Handle full row update
    const handleChange = useCallback((index, updatedRow) => {
        setLocalData(prev => {
            const updated = [...prev];
            updated[index] = normalizeRow(updatedRow);
            return updated;
        });
    }, []);

    const addRow = useCallback(() => {
        setLocalData(prev => [...prev, { ...DEFAULT_ROW, range: '0 to 0' }]);
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

    // Sort by min value
    const sortByMin = useCallback(() => {
        setLocalData(prev => {
            const sorted = [...prev].sort((a, b) => a.min - b.min);
            return sorted;
        });
    }, []);

    return (
        <div className="mt-4 p-4 border border-slate-600 rounded-lg bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">{paramName}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        {localData.length} threshold range(s) configured
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={sortByMin}
                        className="text-gray-400 hover:text-white"
                        title="Sort by Min value"
                    >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Sort
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Rows */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
                {localData.map((row, index) => (
                    <ThresholdRow
                        key={`${paramKey}-${index}`}
                        row={row}
                        index={index}
                        paramKey={paramKey}
                        onChange={handleChange}
                        onDelete={deleteRow}
                    />
                ))}
            </div>

            {localData.length === 0 && (
                <div className="text-center py-8 text-gray-400 border-2 border-dashed border-slate-600 rounded-lg">
                    <p>No thresholds configured</p>
                    <p className="text-xs mt-1">Click "Add Row" to create a threshold range</p>
                </div>
            )}

            <div className="flex gap-2 mt-4">
                <Button onClick={addRow} variant="outline" className="flex-1">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Row
                </Button>
            </div>

            {/* Preview */}
            {localData.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-600">
                    <p className="text-xs text-gray-400 mb-2">Preview:</p>
                    <div className="flex flex-wrap gap-1">
                        {localData.map((row, index) => (
                            <div
                                key={index}
                                className="px-2 py-1 rounded text-xs font-medium"
                                style={{ 
                                    backgroundColor: row.color + '30', 
                                    color: row.color,
                                    border: `1px solid ${row.color}`
                                }}
                            >
                                {row.label || row.range || `${row.min} to ${row.max}`}
                            </div>
                        ))}
                    </div>
                </div>
            )}
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
        <div className="mt-4 p-4 border border-slate-600 rounded-lg bg-slate-800">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="text-lg font-semibold text-white">Coverage Hole</h3>
                    <p className="text-xs text-gray-400 mt-1">
                        RSRP threshold below which is considered a coverage hole
                    </p>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex items-center gap-3">
                <Input
                    type="number"
                    value={localValue}
                    onChange={e => setLocalValue(Number(e.target.value) || 0)}
                    onBlur={handleBlur}
                    className="w-32 text-white bg-slate-700 border-slate-600"
                />
                <span className="text-gray-400 text-sm">dBm</span>
                <div className="text-xs text-gray-500">
                    (Values below {localValue} dBm will be marked as coverage holes)
                </div>
            </div>
        </div>
    );
});

CoverageHoleForm.displayName = 'CoverageHoleForm';

// ✅ Parse backend data - ensure min/max are numbers
const parseThresholdData = (data) => {
    console.log('📥 Raw data from API:', data);
    
    const parsedData = { 
        id: data.id,
        userId: data.user_id || data.m_user_id,
    };

    Object.keys(PARAMETERS).forEach(key => {
        if (key === "coveragehole") {
            parsedData[key] = Number(data.coveragehole_json || data.coveragehole) || DEFAULT_COVERAGE_HOLE;
        } else {
            const jsonString = data[`${key}_json`] || data[key];
            let parsed = [];
            
            if (jsonString) {
                try {
                    if (typeof jsonString === 'object') {
                        parsed = Array.isArray(jsonString) ? jsonString : [jsonString];
                    } else {
                        parsed = JSON.parse(jsonString);
                    }
                } catch (e) {
                    console.warn(`Failed to parse ${key}:`, e);
                    parsed = [];
                }
            }
            
            // ✅ Normalize all rows - ensure min/max are proper numbers
            parsedData[key] = (Array.isArray(parsed) ? parsed : [parsed])
                .map(row => normalizeRow(row))
                .filter(row => row.min !== undefined && row.max !== undefined);
        }
    });

    console.log('✅ Parsed threshold data:', parsedData);
    return parsedData;
};

// ✅ Build payload - ensure clean data structure
const buildSavePayload = (thresholds, userId) => {
    const payload = { 
        id: thresholds.id,
        m_user_id: userId,
    };

    Object.keys(PARAMETERS).forEach(key => {
        if (key === "coveragehole") {
            payload.coveragehole_json = String(thresholds[key] ?? DEFAULT_COVERAGE_HOLE);
        } else {
            // ✅ Normalize all rows before saving
            const normalizedData = (thresholds[key] || []).map(row => ({
                min: Number(row.min) || 0,
                max: Number(row.max) || 0,
                color: row.color || '#00ff00',
                label: row.label || '',
                range: generateRangeString(Number(row.min) || 0, Number(row.max) || 0),
            }));
            
            payload[`${key}_json`] = JSON.stringify(normalizedData);
        }
    });

    console.log('📤 Save payload:', payload);
    return payload;
};

// Main Page
const SettingsPage = () => {
    const { user } = useAuth();
    const [thresholds, setThresholds] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeParam, setActiveParam] = useState(null);

    // Fetch thresholds
    useEffect(() => {
        let mounted = true;

        const fetchData = async () => {
            try {
                console.log('🔄 Fetching threshold settings...');
                
                const response = await settingApi.getThresholdSettings();
                console.log('📥 API Response:', response);
                
                if (mounted) {
                    if (response?.Status === 1 && response.Data) {
                        const parsed = parseThresholdData(response.Data);
                        setThresholds(parsed);
                    } else {
                        toast.error("Failed to load settings");
                    }
                    setLoading(false);
                }
            } catch (error) {
                console.error('❌ Fetch error:', error);
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
            const payload = buildSavePayload(thresholds, user?.id);
            console.log('💾 Saving...');
            
            const response = await settingApi.saveThreshold(payload);
            console.log('📥 Save response:', response);
            
            if (response?.Status === 1) {
                toast.success("Settings saved successfully!");
                
                // Refetch to confirm
                const refetchResponse = await settingApi.getThresholdSettings();
                if (refetchResponse?.Status === 1 && refetchResponse.Data) {
                    const refetched = parseThresholdData(refetchResponse.Data);
                    setThresholds(refetched);
                }
            } else {
                toast.error(response?.Message || "Save failed");
            }
        } catch (error) {
            console.error('❌ Save error:', error);
            toast.error(`Error: ${error.message}`);
        } finally {
            setSaving(false);
        }
    }, [thresholds, user?.id]);

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
                <div className="text-center">
                    <p className="text-xl mb-4">Failed to load settings</p>
                    <Button onClick={() => window.location.reload()}>Retry</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gray-800 text-white h-full w-full p-4 overflow-auto">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold">Settings</h1>
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {saving ? (
                            <>
                                <Spinner className="h-4 w-4 mr-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4 mr-2" />
                                Save All
                            </>
                        )}
                    </Button>
                </div>

                <Card className="bg-slate-900 border-slate-700">
                    <CardHeader>
                        <CardTitle className="text-white">Threshold Configuration</CardTitle>
                        <CardDescription className="text-gray-400">
                            Configure min/max value ranges and colors for map visualization
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {/* Parameter Buttons */}
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(PARAMETERS).map(([key, name]) => {
                                const count = key !== "coveragehole" ? (thresholds[key]?.length || 0) : null;
                                const isActive = activeParam === key;
                                
                                return (
                                    <Button
                                        key={key}
                                        variant={isActive ? "default" : "outline"}
                                        onClick={() => setActiveParam(prev => prev === key ? null : key)}
                                        className={`${isActive ? "bg-blue-600 hover:bg-blue-700" : "border-slate-600 hover:bg-slate-700"}`}
                                    >
                                        {name}
                                        {count !== null && count > 0 && (
                                            <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-500 rounded-full">
                                                {count}
                                            </span>
                                        )}
                                    </Button>
                                );
                            })}
                        </div>

                        {/* Active Form */}
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

                        {/* Quick Summary */}
                        {!activeParam && (
                            <div className="mt-6 p-4 bg-slate-800 rounded-lg border border-slate-700">
                                <h4 className="text-sm font-semibold text-gray-300 mb-3">Current Configuration Summary</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {Object.entries(PARAMETERS).map(([key, name]) => {
                                        if (key === "coveragehole") {
                                            return (
                                                <div key={key} className="p-3 bg-slate-700/50 rounded">
                                                    <div className="text-xs text-gray-400">{name}</div>
                                                    <div className="text-lg font-bold text-white">
                                                        {thresholds.coveragehole} dBm
                                                    </div>
                                                </div>
                                            );
                                        }
                                        
                                        const data = thresholds[key] || [];
                                        return (
                                            <div key={key} className="p-3 bg-slate-700/50 rounded">
                                                <div className="text-xs text-gray-400">{name}</div>
                                                <div className="text-lg font-bold text-white">
                                                    {data.length} ranges
                                                </div>
                                                {data.length > 0 && (
                                                    <div className="flex gap-1 mt-2">
                                                        {data.slice(0, 4).map((row, i) => (
                                                            <div
                                                                key={i}
                                                                className="w-4 h-4 rounded"
                                                                style={{ backgroundColor: row.color }}
                                                                title={`${row.min} to ${row.max}`}
                                                            />
                                                        ))}
                                                        {data.length > 4 && (
                                                            <span className="text-xs text-gray-400">+{data.length - 4}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </CardContent>

                    <CardFooter className="justify-between border-t border-slate-700 pt-4">
                        <div className="text-xs text-gray-500">
                            User: {user?.name} (ID: {user?.id}) | Threshold ID: {thresholds?.id}
                        </div>
                        <Button 
                            onClick={handleSave} 
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {saving ? (
                                <>
                                    <Spinner className="h-4 w-4 mr-2" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Settings
                                </>
                            )}
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

export default SettingsPage;