import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Clock,
  Download,
  FileSpreadsheet,
  History,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { supabase } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import {
  ConfidenceLevel,
  DataUploadV2Props,
  DuplicateRow,
  ProcessingMetrics,
  RowError,
  UploadHistoryEntry,
  V2AnalyzeHeadersResponse,
  V2ProcessResponse,
} from '../../types';

function insightsPayloadFromResponse(data: V2ProcessResponse) {
  if (!data.action_summary && !data.insights?.length && !data.customers?.length) return undefined;
  return {
    uploadId: data.upload_id,
    actionSummary: data.action_summary,
    insights: data.insights,
    customers: data.customers,
  };
}

// ── Wizard steps ─────────────────────────────────────────────────────────────

type Step =
  | 'upload'       // Drop zone + sample data button
  | 'sheet-select' // Excel multi-sheet: pick a sheet then re-analyze
  | 'mapping'      // Column mapping with confidence badges
  | 'preview'      // First 10 rows preview
  | 'uploading'    // Real upload progress (XHR)
  | 'processing'   // Stage indicators
  | 'errors'       // Row errors + downloadable CSV
  | 'success'      // Confirmation screen
  | 'history';     // Upload history page

const CRITICAL_FIELDS = ['order_id', 'order_date', 'total_price', 'line_items', 'customer_identifier'] as const;
const BLOCKING_FIELDS = new Set(['order_id', 'order_date', 'total_price']);
const FIELD_TRANSLATE: Record<string, string> = {
  order_id: 'order_id',
  order_date: 'order_date',
  total_price: 'total',
  line_items: 'product_name',
  customer_identifier: 'customer_id',
};

const ACCEPTED_EXTENSIONS = '.csv,.xlsx,.xls';
const MAX_FILE_MB = 50;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return {};
  return { Authorization: `Bearer ${session.access_token}` };
}

function fileSizeMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function daysAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff} days ago`;
}

function confidenceBadge(level: ConfidenceLevel) {
  const map: Record<ConfidenceLevel, { label: string; className: string }> = {
    high:   { label: 'Auto-detected', className: 'bg-green-100 text-green-700' },
    medium: { label: 'Best guess',    className: 'bg-yellow-100 text-yellow-700' },
    low:    { label: 'Uncertain',     className: 'bg-orange-100 text-orange-700' },
  };
  const { label, className } = map[level] ?? map.low;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${className}`}>
      {label}
    </span>
  );
}

function uploadWithProgress(
  url: string,
  formData: FormData,
  headers: Record<string, string>,
  onProgress: (pct: number) => void,
): Promise<V2ProcessResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { reject(new Error('Invalid JSON response')); }
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          resolve(body); // Let caller handle success: false
        } catch {
          reject(new Error(`HTTP ${xhr.status}`));
        }
      }
    };
    xhr.onerror = () => reject(new Error('Network error — check your connection.'));
    xhr.send(formData);
  });
}

