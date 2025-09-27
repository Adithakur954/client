import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Filter, X } from 'lucide-react';

const AdvancedFilters = ({ filters, onFilterChange, onApplyFilters, onClearFilters }) => {
  const technologyOptions = ['ALL', '2G', '3G', '4G', '5G', 'LTE', 'NR'];
  const metricOptions = ['RSRP', 'RSRQ', 'SINR', 'RSSI', 'THROUGHPUT_DL', 'THROUGHPUT_UL'];
  const bandOptions = ['700', '800', '900', '1800', '2100', '2600', '3500'];

  return (
    <Card className="w-80">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <Filter className="h-5 w-5 mr-2" />
            Advanced Filters
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Technology</Label>
          <Select value={filters.technology} onValueChange={(value) => onFilterChange('technology', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select technology" />
            </SelectTrigger>
            <SelectContent>
              {technologyOptions.map(tech => (
                <SelectItem key={tech} value={tech}>{tech}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Metric</Label>
          <Select value={filters.metric} onValueChange={(value) => onFilterChange('metric', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              {metricOptions.map(metric => (
                <SelectItem key={metric} value={metric}>{metric}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Frequency Band</Label>
          <Select value={filters.band} onValueChange={(value) => onFilterChange('band', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select band" />
            </SelectTrigger>
            <SelectContent>
              {bandOptions.map(band => (
                <SelectItem key={band} value={band}>{band} MHz</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Date Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <DatePicker
              date={filters.startDate}
              setDate={(date) => onFilterChange('startDate', date)}
              placeholder="Start date"
            />
            <DatePicker
              date={filters.endDate}
              setDate={(date) => onFilterChange('endDate', date)}
              placeholder="End date"
            />
          </div>
        </div>

        <div>
          <Label>Signal Strength Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min (dBm)"
              value={filters.minSignal}
              onChange={(e) => onFilterChange('minSignal', e.target.value)}
            />
            <Input
              type="number"
              placeholder="Max (dBm)"
              value={filters.maxSignal}
              onChange={(e) => onFilterChange('maxSignal', e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Data Source</Label>
          <Select value={filters.dataSource} onValueChange={(value) => onFilterChange('dataSource', value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="drive-test">Drive Test</SelectItem>
              <SelectItem value="crowdsource">Crowdsource</SelectItem>
              <SelectItem value="mr">Measurement Reports</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button className="w-full" onClick={onApplyFilters}>
          Apply Filters
        </Button>
      </CardContent>
    </Card>
  );
};

export default AdvancedFilters;