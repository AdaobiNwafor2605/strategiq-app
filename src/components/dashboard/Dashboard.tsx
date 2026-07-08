import React, { useEffect, useState } from 'react';
import {
  BarChart3, Users, TrendingUp, AlertCircle, Brain,
  Target, DollarSign, ShoppingCart, Clock, Zap,
  AlertTriangle, Download, Loader2,
} from 'lucide-react';
import { supabase, useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardContent } from '../ui/Card';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { SegmentCard } from './SegmentCard';
import { SegmentModal } from './SegmentModal';
import { ActionsList } from './ActionsList';
import { InsightBank } from './InsightBank';
import type { ActionGroup, ActionSummaryFull, BankInsight, DashboardInsightsPayload, InsightSegment } from '../../types';

interface DashboardProps {
  uploadedAt?: string | null;
  isSampleData?: boolean;
  sessionInsights?: DashboardInsightsPayload | null;
  data: {
    total_revenue?: number;
    active_customers?: number;
    average_order_value?: number;
    churn_risk?: number;
    revenue_forecast?: Array<{
      period: string;
      display_name: string;
      revenue: number;
      predicted_revenue?: number;
      type: 'actual' | 'validation' | 'forecast';
    }>;
    customer_segments?: Array<{
      name: string;
      color: string;
      customers: number;
      total_revenue: number;
      avg_revenue: number;
    }>;
  } | null;
}

