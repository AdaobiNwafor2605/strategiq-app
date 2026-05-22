import React, { useState, useRef } from 'react';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Info,
} from 'lucide-react';
import { Card, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { DataUploadProps, ProcessingMetrics } from '../../types';

// ── Local types ───────────────────────────────────────────────────────────────

type Step = 'upload' | 'mapping' | 'confirm' | 'processing';

interface AnalyzeResult {
  success: boolean;
  error?: string;
  all_columns: string[];
  row_count: number;
  auto_matched: Record<string, string>;       // standard_field → csv_column
  fuzzy_suggestions: Record<string, string[]>; // standard_field → [csv_column, ...]
  missing: string[];
  needs_mapping: boolean;
  field_labels: Record<string, string>;
  field_descriptions: Record<string, string>;
  field_missing_messages: Record<string, string>;
}

// The 4 critical fields returned by analyze-headers.
// line_items is non-blocking — absence is a warning, not an error.
const CRITICAL_FIELDS = ['order_id', 'order_date', 'total_price', 'line_items'] as const;
const BLOCKING_FIELDS = new Set(['order_id', 'order_date', 'total_price']);

// Fallback labels used before the server response arrives.
const DEFAULT_LABELS: Record<string, string> = {
  order_id: 'Order ID',
  order_date: 'Order Date',
  total_price: 'Order Total / Revenue',
  line_items: 'Line Items (Products)',
};

const DEFAULT_DESCRIPTIONS: Record<string, string> = {
  order_id: 'A unique identifier for each order.',
  order_date: 'The date each order was placed.',
  total_price: 'The total amount charged for each order.',
  line_items: 'The product(s) included in each order.',
};

const DEFAULT_MISSING_MESSAGES: Record<string, string> = {
  order_id:
    "We couldn't find an Order ID column. Without it, we can't tell your orders apart.",
  order_date:
    "We couldn't find an Order Date column. Without it, we can't show trends over time.",
  total_price:
    "We couldn't find a Revenue column (e.g. 'Total Price' or 'Subtotal'). This is required to calculate your total sales.",
  line_items:
    "We couldn't find a product or line item column. Product analytics won't be available, but revenue and customer insights will still work.",
};

// Translate analyze-headers field names → pipeline standard names used by /api/process-files.
const FIELD_TO_PIPELINE: Record<string, string> = {
  order_id: 'order_id',
  order_date: 'order_date',
  total_price: 'total',
  line_items: 'product_name',
};

// ── Component ─────────────────────────────────────────────────────────────────

export const DataUpload: React.FC<DataUploadProps> = ({ onProcessed }) => {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const labels = result?.field_labels ?? DEFAULT_LABELS;
  const descriptions = result?.field_descriptions ?? DEFAULT_DESCRIPTIONS;
  const missingMessages = result?.field_missing_messages ?? DEFAULT_MISSING_MESSAGES;

  // ── Helpers ───────────────────────────────────────────────────────────────

  const allBlockingMapped = CRITICAL_FIELDS.filter(f => BLOCKING_FIELDS.has(f)).every(
    f => !!mapping[f],
  );

  function buildPipelineMapping(confirmed: Record<string, string>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [field, csvCol] of Object.entries(confirmed)) {
      const pipelineKey = FIELD_TO_PIPELINE[field] ?? field;
      out[pipelineKey] = csvCol;
    }
    return out;
  }

  // ── Step 1: file select → call analyze-headers ────────────────────────────

  async function handleFileSelect(selected: File) {
    if (!selected.name.endsWith('.csv')) {
      setUploadError(
        'Please upload a CSV file. In Shopify, go to Orders → Export and choose "Plain CSV for Excel".',
      );
      return;
    }

    setFile(selected);
    setUploadError(null);
    setIsAnalyzing(true);

    try {
      const form = new FormData();
      form.append('file', selected);

      const res = await fetch('/api/upload/analyze-headers', { method: 'POST', body: form });
      const data: AnalyzeResult = await res.json();

      if (!data.success) {
        setUploadError(data.error ?? 'We had trouble reading that file. Please try again.');
        setIsAnalyzing(false);
        return;
      }

      setResult(data);

      // Pre-fill mapping: auto-matched + first fuzzy suggestion
      const initial: Record<string, string> = { ...data.auto_matched };
      for (const [field, suggestions] of Object.entries(data.fuzzy_suggestions)) {
        if (suggestions.length > 0 && !initial[field]) {
          initial[field] = suggestions[0];
        }
      }
      setMapping(initial);

      if (!data.needs_mapping) {
        setStep('confirm');
      } else {
        setStep('mapping');
      }
    } catch {
      setUploadError(
        "We couldn't connect to the server. Please check your connection and try again.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  }

  // ── Step 4: send confirmed mapping + file to /api/process-files ───────────

  async function handleProcess() {
    if (!file) return;
    setProcessError(null);
    setStep('processing');

    try {
      const form = new FormData();
      form.append('files', file);
      form.append('column_mapping', JSON.stringify(buildPipelineMapping(mapping)));

      const res = await fetch('/api/process-files', { method: 'POST', body: form });
      const data = await res.json();

      if (data.success && data.metrics) {
        const m = data.metrics;
        if (
          typeof m.total_revenue === 'number' &&
          typeof m.active_customers === 'number' &&
          typeof m.average_order_value === 'number'
        ) {
          onProcessed(m as ProcessingMetrics);
          return;
        }
      }

      const errMsg =
        typeof data.error === 'object' ? data.error?.message : data.error;
      setProcessError(
        errMsg ||
          'Something went wrong while analysing your data. Please try again.',
      );
      setStep('confirm');
    } catch {
      setProcessError(
        "We couldn't connect to the server. Please check your connection and try again.",
      );
      setStep('confirm');
    }
  }

  // ── Render: Step 1 — Upload ───────────────────────────────────────────────

  if (step === 'upload') {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h2 className="text-2xl font-semibold text-slate-900 mb-1">
          Upload your Shopify orders
        </h2>
        <p className="text-slate-500 mb-6 text-sm">
          Export your orders from Shopify as a CSV and drop it here.
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
              {isAnalyzing ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                  <p className="text-slate-600 font-medium">Reading your file…</p>
                  <p className="text-slate-400 text-sm">Checking columns</p>
                </div>
              ) : (
                <>
                  <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-7 h-7 text-purple-600" />
                  </div>
                  <p className="text-slate-700 font-medium mb-1">
                    Drop your CSV here, or click to browse
                  </p>
                  <p className="text-sm text-slate-400">Shopify Orders export (.csv)</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
          </CardContent>
        </Card>

        {uploadError && (
          <div className="mt-4 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{uploadError}</span>
          </div>
        )}

        <p className="mt-4 text-xs text-slate-400 text-center">
          In Shopify: <strong>Orders → Export → All orders → Plain CSV for Excel</strong>
        </p>
      </div>
    );
  }

  // ── Render: Step 2 — Column Mapping ──────────────────────────────────────

  if (step === 'mapping' && result) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <button
          onClick={() => {
            setStep('upload');
            setFile(null);
            setResult(null);
            setUploadError(null);
          }}
          className="text-sm text-slate-400 hover:text-slate-600 mb-4 inline-flex items-center gap-1"
        >
          ← Start over
        </button>

        <h2 className="text-2xl font-semibold text-slate-900 mb-1">
          Help us match your columns
        </h2>
        <p className="text-slate-500 mb-6 text-sm">
          We found <strong>{result.all_columns.length} columns</strong> in{' '}
          <strong>{file?.name}</strong>. A few need your help to identify.
        </p>

        <div className="space-y-3">
          {CRITICAL_FIELDS.map(field => {
            const isAuto = field in result.auto_matched;
            const isMissing = result.missing.includes(field);
            const hasFuzzy = field in result.fuzzy_suggestions;
            const isNonBlocking = !BLOCKING_FIELDS.has(field);
            const currentValue = mapping[field] ?? '';

            return (
              <Card key={field}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Left: label + description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">
                          {labels[field]}
                        </span>
                        {isAuto && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Detected
                          </span>
                        )}
                        {hasFuzzy && !isAuto && (
                          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            Best guess
                          </span>
                        )}
                        {isMissing && isNonBlocking && (
                          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                            Optional
                          </span>
                        )}
                        {isMissing && !isNonBlocking && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{descriptions[field]}</p>
                    </div>

                    {/* Right: detected value or dropdown */}
                    {isAuto ? (
                      <div className="shrink-0 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800 font-medium">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        {result.auto_matched[field]}
                      </div>
                    ) : (
                      <div className="shrink-0">
                        <select
                          value={currentValue}
                          onChange={e =>
                            setMapping(prev => ({ ...prev, [field]: e.target.value }))
                          }
                          className={`bg-white border rounded-lg pl-3 pr-8 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-400 min-w-[180px] ${
                            !currentValue && !isNonBlocking
                              ? 'border-red-300 ring-1 ring-red-200'
                              : 'border-slate-200'
                          }`}
                        >
                          <option value="">
                            {isNonBlocking ? 'Skip (optional)' : 'Select a column…'}
                          </option>
                          {result.all_columns.map(col => (
                            <option key={col} value={col}>
                              {col}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Error message for missing required fields */}
                  {isMissing && !currentValue && !isNonBlocking && (
                    <p className="mt-3 text-sm text-red-600 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      {missingMessages[field]}
                    </p>
                  )}

                  {/* Info message for missing optional fields */}
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
          <Button
            onClick={() => setStep('confirm')}
            disabled={!allBlockingMapped}
            className="flex items-center gap-2"
          >
            Continue
            <ArrowRight className="w-4 h-4" />
          </Button>
          {!allBlockingMapped && (
            <p className="text-xs text-slate-400">
              Select a column for each required field above to continue.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Render: Step 3 — Confirm ──────────────────────────────────────────────

  if (step === 'confirm' && result) {
    const lineItemsMissing = !mapping['line_items'];

    return (
      <div className="max-w-xl mx-auto p-6">
        <button
          onClick={() => setStep(result.needs_mapping ? 'mapping' : 'upload')}
          className="text-sm text-slate-400 hover:text-slate-600 mb-4 inline-flex items-center gap-1"
        >
          ← Back
        </button>

        <h2 className="text-2xl font-semibold text-slate-900 mb-1">Ready to process</h2>
        <p className="text-slate-500 mb-6 text-sm">
          Here's what we found. Everything look right?
        </p>

        <Card className="mb-4">
          <CardContent className="p-6">
            {/* File stats */}
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-slate-500">File</span>
              <span className="text-slate-800 font-medium truncate max-w-[220px]">
                {file?.name}
              </span>
            </div>
            <div className="flex items-center justify-between mb-5 text-sm">
              <span className="text-slate-500">Orders found</span>
              <span className="text-slate-800 font-medium">
                {result.row_count.toLocaleString()} rows
              </span>
            </div>

            {/* Mapping summary */}
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Column mapping
              </p>
              <div className="space-y-2">
                {CRITICAL_FIELDS.map(field => {
                  const mapped = mapping[field];
                  const isNonBlocking = !BLOCKING_FIELDS.has(field);

                  if (!mapped && isNonBlocking) return null;

                  return (
                    <div
                      key={field}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-500">{labels[field]}</span>
                      <div className="flex items-center gap-2">
                        {mapped ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-slate-800">{mapped}</span>
                          </>
                        ) : (
                          <span className="text-red-500 text-xs">Not mapped</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Found / missing summary */}
            <div className="border-t mt-4 pt-4 text-xs text-slate-400 space-y-1">
              <p>
                <span className="text-green-600 font-medium">
                  {Object.keys(mapping).length} field
                  {Object.keys(mapping).length !== 1 ? 's' : ''} matched
                </span>{' '}
                across {result.all_columns.length} columns in your file.
              </p>
              {result.missing.length > 0 && (
                <p>
                  <span className="text-slate-500">Not found: </span>
                  {result.missing.map(f => labels[f]).join(', ')}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Warning: line items missing */}
        {lineItemsMissing && (
          <div className="mb-4 flex gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <Info className="w-5 h-5 shrink-0 mt-0.5 text-yellow-500" />
            <span>
              We didn't find a <strong>Line Items / Products</strong> column. Revenue and
              customer insights will still work — but product-level analytics won't be
              available.
            </span>
          </div>
        )}

        {processError && (
          <div className="mb-4 flex gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{processError}</span>
          </div>
        )}

        <Button
          onClick={handleProcess}
          className="w-full flex items-center justify-center gap-2"
        >
          Start Analysis
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  // ── Render: Step 4 — Processing ───────────────────────────────────────────

  if (step === 'processing') {
    return (
      <div className="max-w-xl mx-auto p-6 flex flex-col items-center justify-center py-24">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-5" />
        <h2 className="text-xl font-semibold text-slate-800 mb-2">
          Analysing your orders
        </h2>
        <p className="text-slate-500 text-sm text-center">
          This usually takes 10–20 seconds. Hang tight.
        </p>
      </div>
    );
  }

  return null;
};
