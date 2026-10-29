import { showToast } from '../components/common/Toast';
import AppIcon from '../components/common/AppIcon';
import { PageHeader } from '../components/common/UI';
import { useState } from 'react';

export default function Reports() {
  const [reportType, setReportType] = useState('monthly');

  const handleExport = (format) => {
    showToast(`The ${reportType} ${format.toUpperCase()} export is a sample action.`, 'info', 'Sample report');
  };

  return (
    <div className="page page-reports">
      <PageHeader title="Reports" description={"Generate and export reports for your records."} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Type Selection */}
        <div className="ui-panel lg:col-span-1 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Report Type</h3>
          <div className="space-y-3">
            {[
              { id: 'monthly', label: 'Monthly Summary', desc: 'Overview of all activity for a month' },
              { id: 'hotspot', label: 'Hotspot Analysis', desc: 'Lost/found patterns by location' },
              { id: 'performance', label: 'Performance Metrics', desc: 'System efficiency & accuracy stats' },
              { id: 'matched', label: 'Matched Pairs Data', desc: 'Details of all confirmed matches' },
              { id: 'audit', label: 'Audit Log', desc: 'Complete system activity log' },
            ].map(r => (
              <button type="button"
                key={r.id}
                onClick={() => setReportType(r.id)}
                className={`ui-button w-full text-left p-3 rounded-lg border transition-colors ${reportType === r.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <p className="text-sm font-medium text-gray-900">{r.label}</p>
                <p className="text-xs text-gray-500">{r.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Preview & Export */}
        <div className="lg:col-span-2 space-y-6">
          <div className="ui-panel p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Export Options</h3>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => handleExport('pdf')} className="ui-button ui-button-danger transition-colors">
                <div className="text-3xl mb-2"><AppIcon name="document" /></div>
                <p className="font-medium text-gray-900">Export as PDF</p>
                <p className="text-xs text-gray-500 mt-1">Printable document format</p>
              </button>
              <button type="button" onClick={() => handleExport('csv')} className="ui-button ui-button-success transition-colors">
                <div className="text-3xl mb-2"><AppIcon name="info" /></div>
                <p className="font-medium text-gray-900">Export as CSV</p>
                <p className="text-xs text-gray-500 mt-1">Spreadsheet compatible</p>
              </button>
            </div>
          </div>

          <div className="ui-panel p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Report Preview</h3>
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-4xl mb-3"><AppIcon name="info" /></p>
              <p className="text-gray-500">Preview will show here when report is generated</p>
              <p className="text-xs text-gray-400 mt-1">Selected: {reportType.charAt(0).toUpperCase() + reportType.slice(1)} Report</p>
            </div>
          </div>

          <div className="ui-panel p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Date Range</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[150px]">
                <label htmlFor="field-reports-1" className="block text-sm text-gray-600 mb-1">From</label>
                <input id="field-reports-1" aria-label="From" type="date" className="ui-input w-full" />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label htmlFor="field-reports-2" className="block text-sm text-gray-600 mb-1">To</label>
                <input id="field-reports-2" aria-label="To" type="date" className="ui-input w-full" />
              </div>
              <div className="flex items-end">
                <button type="button" className="ui-button ui-button-primary">Generate Preview</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}