function freshnessLabel(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'Uploaded today';
  if (diff === 1) return 'Last upload: yesterday';
  return `Last upload: ${diff} days ago`;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function segmentsFromProps(
  customerSegments: NonNullable<DashboardProps['data']>['customer_segments'],
): InsightSegment[] {
  if (!customerSegments?.length) return [];
  const totalRevenue = customerSegments.reduce((sum, seg) => sum + seg.total_revenue, 0);
  return customerSegments.map((seg) => ({
    ...seg,
    revenue_pct: Math.round((seg.total_revenue / Math.max(totalRevenue, 1)) * 1000) / 10,
  }));
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  uploadedAt,
  isSampleData,
  sessionInsights,
}) => {
  const { user } = useAuth();
  const currency = user?.currency ?? 'GBP';

  const [loading, setLoading] = useState(true);
  const [actionSummary, setActionSummary] = useState<ActionSummaryFull | null>(null);
  const [bankInsights, setBankInsights] = useState<BankInsight[]>([]);
  const [segments, setSegments] = useState<InsightSegment[]>([]);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [selectedSegment, setSelectedSegment] = useState<InsightSegment | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setSegments(segmentsFromProps(data?.customer_segments));
          setActionSummary(sessionInsights?.actionSummary ?? null);
          setBankInsights(sessionInsights?.insights ?? []);
          setUploadId(sessionInsights?.uploadId ?? null);
        }
        return;
      }

      let nextSegments: InsightSegment[] = [];
      let nextSummary: ActionSummaryFull | null = null;
      let nextInsights: BankInsight[] = [];
      let nextUploadId: string | null = null;

      // Fetch segments (7-segment breakdown from persisted customer insights)
      try {
        const segRes = await fetch('/api/insights/segments', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (segRes.ok) {
          const segBody = await segRes.json();
          if (segBody.success && segBody.segments?.length > 0) {
            nextSegments = segBody.segments;
          }
        }
      } catch { /* silently skip */ }

      // Fetch action summary (actions, revenue at risk, what changed)
      try {
        const sumRes = await fetch('/api/insights/action-summary', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (sumRes.ok) {
          const sumBody = await sumRes.json();
          if (sumBody.success && sumBody.summary) {
            nextSummary = sumBody.summary as ActionSummaryFull;
            nextUploadId = sumBody.upload_id ?? null;
            if (nextSegments.length === 0 && sumBody.summary.segments?.length > 0) {
              nextSegments = sumBody.summary.segments;
            }
          }
        }
      } catch { /* silently skip */ }

      // Fetch scored insight bank
      try {
        const bankRes = await fetch('/api/insights/bank', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (bankRes.ok) {
          const bankBody = await bankRes.json();
          if (bankBody.success && bankBody.insights?.length > 0) {
            nextInsights = bankBody.insights;
            if (!nextUploadId) nextUploadId = bankBody.upload_id ?? null;
          }
        }
      } catch { /* silently skip */ }

      // Upload response fallbacks — same session data that powers segment cards
      if (nextSegments.length === 0) {
        nextSegments = segmentsFromProps(data?.customer_segments);
      }
      if (!nextSummary?.groups?.length && sessionInsights?.actionSummary) {
        nextSummary = sessionInsights.actionSummary;
      }
      if (nextInsights.length === 0 && sessionInsights?.insights?.length) {
        nextInsights = sessionInsights.insights;
      }
      if (!nextUploadId && sessionInsights?.uploadId) {
        nextUploadId = sessionInsights.uploadId;
      }

      if (!cancelled) {
        setSegments(nextSegments);
        setActionSummary(nextSummary);
        setBankInsights(nextInsights);
        setUploadId(nextUploadId);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [data, sessionInsights]);

  async function handleDownloadAll() {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/insights/download/all', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strategiq-export-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-center text-slate-600">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
            <p>Upload and process your data files to see analytics here.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAvailable = (v: unknown) => v !== undefined && v !== null;

  const forecastData = data.revenue_forecast?.map((item) => ({
    month: item.display_name,
    actual:
      item.type === 'actual' || item.type === 'validation' ? item.revenue : null,
    forecast:
      item.type === 'validation'
        ? item.predicted_revenue
        : item.type === 'forecast'
        ? item.revenue
        : null,
  })) ?? [];

  const totalSegmentRevenue = segments.reduce((s, seg) => s + seg.total_revenue, 0);
  const totalSegmentCustomers = segments.reduce((s, seg) => s + seg.customers, 0);

  const actionGroups: ActionGroup[] = actionSummary?.groups ?? [];
  const revenueAtRisk = actionSummary?.revenue_at_risk ?? 0;
  const revenueOpportunity = actionSummary?.revenue_opportunity ?? 0;
  const whatChanged = actionSummary?.what_changed;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

      {/* Sample data / freshness bar */}
      {isSampleData && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <Zap className="w-4 h-4 shrink-0 text-amber-500" />
          <span>
            <strong>Viewing sample data</strong> — upload your own orders to see real insights.
          </span>
        </div>
      )}
      {!isSampleData && uploadedAt && (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Clock className="w-4 h-4" />
          <span>{freshnessLabel(uploadedAt)}</span>
        </div>
      )}

      {/* "What changed" banner */}
      {whatChanged && (
        <div className="flex items-start gap-3 px-4 py-3 bg-purple-50 border border-purple-100 rounded-xl text-sm text-purple-900">
          <BarChart3 className="w-4 h-4 shrink-0 text-purple-500 mt-0.5" />
          <p>{whatChanged}</p>
        </div>
      )}

      {/* Revenue at risk / opportunity + download all */}
      {(revenueAtRisk > 0 || revenueOpportunity > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {revenueAtRisk > 0 && (
            <div className="flex items-center gap-4 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-red-600 font-medium uppercase tracking-wide">Revenue at Risk</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(revenueAtRisk, currency)}</p>
                <p className="text-xs text-red-500">Lapsed + at-risk customers</p>
              </div>
            </div>
          )}
          {revenueOpportunity > 0 && (
            <div className="flex items-center gap-4 bg-green-50 border border-green-100 rounded-xl px-4 py-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Revenue Opportunity</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(revenueOpportunity, currency)}</p>
                <p className="text-xs text-green-500">New + conversion-window buyers</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className={!isAvailable(data.total_revenue) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Revenue</p>
                {isAvailable(data.total_revenue) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {formatCurrency(data.total_revenue!, currency)}
                  </h3>
                ) : (
                  <p className="text-sm text-slate-500">Not Available</p>
                )}
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={!isAvailable(data.active_customers) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Customers</p>
                {isAvailable(data.active_customers) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {data.active_customers!.toLocaleString()}
                  </h3>
                ) : (
                  <p className="text-sm text-slate-500">Not Available</p>
                )}
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={!isAvailable(data.average_order_value) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Average Order Value</p>
                {isAvailable(data.average_order_value) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {formatCurrency(data.average_order_value!, currency)}
                  </h3>
                ) : (
                  <p className="text-sm text-slate-500">Not Available</p>
                )}
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={!isAvailable(data.churn_risk) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Churn Risk</p>
                {isAvailable(data.churn_risk) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {data.churn_risk!.toFixed(1)}%
                  </h3>
                ) : (
                  <p className="text-sm text-slate-500">Not Available</p>
                )}
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Forecast */}
        <Card className={forecastData.length === 0 ? 'opacity-50' : ''}>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Revenue Forecast</h3>
            <p className="text-sm text-slate-600">Actual vs Predicted performance</p>
          </CardHeader>
          <CardContent>
            {forecastData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={forecastData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(v) => [formatCurrency(v as number, currency), '']} />
                  <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="#10b981"
                    strokeWidth={3}
                    name="Actual Revenue"
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    strokeDasharray="8 8"
                    name="ML Predictions & Forecast"
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                Not Available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Segments */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Customer Segments</h3>
                <p className="text-sm text-slate-600">Who your customers are and what they're worth</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {segments.length > 0 ? (
              <>
                {/* Totals above grid */}
                <div className="flex items-center gap-6 mb-4 text-sm">
                  <div>
                    <span className="text-slate-500">Total customers:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {totalSegmentCustomers.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Total revenue:</span>{' '}
                    <span className="font-semibold text-slate-800">
                      {formatCurrency(totalSegmentRevenue, currency)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {segments.map((segment, i) => (
                    <SegmentCard
                      key={i}
                      segment={segment}
                      totalRevenue={totalSegmentRevenue}
                      currency={currency}
                      onView={(name) => {
                        const found = segments.find(s => s.name === name);
                        if (found) setSelectedSegment(found);
                      }}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">Upload data to generate customer segments</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* This Week's Customer Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                This Week's Customer Actions
              </h3>
              <p className="text-sm text-slate-500 mt-0.5">
                What to do with your customers right now — ranked by priority
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ActionsList
            groups={actionGroups}
            uploadId={uploadId}
            currency={currency}
            generatedAt={actionSummary?.generated_at ?? null}
          />
        </CardContent>
      </Card>

      {/* AI-Powered Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                AI-Powered Insights
              </h3>
              <p className="text-sm text-slate-600">
                Actionable recommendations based on your customer data
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <InsightBank
            currency={currency}
            fallbackGroups={actionGroups}
            sessionInsights={bankInsights}
          />
        </CardContent>
      </Card>

      {/* Bulk Download */}
      {(actionGroups.length > 0 || segments.length > 0) && (
        <div className="flex justify-end">
          <button
            onClick={handleDownloadAll}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            Download everything (ZIP)
          </button>
        </div>
      )}

      {/* Segment Modal */}
      {selectedSegment && (
        <SegmentModal
          segmentName={selectedSegment.name}
          segmentColor={selectedSegment.color}
          currency={currency}
          onClose={() => setSelectedSegment(null)}
        />
      )}
    </div>
  );
};
