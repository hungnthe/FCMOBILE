import React, { useState } from 'react';
import { UploadCloud, FileSpreadsheet, Download, CheckCircle2, AlertCircle, Sparkles, FileText } from 'lucide-react';
import { importExcelPlayers, downloadExcelTemplateUrl } from '../services/api';
import confetti from 'canvas-confetti';

export default function ExcelImport({ onImportSuccess }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.csv')) {
      setFile(selectedFile);
      setStatusMsg(null);
    } else {
      setStatusMsg({ type: 'error', text: 'Please upload a valid Excel (.xlsx) or CSV file.' });
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStatusMsg(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const result = await importExcelPlayers(formData);
      
      setStatusMsg({
        type: 'success',
        text: result.message || 'Excel dataset imported successfully!'
      });

      confetti({
        particleCount: 90,
        spread: 70,
        origin: { y: 0.6 }
      });

      setFile(null);
      if (onImportSuccess) onImportSuccess();
    } catch (err) {
      console.error(err);
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to parse and import Excel file.'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans text-slate-800 animate-fadeIn pb-8">
      
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-red-50 text-red-600">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h1 className="font-display font-black text-3xl text-red-600 uppercase tracking-tight">
              IMPORT EXCEL DATASET
            </h1>
            <p className="text-slate-500 text-sm">
              Batch import multiple football player cards into your database effortlessly.
            </p>
          </div>
        </div>
      </div>

      {/* Main Upload Card */}
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        
        {statusMsg && (
          <div className={`p-4 rounded-2xl border flex items-center gap-3 text-sm font-bold ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            {statusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 flex-shrink-0" /> : <AlertCircle className="w-5 h-5 flex-shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Drop Zone Box */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleFileDrop}
          className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 ${
            isDragging
              ? 'border-red-500 bg-red-50'
              : file
              ? 'border-emerald-500 bg-emerald-50'
              : 'border-slate-300 bg-slate-50 hover:border-red-400 hover:bg-slate-100'
          }`}
        >
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            onChange={handleFileSelect}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />

          <div className="space-y-3 flex flex-col items-center">
            <div className={`p-4 rounded-full ${file ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {file ? <FileText className="w-10 h-10" /> : <UploadCloud className="w-10 h-10" />}
            </div>

            <div>
              {file ? (
                <div>
                  <p className="font-bold text-lg text-emerald-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB • File ready</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-base text-slate-800">
                    Drag & Drop your Excel file here, or <span className="text-red-600 underline">Browse</span>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">Supports file formats .xlsx, .xls, .csv</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
          
          <a
            href={downloadExcelTemplateUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
          >
            <Download className="w-4 h-4" />
            <span>Download Sample Excel Template</span>
          </a>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className={`flex items-center gap-2 px-8 py-3 rounded-xl font-extrabold text-sm transition ${
              file && !loading
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-md'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>{loading ? 'Processing...' : 'Upload & Import Dataset'}</span>
          </button>

        </div>

      </div>

    </div>
  );
}
