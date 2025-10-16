// src/pages/page.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useJsApiLoader } from '@react-google-maps/api';
import { toast } from 'react-toastify';

import MapWithMultipleCircles from '../components/MapwithMultipleCircle';
import Spinner from '../components/common/Spinner';
import { GOOGLE_MAPS_LOADER_OPTIONS } from '../lib/googleMapsLoader';
import { mapViewApi, settingApi } from '../api/apiEndpoints';

const METRICS = [
  { value: 'rsrp', label: 'RSRP' },
  { value: 'rsrq', label: 'RSRQ' },
  { value: 'sinr', label: 'SINR' },
  { value: 'dl-throughput', label: 'DL Throughput' },
  { value: 'ul-throughput', label: 'UL Throughput' },
  { value: 'mos', label: 'MOS' },
  { value: 'lte-bler', label: 'LTE BLER' },
];

const defaultThresholds = {
  rsrp: [],
  rsrq: [],
  sinr: [],
  dl_thpt: [],
  ul_thpt: [],
  mos: [],
  lte_bler: [],
};

const canonicalOperatorName = (raw) => {
  if (!raw && raw !== 0) return 'Unknown';
  let s = String(raw).trim();
  s = s.replace(/^IND[-\s]*/i, '');
  const lower = s.toLowerCase();
  if (lower === '//////' || lower === '404011') return 'Unknown';
  if (lower.includes('jio')) return 'JIO';
  if (lower.includes('airtel')) return 'Airtel';
  if (lower.includes('vodafone') || lower.startsWith('vi')) return 'Vi (Vodafone Idea)';
  return s;
};

const METRIC_KEY_BY_SELECT = {
  rsrp: 'rsrp',
  rsrq: 'rsrq',
  sinr: 'sinr',
  'dl-throughput': 'dl_thpt',
  'ul-throughput': 'ul_thpt',
  mos: 'mos',
  'lte-bler': 'lte_bler',
};

const normalizeMetricKey = (selectedMetric) =>
  METRIC_KEY_BY_SELECT[selectedMetric] || selectedMetric;

// ------------------------------------------------------
// coverage-hole predicate (works for both modes)
// ------------------------------------------------------
function makeCoverageHolePredicate(metricKey, thresholds, predictionMode, predictionData) {
  if (predictionMode && predictionData?.colorSetting?.length) {
    // Pick the "worst" bucket of the prediction coloring
    const lowerIsWorse = ['rsrp', 'rsrq', 'sinr', 'dl_thpt', 'ul_thpt', 'mos'].includes(metricKey);
    const arr = predictionData.colorSetting;
    if (!arr.length) return () => false;

    let bucket;
    if (lowerIsWorse) {
      bucket = [...arr].sort((a, b) => a.min - b.min)[0];
    } else {
      bucket = [...arr].sort((a, b) => b.max - a.max)[0];
    }

    const min = Number(bucket.min ?? Number.NEGATIVE_INFINITY);
    const max = Number(bucket.max ?? Number.POSITIVE_INFINITY);
    return (valRaw) => {
      const v = Number(valRaw);
      return Number.isFinite(v) && v >= min && v <= max;
    };
  }

  // otherwise use thresholds
  const lowerIsWorse = ['rsrp', 'rsrq', 'sinr', 'dl_thpt', 'ul_thpt', 'mos'].includes(metricKey);
  const arr = thresholds?.[metricKey] || [];
  const labStr = (x) => String(x ?? '').toLowerCase();

  let bucket = arr.find(x => {
    const label = labStr(x.label || x.name || x.title);
    return label.includes('hole') || label.includes('no coverage');
  });

  if (!bucket && arr.length) {
    if (lowerIsWorse) {
      bucket = [...arr].sort((a, b) =>
        (a.max ?? a.min ?? Infinity) - (b.max ?? b.min ?? Infinity)
      )[0];
    } else {
      bucket = [...arr].sort((a, b) =>
        (b.min ?? b.max ?? -Infinity) - (a.min ?? a.max ?? -Infinity)
      )[0];
    }
  }

  if (bucket) {
    const min = Number(bucket.min ?? Number.NEGATIVE_INFINITY);
    const max = Number(bucket.max ?? Number.POSITIVE_INFINITY);
    return (valRaw) => {
      const v = Number(valRaw);
      return Number.isFinite(v) && v >= min && v <= max;
    };
  }
  return () => false;
}