function downloadErrorCsv(rowErrors: RowError[], duplicateRows: DuplicateRow[]) {
  const rows = [
    ['Row', 'Field', 'Value', 'Error', 'Severity'],
    ...rowErrors.map(e => [e.row, e.field, e.value, e.error, e.severity]),
    ...duplicateRows.map(d => [d.row, 'order_id', d.order_id, d.message, d.severity]),
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'upload-errors.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────

export const DataUploadV2: React.FC<DataUploadV2Props> = ({
  onProcessed,
  isSampleData,
  onClearSampleData,
}) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analyze, setAnalyze] = useState<V2AnalyzeHeadersResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [selectedSheet, setSelectedSheet] = useState<number>(0);
  const [uploadPct, setUploadPct] = useState(0);
  const [processStage, setProcessStage] = useState<string>('');
  const [result, setResult] = useState<V2ProcessResponse | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [history, setHistory] = useState<UploadHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadingSampleData, setLoadingSampleData] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Derived state ──────────────────────────────────────────────────────────

  const labels = analyze?.field_labels ?? {};
  const descriptions = analyze?.field_descriptions ?? {};
  const missingMessages = analyze?.field_missing_messages ?? {};
  const allBlockingMapped = CRITICAL_FIELDS
    .filter(f => BLOCKING_FIELDS.has(f))
    .every(f => !!mapping[f]);

  // ── History loading ────────────────────────────────────────────────────────

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch('/api/upload/v2/history', { headers: await authHeader() });
      const data = await res.json();
      setHistory(data.data ?? []);
    } catch {
      // non-fatal
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (step === 'history') loadHistory();
  }, [step, loadHistory]);

  // ── File selection → analyze headers ──────────────────────────────────────

  async function handleFileSelect(selected: File) {
    const ext = selected.name.split('.').pop()?.toLowerCase() ?? '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setUploadError(
        "That file type isn't supported. Please upload a CSV, XLSX or XLS file.\n" +
        'In Shopify: Orders → Export → Plain CSV for Excel.',
      );
      return;
    }
    if (selected.size > MAX_FILE_MB * 1024 * 1024) {
      setUploadError(
        `That file is over ${MAX_FILE_MB} MB. For larger uploads, contact us at support@strategiq.co and we'll help you import it.`,
      );
      return;
    }

    setFile(selected);
    setUploadError(null);
    setStep('processing');
    setProcessStage('Reading columns…');

    await analyzeFile(selected, 0);
  }

  async function analyzeFile(selected: File, sheetIdx: number) {
    try {
      const form = new FormData();
      form.append('file', selected);
      form.append('sheet_index', String(sheetIdx));

      const res = await fetch('/api/upload/v2/analyze-headers', {
        method: 'POST',
        headers: await authHeader(),
        body: form,
      });
      const data: V2AnalyzeHeadersResponse = await res.json();

      if (!data.success) {
        setUploadError(data.error ?? 'We had trouble reading that file.');
        setStep('upload');
        return;
      }

      setAnalyze(data);

      // Pre-fill mapping from auto-detected + saved + first fuzzy suggestion
      const initial: Record<string, string> = { ...data.auto_matched };
      if (data.saved_mapping) {
        // Apply saved mapping only where not already auto-detected
        for (const [field, csvCol] of Object.entries(data.saved_mapping)) {
          if (!initial[field] && data.all_columns.includes(csvCol)) {
            initial[field] = csvCol;
          }
        }
      }
      for (const [field, suggestions] of Object.entries(data.fuzzy_suggestions)) {
        if (!initial[field] && suggestions.length > 0) {
          initial[field] = suggestions[0];
        }
      }
      setMapping(initial);

      // Multi-sheet Excel: show sheet selection if more than one sheet
      if (data.sheet_names && data.sheet_names.length > 1 && sheetIdx === 0) {
        setStep('sheet-select');
      } else if (data.needs_mapping) {
        setStep('mapping');
      } else {
        setStep('preview');
      }
    } catch {
      setUploadError("Couldn't connect to the server. Check your connection and try again.");
      setStep('upload');
    }
  }

  // ── Upload + process ───────────────────────────────────────────────────────

  async function handleProcess() {
    if (!file) return;
    setStep('uploading');
    setUploadPct(0);
    setUploadError(null);

    const pipelineMapping: Record<string, string> = {};
    for (const [field, csvCol] of Object.entries(mapping)) {
      const pipelineKey = FIELD_TRANSLATE[field] ?? field;
      pipelineMapping[pipelineKey] = csvCol;
    }

    const form = new FormData();
    form.append('file', file);
    form.append('column_mapping', JSON.stringify(pipelineMapping));
    form.append('sheet_index', String(selectedSheet));

    try {
      const headers = await authHeader();
      const data = await uploadWithProgress(
        '/api/upload/v2/process',
        form,
        headers,
        (pct) => {
          setUploadPct(pct);
          if (pct === 100) {
            setStep('processing');
            setProcessStage('Validating data…');
          }
        },
      );

      if (data.success && data.metrics) {
        // Save column mapping for repeat uploads
        try {
          await fetch('/api/upload/v2/saved-mapping', {
            method: 'POST',
            headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
            body: JSON.stringify({ mapping }),
          });
        } catch { /* non-fatal */ }

        setResult(data);

        // If there are blocking errors, show errors step; otherwise success
        const hasErrors = (data.row_errors?.length ?? 0) > 0;
        const hasDuplicates = (data.duplicate_rows?.length ?? 0) > 0;
        if (hasErrors || hasDuplicates) {
          setStep('errors');
        } else {
          setStep('success');
          onProcessed(
            data.metrics,
            data.uploaded_at ?? new Date().toISOString(),
            false,
            insightsPayloadFromResponse(data),
          );
        }
      } else {
        setUploadError(data.error ?? 'Something went wrong while processing your file.');
        setStep('preview');
      }
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      setStep('preview');
    }
  }

  // ── Sample data ────────────────────────────────────────────────────────────

  async function handleLoadSample() {
    setLoadingSampleData(true);
    setUploadError(null);
    try {
      const res = await fetch('/api/upload/v2/sample-data', {
        method: 'POST',
        headers: await authHeader(),
      });
      const data: V2ProcessResponse = await res.json();
      if (data.success && data.metrics) {
        setResult(data);
        onProcessed(
          data.metrics,
          data.uploaded_at ?? new Date().toISOString(),
          true,
          insightsPayloadFromResponse(data),
        );
      } else {
        setUploadError(data.error ?? 'Could not load sample data.');
      }
    } catch {
      setUploadError('Could not load sample data — check your connection.');
    } finally {
      setLoadingSampleData(false);
    }
  }

  async function handleClearSample() {
    try {
      await fetch('/api/upload/v2/sample-data', {
        method: 'DELETE',
        headers: await authHeader(),
      });
    } catch { /* non-fatal */ }
    onClearSampleData();
  }

  // ── History actions ────────────────────────────────────────────────────────

  async function handleDeleteHistory(id: string) {
    try {
      await fetch(`/api/upload/v2/history/${id}`, {
        method: 'DELETE',
        headers: await authHeader(),
      });
      setHistory(h => h.filter(e => e.id !== id));
    } catch { /* non-fatal */ }
  }

  async function handleSetActive(id: string) {
    try {
      const res = await fetch(`/api/upload/v2/history/${id}/set-active`, {
        method: 'POST',
        headers: await authHeader(),
      });
      const data: V2ProcessResponse = await res.json();
      if (data.success && data.metrics) {
        setResult(data);
        onProcessed(
          data.metrics,
          data.uploaded_at ?? new Date().toISOString(),
          false,
          insightsPayloadFromResponse(data),
        );
        setStep('success');
      }
    } catch { /* non-fatal */ }
  }

  // ── Proceed after errors ───────────────────────────────────────────────────

  function handleProceedDespiteErrors() {
    if (result?.metrics) {
      onProcessed(
        result.metrics,
        result.uploaded_at ?? new Date().toISOString(),
        false,
        insightsPayloadFromResponse(result),
      );
      setStep('success');
    }
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function reset() {
    setStep('upload');
    setFile(null);
    setAnalyze(null);
    setMapping({});
    setSelectedSheet(0);
    setUploadPct(0);
    setProcessStage('');
    setResult(null);
    setUploadError(null);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RENDERS
  // ════════════════════════════════════════════════════════════════════════════

  // ── Sample data banner (shown everywhere when active) ──────────────────────

  const SampleBanner = isSampleData ? (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800 mb-4">
      <Zap className="w-4 h-4 shrink-0 text-amber-500" />
      <span className="flex-1">
        <strong>Viewing sample data</strong> — these are example insights from a demo store.
        Upload your own orders to see real insights.
      </span>
      <button
        onClick={handleClearSample}
        className="text-amber-600 hover:text-amber-800 font-medium text-xs underline shrink-0"
      >
        Remove sample
      </button>
    </div>
  ) : null;

  // ── Step: upload ──────────────────────────────────────────────────────────

  if (step === 'upload') {
    return (
      <div className="max-w-xl mx-auto p-6">
        {SampleBanner}

        <div className="flex items-center justify-between mb-1">
          <h2 className="text-2xl font-semibold text-slate-900">Upload your Shopify orders</h2>
          <button
            onClick={() => setStep('history')}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
          >
            <History className="w-4 h-4" />
            History
          </button>
        </div>
        <p className="text-slate-500 mb-6 text-sm">
          Export your orders from Shopify and drop the file here. CSV, Excel (.xlsx/.xls) accepted.
        </p>

        <Card>
          <CardContent className="p-0">
            <div
              className="border-2 border-dashed border-slate-200 rounded-xl p-12 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped) handleFileSelect(dropped);
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="w-7 h-7 text-purple-600" />
              </div>
              <p className="text-slate-700 font-medium mb-1">
                Drop your file here, or click to browse
              </p>
              <p className="text-sm text-slate-400">CSV, XLSX or XLS · max 50 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
                e.target.value = '';
              }}
            />
          </CardContent>
        </Card>

        {uploadError && (
          <div className="mt-4 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{uploadError}</span>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="flex-1 h-px bg-slate-200" />
        </div>

        <button
          onClick={handleLoadSample}
          disabled={loadingSampleData}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-colors disabled:opacity-50"
        >
          {loadingSampleData ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="w-4 h-4 text-purple-500" />
          )}
          {loadingSampleData ? 'Loading sample data…' : 'Try with sample data'}
        </button>

        <p className="mt-4 text-xs text-slate-400 text-center">
          In Shopify: <strong>Orders → Export → All orders → Plain CSV for Excel</strong>
        </p>
      </div>
    );
  }

  // ── Step: sheet-select ────────────────────────────────────────────────────

  if (step === 'sheet-select' && analyze?.sheet_names) {
    return (
      <div className="max-w-xl mx-auto p-6">
        {SampleBanner}
        <BackButton onClick={reset} label="Start over" />
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">This Excel file has multiple sheets</h2>
        <p className="text-slate-500 mb-6 text-sm">
          Which sheet contains your order data?
        </p>

        <Card className="mb-6">
          <CardContent className="p-5">
            <div className="space-y-2">
              {analyze.sheet_names.map((name, idx) => (
                <label
                  key={idx}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedSheet === idx
                      ? 'border-purple-400 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="sheet"
                    value={idx}
                    checked={selectedSheet === idx}
                    onChange={() => setSelectedSheet(idx)}
                    className="accent-purple-600"
                  />
                  <span className="text-slate-800 font-medium">{name}</span>
                  {idx === 0 && (
                    <span className="text-xs text-slate-400 ml-auto">First sheet</span>
                  )}
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        <Button
          onClick={async () => {
            if (file) {
              setStep('processing');
              setProcessStage('Reading columns…');
              await analyzeFile(file, selectedSheet);
            }
          }}
          className="w-full"
        >
          Use this sheet
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    );
  }

  // ── Step: mapping ─────────────────────────────────────────────────────────

  if (step === 'mapping' && analyze) {
    return (
      <div className="max-w-xl mx-auto p-6">
        {SampleBanner}
        <BackButton onClick={reset} label="Start over" />

        <h2 className="text-2xl font-semibold text-slate-900 mb-1">Help us match your columns</h2>
        <p className="text-slate-500 mb-6 text-sm">
          We found <strong>{analyze.all_columns.length} columns</strong> in{' '}
          <strong>{file?.name}</strong>. A few need your confirmation.
        </p>

        <div className="space-y-3">
          {CRITICAL_FIELDS.map(field => {
            const isAuto = field in analyze.auto_matched;
            const isMissing = analyze.missing.includes(field);
            const hasFuzzy = field in analyze.fuzzy_suggestions;
            const isNonBlocking = !BLOCKING_FIELDS.has(field);
            const conf = analyze.confidence_scores?.[field];
            const currentValue = mapping[field] ?? '';

            return (
              <Card key={field}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">
                          {labels[field] ?? field}
                        </span>
                        {isAuto && conf && confidenceBadge(conf)}
                        {!isAuto && hasFuzzy && conf && confidenceBadge(conf)}
                        {isMissing && isNonBlocking && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Optional</span>
                        )}
                        {isMissing && !isNonBlocking && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">Required</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{descriptions[field]}</p>
                    </div>

                    {isAuto ? (
                      <div className="shrink-0 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        {analyze.auto_matched[field]}
                      </div>
                    ) : (
                      <div className="shrink-0">
                        <select
                          value={currentValue}
                          onChange={e => setMapping(prev => ({ ...prev, [field]: e.target.value }))}
                          className={`bg-white border rounded-lg pl-3 pr-8 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 min-w-[180px] ${
                            !currentValue && !isNonBlocking ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
                          }`}
                        >
                          <option value="">{isNonBlocking ? 'Skip (optional)' : 'Select a column…'}</option>
                          {analyze.all_columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {isMissing && !currentValue && !isNonBlocking && (
                    <p className="mt-3 text-sm text-red-600 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {missingMessages[field]}
                    </p>
                  )}
                  {isMissing && isNonBlocking && !currentValue && (
                    <p className="mt-3 text-sm text-slate-400 flex items-start gap-2">
                      <Info className="w-4 h-4 shrink-0 mt-0.5" />
                      {missingMessages[field]}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-6 flex flex-col items-end gap-2">
          <Button onClick={() => setStep('preview')} disabled={!allBlockingMapped} className="flex items-center gap-2">
            Preview data
            <ArrowRight className="w-4 h-4" />
          </Button>
          {!allBlockingMapped && (
            <p className="text-xs text-slate-400">Select a column for each required field to continue.</p>
          )}
        </div>
      </div>
    );
  }

  // ── Step: preview ─────────────────────────────────────────────────────────

  if (step === 'preview' && analyze) {
    const previewRows = analyze.preview_rows ?? [];
    const previewCols = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

    return (
      <div className="max-w-5xl mx-auto p-6">
        {SampleBanner}
        <BackButton
          onClick={() => setStep(analyze.needs_mapping ? 'mapping' : 'upload')}
          label="Back"
        />

        <h2 className="text-2xl font-semibold text-slate-900 mb-1">Does this look right?</h2>
        <p className="text-slate-500 mb-4 text-sm">
          Showing the first {Math.min(previewRows.length, 10)} rows of <strong>{file?.name}</strong>{' '}
          ({analyze.row_count.toLocaleString()} rows total). Check the data matches what you expect, then click Process.
        </p>

        {/* Encoding info */}
        {analyze.encoding_used && (
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5" />
            Encoding detected: <strong className="text-slate-600">{analyze.encoding_used}</strong>
          </div>
        )}

        {/* Preview table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 mb-6">
          <table className="text-xs min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                {previewCols.map(col => (
                  <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {previewRows.slice(0, 10).map((row, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  {previewCols.map(col => (
                    <td key={col} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                      {String(row[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {uploadError && (
          <div className="mb-4 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => setStep(analyze.needs_mapping ? 'mapping' : 'upload')}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            Fix mapping
          </button>
          <Button onClick={handleProcess} className="flex items-center gap-2">
            Looks right — process
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: uploading ───────────────────────────────────────────────────────

  if (step === 'uploading') {
    return (
      <div className="max-w-xl mx-auto p-6 flex flex-col items-center justify-center py-24">
        <div className="w-full max-w-xs mb-6">
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>Uploading file…</span>
            <span className="font-medium">{uploadPct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5">
            <div
              className="bg-purple-600 h-2.5 rounded-full transition-all duration-200"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
        <p className="text-slate-400 text-sm">{file?.name}</p>
      </div>
    );
  }

  // ── Step: processing ──────────────────────────────────────────────────────

  if (step === 'processing') {
    const stages = ['Reading columns', 'Detecting mapping', 'Validating data', 'Calculating customer insights', 'Ready'];
    const currentIdx = stages.findIndex(s => processStage.includes(s.split(' ')[0]));

    return (
      <div className="max-w-xl mx-auto p-6 flex flex-col items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-6" />
        <h2 className="text-xl font-semibold text-slate-800 mb-5">Analysing your orders…</h2>
        <div className="w-full max-w-xs space-y-2">
          {stages.map((stage, i) => (
            <div key={stage} className="flex items-center gap-3 text-sm">
              {i < currentIdx ? (
                <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
              ) : i === currentIdx ? (
                <Loader2 className="w-5 h-5 text-purple-500 animate-spin shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
              )}
              <span className={i <= currentIdx ? 'text-slate-700' : 'text-slate-400'}>{stage}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Step: errors ──────────────────────────────────────────────────────────

  if (step === 'errors' && result) {
    const rowErrors = result.row_errors ?? [];
    const duplicates = result.duplicate_rows ?? [];
    const blockingErrors = rowErrors.filter(e => e.severity === 'error');
    const isBlocked = blockingErrors.length > 0;

    return (
      <div className="max-w-xl mx-auto p-6">
        {SampleBanner}

        <div className={`flex gap-3 p-4 rounded-lg border mb-6 ${isBlocked ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <AlertCircle className={`w-5 h-5 shrink-0 mt-0.5 ${isBlocked ? 'text-red-500' : 'text-yellow-500'}`} />
          <div>
            <p className={`font-semibold text-sm ${isBlocked ? 'text-red-700' : 'text-yellow-700'}`}>
              {isBlocked
                ? `${blockingErrors.length} error${blockingErrors.length > 1 ? 's' : ''} found in your file`
                : 'A few rows have issues — data can still be processed'}
            </p>
            <p className={`text-sm mt-1 ${isBlocked ? 'text-red-600' : 'text-yellow-600'}`}>
              {result.rows_processed} rows processed · {result.warning_count ?? 0} warning{(result.warning_count ?? 0) !== 1 ? 's' : ''}
              {duplicates.length > 0 && ` · ${duplicates.length} duplicate${duplicates.length > 1 ? 's' : ''} removed`}
            </p>
          </div>
        </div>

        {/* Row errors */}
        {rowErrors.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">Row errors</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {rowErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-red-50 rounded-lg text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-red-700">
                    <strong>Row {e.row}:</strong> {e.error}
                    {e.value ? ` (found: "${e.value}")` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Duplicate rows */}
        {duplicates.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-slate-700 mb-2">Duplicate orders removed</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {duplicates.map((d, i) => (
                <div key={i} className="flex items-start gap-2 p-2.5 bg-yellow-50 rounded-lg text-xs">
                  <Info className="w-3.5 h-3.5 text-yellow-600 shrink-0 mt-0.5" />
                  <span className="text-yellow-700">
                    <strong>Row {d.row}:</strong> {d.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => downloadErrorCsv(rowErrors, duplicates)}
          className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-800 mb-6 font-medium"
        >
          <Download className="w-4 h-4" />
          Download error report (CSV)
        </button>

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 text-sm font-medium hover:bg-slate-50"
          >
            Fix and re-upload
          </button>
          {!isBlocked && (
            <Button onClick={handleProceedDespiteErrors} className="flex items-center gap-2">
              Continue anyway
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  // ── Step: success ─────────────────────────────────────────────────────────

  if (step === 'success' && result) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center">
        {SampleBanner}

        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">Upload complete</h2>
        <p className="text-slate-500 text-sm mb-6">
          {result.rows_processed?.toLocaleString()} rows processed successfully.
          {(result.warning_count ?? 0) > 0 && ` ${result.warning_count} warnings.`}
          {(result.duplicate_rows?.length ?? 0) > 0 && ` ${result.duplicate_rows!.length} duplicates removed.`}
        </p>

        <Card className="mb-6 text-left">
          <CardContent className="p-5 space-y-3">
            <Stat label="Rows processed" value={result.rows_processed?.toLocaleString() ?? '—'} />
            {result.encoding_used && <Stat label="Encoding" value={result.encoding_used} />}
            {result.uploaded_at && <Stat label="Uploaded" value={formatDate(result.uploaded_at)} />}
          </CardContent>
        </Card>

        <Button onClick={reset} className="w-full">
          Upload another file
        </Button>
      </div>
    );
  }

  // ── Step: history ─────────────────────────────────────────────────────────

  if (step === 'history') {
    return (
      <div className="max-w-xl mx-auto p-6">
        {SampleBanner}
        <BackButton onClick={() => setStep('upload')} label="Back to upload" />

        <h2 className="text-2xl font-semibold text-slate-900 mb-1">Upload history</h2>
        <p className="text-slate-500 mb-6 text-sm">All your previous uploads. Click "Use this" to reload a past dataset.</p>

        {historyLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No uploads yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map(entry => (
              <Card key={entry.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <FileSpreadsheet className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{entry.file_name}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-0.5">
                        {entry.row_count !== null && <span>{entry.row_count.toLocaleString()} rows</span>}
                        <span>{fileSizeMB(entry.file_size_bytes)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {daysAgo(entry.created_at)}
                        </span>
                        <StatusBadge status={entry.status} />
                        {entry.is_sample_data && (
                          <span className="text-amber-600 font-medium">Sample</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {entry.status === 'complete' && !entry.is_sample_data && (
                        <button
                          onClick={() => handleSetActive(entry.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Use this
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteHistory(entry.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
};

// ── Sub-components ────────────────────────────────────────────────────────────

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-slate-400 hover:text-slate-600 mb-4 inline-flex items-center gap-1"
    >
      ← {label}
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: UploadHistoryEntry['status'] }) {
  const map: Record<UploadHistoryEntry['status'], { label: string; className: string }> = {
    complete:   { label: 'Complete',   className: 'text-green-600' },
    processing: { label: 'Processing', className: 'text-blue-600' },
    failed:     { label: 'Failed',     className: 'text-red-600' },
  };
  const { label, className } = map[status] ?? { label: status, className: '' };
  return <span className={`font-medium ${className}`}>{label}</span>;
}
