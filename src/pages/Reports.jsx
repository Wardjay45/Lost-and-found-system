import { useState } from 'react';

export default function Reports() {
  const [reportType, setReportType] = useState('monthly');

  const handleExport = (format) => {
    alert(`Exporting ${reportType} report as ${format.toUpperCase()}... (Mock functionality)`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Report Generation</h1>
          <p className="text-gray-500 mt-1">Generate and export reports for your records</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Type Selection */}
        <div className="lg:col-span-1 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Report Type</h3>
          <div className="space-y-3">
            {[
              { id: 'monthly', label: 'Monthly Summary', desc: 'Overview of all activity for a month' },
              { id: 'hotspot', label: 'Hotspot Analysis', desc: 'Lost/found patterns by location' },
              { id: 'performance', label: 'Performance Metrics', desc: 'System efficiency & accuracy stats' },
              { id: 'matched', label: 'Matched Pairs Data', desc: 'Details of all confirmed matches' },
              { id: 'audit', label: 'Audit Log', desc: 'Complete system activity log' },
            ].map(r => (
              <button
                key={r.id}
                onClick={() => setReportType(r.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${reportType === r.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="text-sm font-medium text-gray-900">{r.label}</p>
                <p className="text-xs text-gray-500">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Preview & Export */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Export Options</h3>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => handleExport('pdf')} className="p-6 bg-red-50 rounded-xl border border-red-100 hover:bg-red-100 transition-colors">
                <div className="text-3xl mb-2">📄</div>
                <p className="font-medium text-gray-900">Export as PDF</p>
                <p className="text-xs text-gray-500 mt-1">Printable document format</p>
              </button>
              <button onClick={() => handleExport('csv')} className="p-6 bg-green-50 rounded-xl border border-green-100 hover:bg-green-100 transition-colors">
                <div className="text-3xl mb-2">📊</div>
                <p className="font-medium text-gray-900">Export as CSV</p>
                <p className="text-xs text-gray-500 mt-1">Spreadsheet compatible</p>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Report Preview</h3>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className="text-gray-500">Preview will show here when report is generated</p>
              <p className="text-xs text-gray-400 mt-1">Selected: {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Date Range</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm text-gray-600 mb-1">From</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-sm text-gray-600 mb-1">To</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
              </div>
              <div className="flex items-end">
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Generate Preview</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}