// ------------------------------------------------------
// component
// ------------------------------------------------------
export default function MapView() {
  const [rawLocations, setRawLocations] = useState([]);
  const [thresholds, setThresholds] = useState(defaultThresholds);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeMarker, setActiveMarker] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('rsrp');
  const [colorMode, setColorMode] = useState('thresholds');

  const [searchParams] = useSearchParams();
  const sessionIds = useMemo(() => {
    const sessionParam = searchParams.get('session');
    return sessionParam ? sessionParam.split(',').filter(id => id) : [];
  }, [searchParams]);

  const projectId = useMemo(() => searchParams.get('project_id'), [searchParams]);
  const [isPredictionMode, setIsPredictionMode] = useState(false);
  const [predictionData, setPredictionData] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);

  const { isLoaded, loadError } = useJsApiLoader(GOOGLE_MAPS_LOADER_OPTIONS);

  const [filters, setFilters] = useState({
    operator: 'ALL',
    technology: 'ALL',
    band: 'ALL',
  });

  const [filterOptions, setFilterOptions] = useState({
    operators: [],
    technologies: [],
    bands: [],
  });

  const [showCoverageHolesOnly, setShowCoverageHolesOnly] = useState(false);

  useEffect(() => {
    console.log('Project ID from URL:', projectId);
  }, [projectId]);

  // prediction fetch
  useEffect(() => {
    if (!isPredictionMode || !projectId) {
      setPredictionData(null);
      return;
    }

    const fetchPredictions = async () => {
      setPredictionLoading(true);
      try {
        const params = {
          projectId,
          metric: selectedMetric.toUpperCase(),
          pointsInsideBuilding: 0,
          token: '',
        };
        const response = await mapViewApi.getPredictionLog(params);
        if (response.Status === 1 && response.Data) {
          setPredictionData(response.Data);
          toast.success(`Loaded ${response.Data.dataList.length} prediction points.`);
        } else {
          toast.error(response.Message || 'Failed to fetch predictions.');
          setPredictionData(null);
        }
      } catch (err) {
        toast.error(`Error fetching prediction data: ${err.message}`);
        setPredictionData(null);
      } finally {
        setPredictionLoading(false);
      }
    };

    fetchPredictions();
  }, [isPredictionMode, projectId, selectedMetric]);

  // thresholds and filter options
  useEffect(() => {
    const run = async () => {
      try {
        const [thresholdRes, providersRes, techRes, bandsRes] = await Promise.all([
          settingApi.getThresholdSettings(),
          mapViewApi.getProviders(),
          mapViewApi.getTechnologies(),
          mapViewApi.getBands(),
        ]);

        const d = thresholdRes?.Data;
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

        const rawOperators = providersRes || [];
        const normalizedOperatorSet = new Set(rawOperators.map(op => canonicalOperatorName(op.name)));
        const normalizedOperators = Array.from(normalizedOperatorSet).map(name => ({ id: name, name }));

        setFilterOptions({
          operators: normalizedOperators,
          technologies: techRes || [],
          bands: bandsRes || [],
        });
      } catch (e) {
        toast.error('Failed to load map settings.');
      }
    };
    run();
  }, []);

  // session logs
  useEffect(() => {
    if (sessionIds.length === 0) {
      setLoading(false);
      if (!projectId) {
        setError('No session ID provided in URL.');
      }
      return;
    }

    const fetchAllSessionLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const promises = sessionIds.map(sessionId =>
          mapViewApi.getNetworkLog({ session_id: sessionId }, { limit: 10000 })
        );
        const results = await Promise.all(promises);
        const allLogs = results.flatMap(resp => resp?.Data ?? resp?.data ?? resp ?? []);
        if (allLogs.length === 0) {
          toast.warn('No location data found for the selected sessions.');
          setRawLocations([]);
        } else {
          const formatted = allLogs
            .map((log) => {
              const lat = parseFloat(log.lat ?? log.Lat ?? log.latitude ?? log.Latitude);
              const lng = parseFloat(
                log.lon ?? log.lng ?? log.Lng ?? log.longitude ?? log.Longitude
              );
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
              return {
                lat, lng, radius: 18,
                timestamp: log.timestamp ?? log.time ?? log.created_at ?? log.createdAt,
                rsrp: log.rsrp ?? log.RSRP ?? log.rsrp_dbm,
                rsrq: log.rsrq ?? log.RSRQ,
                sinr: log.sinr ?? log.SINR,
                dl_thpt: log.dl_thpt ?? log.dl_tpt ?? log.DL ?? log.download ?? log.download_throughput,
                ul_thpt: log.ul_thpt ?? log.ul_tpt ?? log.UL ?? log.upload ?? log.upload_throughput,
                mos: log.mos ?? log.MOS,
                lte_bler: log.lte_bler ?? log.LTE_BLER ?? log.bler,
                operator: canonicalOperatorName(log.operator_name),
                technology: log.technology,
                band: log.band,
              };
            })
            .filter(Boolean);
          setRawLocations(formatted);
        }
      } catch (err) {
        toast.error(`Failed to fetch session data: ${err.message || 'Unknown error'}`);
        setError(`Failed to load data for session IDs: ${sessionIds.join(', ')}`);
      } finally {
        setLoading(false);
      }
    };
    fetchAllSessionLogs();
  }, [sessionIds, projectId]);

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  // ------------------------------------------------------
  // build locations
  // ------------------------------------------------------
  const locationsForMap = useMemo(() => {
    let filteredLocations = [];

    if (isPredictionMode) {
      if (!predictionData?.dataList) return [];
      filteredLocations = predictionData.dataList.map(point => {
        const setting = predictionData.colorSetting?.find(c => point.prm >= c.min && point.prm <= c.max);
        return {
          lat: point.lat,
          lng: point.lon,
          radius: 15,
          color: setting ? setting.color : '#808080',
          [selectedMetric]: point.prm,
        };
      });
    } else {
      filteredLocations = rawLocations;
      if (filters.operator !== 'ALL') filteredLocations = filteredLocations.filter(loc => loc.operator === filters.operator);
      if (filters.technology !== 'ALL') filteredLocations = filteredLocations.filter(loc => loc.technology === filters.technology);
      if (filters.band !== 'ALL') filteredLocations = filteredLocations.filter(loc => loc.band === filters.band);
    }

    if (showCoverageHolesOnly) {
      const metricKey = normalizeMetricKey(selectedMetric);
      const isHole = makeCoverageHolePredicate(metricKey, thresholds, isPredictionMode, predictionData);
      filteredLocations = filteredLocations.filter(loc => isHole(loc[metricKey]));
    }

    if (colorMode === 'path' && !isPredictionMode) {
      return filteredLocations.map((loc, index, arr) => {
        let color = '#007BFF';
        if (index === 0) color = '#28a745';
        if (index === arr.length - 1) color = '#dc3545';
        return { ...loc, color };
      });
    }
    return filteredLocations;
  }, [
    isPredictionMode,
    predictionData,
    rawLocations,
    colorMode,
    filters,
    selectedMetric,
    showCoverageHolesOnly,
    thresholds,
  ]);

  if (error) {
    return <div className="flex items-center justify-center h-screen text-red-500">{error}</div>;
  }

  // ------------------------------------------------------
  // render
  // ------------------------------------------------------
  return (
    <div className="p-6 h-screen flex flex-col gap-4 bg-gray-50">
      <div className="flex justify-between items-start gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            {isPredictionMode ? `Prediction View for Project ${projectId}` : 'Drive Session Map View'}
          </h1>
          <p className="text-sm text-gray-500">
            {isPredictionMode ? 'Showing predicted signal values' : `Session ID(s): ${sessionIds.join(', ') || 'None'}`}
          </p>
        </div>
        <Link to="/drive-test-sessions" className="text-blue-500 hover:underline flex-shrink-0">
          ← Back to Sessions
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Metric</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
          >
            {METRICS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Operator</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.operator}
            onChange={(e) => handleFilterChange('operator', e.target.value)}
            disabled={isPredictionMode}
          >
            <option value="ALL">All</option>
            {filterOptions.operators.map(op => (
              <option key={op.id} value={op.name}>{op.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Technology</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.technology}
            onChange={(e) => handleFilterChange('technology', e.target.value)}
            disabled={isPredictionMode}
          >
            <option value="ALL">All</option>
            {filterOptions.technologies.map(tech => (
              <option key={tech.id} value={tech.name}>{tech.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Band</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={filters.band}
            onChange={(e) => handleFilterChange('band', e.target.value)}
            disabled={isPredictionMode}
          >
            <option value="ALL">All</option>
            {filterOptions.bands.map(band => (
              <option key={band.id} value={band.name}>{band.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">Color Mode</label>
          <div className="inline-flex rounded-md shadow-sm" role="group">
            <button
              type="button"
              onClick={() => setColorMode('thresholds')}
              className={`px-3 py-1 text-sm border rounded-l-md ${colorMode === 'thresholds' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              title="Color by metric thresholds"
            >
              Thresholds
            </button>
            <button
              type="button"
              onClick={() => setColorMode('path')}
              className={`px-3 py-1 text-sm border ${colorMode === 'path' ? 'bg-blue-600 text-white' : 'bg-white'}`}
              title="Show path from start (green) to end (red)"
            >
              Path
            </button>
            {projectId && (
              <button
                type="button"
                onClick={() => setIsPredictionMode(p => !p)}
                className={`px-3 py-1 text-sm border rounded-r-md ${isPredictionMode ? 'bg-green-600 text-white' : 'bg-white'}`}
                title="Toggle prediction data view for this project"
              >
                Predictions
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="holesOnly"
            type="checkbox"
            className="h-4 w-4"
            checked={showCoverageHolesOnly}
            onChange={(e) => setShowCoverageHolesOnly(e.target.checked)}
            title="Show only points that fall into the coverage hole bucket"
          />
          <label htmlFor="holesOnly" className="text-sm font-medium">
            Coverage holes only
          </label>
        </div>
      </div>

      <div className="flex-grow rounded-lg border shadow-sm overflow-hidden relative">
        {(loading || predictionLoading) && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
            <Spinner />
          </div>
        )}
        <MapWithMultipleCircles
          isLoaded={isLoaded}
          loadError={loadError}
          locations={locationsForMap}
          thresholds={thresholds}
          selectedMetric={selectedMetric}
          activeMarkerIndex={activeMarker}
          onMarkerClick={setActiveMarker}
        />
        {locationsForMap.length === 0 && !loading && !predictionLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 pointer-events-none">
            <p className="text-lg font-semibold text-gray-700">No data to display for the current selection.</p>
          </div>
        )}
      </div>
    </div>
  );
}