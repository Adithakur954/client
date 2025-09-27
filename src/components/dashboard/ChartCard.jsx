import React, { useState, useRef, useCallback } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { BsThreeDotsVertical } from 'react-icons/bs';
import { toPng } from 'html-to-image';

// --- Helper function to download CSV ---
const downloadCSV = (data, title) => {
  const headers = Object.keys(data[0]);
  const csvContent = "data:text/csv;charset=utf-8,"
    + [headers.join(','), ...data.map(row => headers.map(header => row[header]).join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${title.replace(/ /g, '_')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// --- Main ChartCard Component ---
const ChartCard = ({ title, chartType, data, dataKey, valueKey }) => {
  const chartRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDownloadImage = useCallback(() => {
    if (chartRef.current === null) return;
    toPng(chartRef.current, { cacheBust: true })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `${title.replace(/ /g, '_')}.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => console.error(err));
  }, [chartRef, title]);

  const renderChart = () => {
    if (chartType === 'bar') {
      return (
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={dataKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey={valueKey} fill="#3B82F6" />
        </BarChart>
      );
    }
    if (chartType === 'pie') {
        const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];
      return (
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={dataKey} cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
             {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      );
    }
    return null;
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">{title}</h3>
        <div className="relative">
          <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 rounded-full hover:bg-gray-100">
            <BsThreeDotsVertical />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10">
              <a onClick={handleDownloadImage} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Download as Image</a>
              <a onClick={() => downloadCSV(data, title)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">Download as CSV</a>
              {/* Add other options here */}
            </div>
          )}
        </div>
      </div>
      <div ref={chartRef} className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartCard;