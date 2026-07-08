import React, { useEffect, useState } from 'react';
import {
  BarChart3, Users, TrendingUp, Brain,
  Target, DollarSign, ShoppingCart, Clock, Zap,
  AlertTriangle, Download, Loader2, Upload, Repeat, Trophy,
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
import { InfoTooltip } from '../ui/InfoTooltip';
import { topCustomersBySpend } from '../../utils/customerFilters';
import type { ActionGroup, ActionSummaryFull, BankInsight, DashboardInsightsPayload, InsightSegment } from '../../types';

interface DashboardProps {
  uploadedAt?: string | null;
  isSampleData?: boolean;
  sessionInsights?: DashboardInsightsPayload | null;
  onNavigateToUpload?: () => void;
  data: {
    total_revenue?: number;
    active_customers?: number;
    average_order_value?: number;
    churn_risk?: number;
    repeat_purchase_rate?: number | null;
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

const METRIC_INFO = {
  totalRevenue: 'The sum of every order in your uploaded data, before refunds.',
  activeCustomers: 'The number of unique customers who placed at least one order in your uploaded data.',
  aov: 'Average Order Value — total revenue divided by number of orders. Shows how much a typical order is worth.',
  churnRisk: 'The share of your customers who are Lapsed (no order in 180+ days) or Going Quiet (overdue based on their own usual buying pattern). Based on the most recent order date in your uploaded data, not today’s date.',
  repeatPurchaseRate: 'The share of your customers who have placed more than one order. A higher rate means more of your revenue is coming from repeat buyers rather than one-time purchases.',
  revenueAtRisk: 'Estimated lifetime spend from customers who are Lapsed or overdue (Going Quiet) — revenue you stand to lose if they don’t come back.',
  revenueOpportunity: 'Estimated revenue from new customers and one-time buyers who are in their window to make a second purchase.',
  revenueForecast: 'A projection of future revenue based on your historical order pattern. The solid line is actual revenue; the dashed line is the model’s prediction.',
};

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
  onNavigateToUpload,
}) => {
  const { user } = useAuth();
  const currency = user?.currency ?? 'GBP';

  const [loading, setLoading] = useState(true);
  const [actionSummary, setActionSummary] = useState<ActionSummaryFull | null>(null);
  const [bankInsights, setBankInsights] = useState<BankInsight[]>([]);
  const [sessionCustomers, setSessionCustomers] = useState<Record<string, unknown>[]>([]);
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
      const preferSession = isSampleData || Boolean(sessionInsights?.uploadId);

      const applySessionData = () => {
        const fromMetrics = segmentsFromProps(data?.customer_segments);
        const fromSummary = sessionInsights?.actionSummary?.segments ?? [];
        const nextSegments = fromMetrics.length > 0 ? fromMetrics : fromSummary;
        setSegments(nextSegments);
        setActionSummary(sessionInsights?.actionSummary ?? null);
        setBankInsights(sessionInsights?.insights ?? []);
        setSessionCustomers(sessionInsights?.customers ?? []);
        setUploadId(sessionInsights?.uploadId ?? null);
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) {
          setSegments(segmentsFromProps(data?.customer_segments));
          setActionSummary(sessionInsights?.actionSummary ?? null);
          setBankInsights(sessionInsights?.insights ?? []);
          setSessionCustomers(sessionInsights?.customers ?? []);
          setUploadId(sessionInsights?.uploadId ?? null);
        }
        return;
      }

      if (preferSession) {
        if (!cancelled) applySessionData();
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

      // Fetch raw customer records (for the Top Customers table on returning visits,
      // when there's no fresh upload response to draw from)
      let nextCustomers: Record<string, unknown>[] = [];
      try {
        const custRes = await fetch('/api/insights/customers', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (custRes.ok) {
          const custBody = await custRes.json();
          if (custBody.success && custBody.data?.length > 0) {
            nextCustomers = custBody.data;
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
      if (nextCustomers.length === 0 && sessionInsights?.customers?.length) {
        nextCustomers = sessionInsights.customers;
      }
      if (!cancelled) {
        setSegments(nextSegments);
        setActionSummary(nextSummary);
        setBankInsights(nextInsights);
        setUploadId(nextUploadId);
        if (nextCustomers.length > 0) {
          setSessionCustomers(nextCustomers);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [data, sessionInsights, isSampleData]);

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
          <CardContent className="p-10 text-center text-slate-600">
            <BarChart3 className="w-14 h-14 mx-auto mb-4 text-purple-300" />
            <h3 className="text-xl font-semibold text-slate-900 mb-2">No data yet</h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
              Upload your Shopify orders CSV to see revenue, customer segments, and
              weekly actions — or try it first with sample data, no upload needed.
            </p>
            {onNavigateToUpload && (
              <button
                onClick={onNavigateToUpload}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Upload className="w-4 h-4" />
                Go to Upload
              </button>
            )}
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
  const topCustomers = topCustomersBySpend(sessionCustomers, 10);

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
                <p className="text-xs text-red-600 font-medium uppercase tracking-wide flex items-center gap-1">
                  Revenue at Risk
                  <InfoTooltip title="Revenue at Risk" text={METRIC_INFO.revenueAtRisk} className="text-red-300 hover:text-red-500" />
                </p>
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
                <p className="text-xs text-green-600 font-medium uppercase tracking-wide flex items-center gap-1">
                  Revenue Opportunity
                  <InfoTooltip title="Revenue Opportunity" text={METRIC_INFO.revenueOpportunity} className="text-green-300 hover:text-green-500" />
                </p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(revenueOpportunity, currency)}</p>
                <p className="text-xs text-green-500">New + conversion-window buyers</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Header Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className={!isAvailable(data.total_revenue) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 flex items-center gap-1">
                  Total Revenue
                  <InfoTooltip title="Total Revenue" text={METRIC_INFO.totalRevenue} />
                </p>
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
                <p className="text-sm font-medium text-slate-600 flex items-center gap-1">
                  Active Customers
                  <InfoTooltip title="Active Customers" text={METRIC_INFO.activeCustomers} />
                </p>
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
                <p className="text-sm font-medium text-slate-600 flex items-center gap-1">
                  Average Order Value
                  <InfoTooltip title="Average Order Value" text={METRIC_INFO.aov} />
                </p>
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
                <p className="text-sm font-medium text-slate-600 flex items-center gap-1">
                  Churn Risk
                  <InfoTooltip title="Churn Risk" text={METRIC_INFO.churnRisk} />
                </p>
                {isAvailable(data.churn_risk) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {data.churn_risk!.toFixed(1)}%
                  </h3>
                ) : (
                  <p className="text-sm text-slate-500">Not Available</p>
                )}
                <p className="text-xs text-slate-400 mt-0.5">Lapsed + overdue, based on your data</p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className={!isAvailable(data.repeat_purchase_rate) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600 flex items-center gap-1">
                  Repeat Purchase Rate
                  <InfoTooltip title="Repeat Purchase Rate" text={METRIC_INFO.repeatPurchaseRate} />
                </p>
                {isAvailable(data.repeat_purchase_rate) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {data.repeat_purchase_rate!.toFixed(1)}%
                  </h3>
                ) : (
                  <p className="text-sm text-slate-500">Not Available</p>
                )}
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                <Repeat className="w-6 h-6 text-teal-600" />
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
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-1.5">
              Revenue Forecast
              <InfoTooltip title="Revenue Forecast" text={METRIC_INFO.revenueForecast} />
            </h3>
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

      {/* Top 10 Customers by Spend */}
      {topCustomers.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Top 10 Customers by Spend
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">Who your biggest fans are, and what to do next with them</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <th className="py-2 pr-3 font-semibold">Customer</th>
                    <th className="py-2 pr-3 font-semibold text-right">Total Spent</th>
                    <th className="py-2 pr-3 font-semibold text-right hidden sm:table-cell">Orders</th>
                    <th className="py-2 pr-3 font-semibold hidden md:table-cell">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {topCustomers.map((c, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="py-2.5 pr-3 text-slate-700 truncate max-w-[180px]">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          {c.email_or_id}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-semibold text-slate-800">
                        {formatCurrency(c.total_revenue, currency)}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-slate-500 hidden sm:table-cell">
                        {c.order_count}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-500 hidden md:table-cell truncate max-w-[260px]">
                        {c.recommended_action || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
            sessionCustomers={sessionCustomers}
            actionSummary={actionSummary}
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
          sessionCustomers={sessionCustomers}
          onClose={() => setSelectedSegment(null)}
        />
      )}
    </div>
  );
};
