import React, { useEffect, useRef, useState } from 'react';
import {
  Brain, AlertTriangle, TrendingUp, Tag, BarChart3,
  Users, ChevronDown, ChevronUp, Download,
  Loader2, Check, RefreshCw,
} from 'lucide-react';
import { supabase } from '../../contexts/AuthContext';
import type { ActionGroup, BankInsight, InsightCategory } from '../../types';

interface InsightBankProps {
  currency: string;
  fallbackGroups?: ActionGroup[];
}

// Derive a simple insight card from an action group for users who haven't re-uploaded yet
function groupToFallbackCard(g: ActionGroup, index: number): BankInsight {
  const text = g.action.toLowerCase();
  const category: InsightCategory =
    text.includes('lapsed') || text.includes('win back') || text.includes('re-engage')
      ? 'retention_risk'
      : text.includes('new') || text.includes('convert') || text.includes('second')
      ? 'growth_opportunity'
      : text.includes('discount')
      ? 'discount_inefficiency'
      : 'growth_opportunity';

  const confidence = g.action_priority === 'high' ? 'high' : g.action_priority === 'medium' ? 'medium' : 'low';

  return {
    id: `fallback-${index}`,
    category,
    headline: g.action,
    explanation: `${g.customer_count} customer${g.customer_count !== 1 ? 's' : ''} need${g.customer_count === 1 ? 's' : ''} this action. Best channel: ${g.suggested_channel}. Timing: ${g.suggested_timing}.`,
    revenue_at_stake: g.total_revenue_at_stake,
    affected_count: g.customer_count,
    confidence,
    suggested_action: `${g.action} via ${g.suggested_channel}. ${g.suggested_timing}.`,
    flag_citations: [],
    data_logic: '',
    score: g.action_priority === 'high' ? 80 : g.action_priority === 'medium' ? 50 : 20,
    customer_keys: [],
  };
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const CATEGORY_META: Record<InsightCategory, { icon: React.ReactElement; label: string; color: string }> = {
  retention_risk: {
    icon: <AlertTriangle className="w-4 h-4" />,
    label: 'Retention Risk',
    color: 'text-red-600 bg-red-100',
  },
  growth_opportunity: {
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Growth Opportunity',
    color: 'text-green-600 bg-green-100',
  },
  discount_inefficiency: {
    icon: <Tag className="w-4 h-4" />,
    label: 'Discount Inefficiency',
    color: 'text-amber-600 bg-amber-100',
  },
  product_concentration: {
    icon: <BarChart3 className="w-4 h-4" />,
    label: 'Product Risk',
    color: 'text-blue-600 bg-blue-100',
  },
  cohort_quality: {
    icon: <Users className="w-4 h-4" />,
    label: 'Cohort Quality',
    color: 'text-purple-600 bg-purple-100',
  },
  customer_concentration: {
    icon: <BarChart3 className="w-4 h-4" />,
    label: 'Revenue Risk',
    color: 'text-orange-600 bg-orange-100',
  },
  seasonality: {
    icon: <TrendingUp className="w-4 h-4" />,
    label: 'Seasonality',
    color: 'text-sky-600 bg-sky-100',
  },
};

const CONFIDENCE_BADGE: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
};

const DEFAULT_SHOW = 3;

export const InsightBank: React.FC<InsightBankProps> = ({ currency, fallbackGroups }) => {
  const [insights, setInsights] = useState<BankInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const sessionRef = useRef<{ access_token: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        sessionRef.current = session;
        const res = await fetch('/api/insights/bank', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled && body.success) {
          setInsights(body.insights ?? []);
          setGeneratedAt(body.generated_at ?? null);
        }
      } catch { /* silently skip */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleDownload(insight: BankInsight) {
    setDownloading(d => ({ ...d, [insight.id]: true }));
    try {
      const session = sessionRef.current;
      if (!session) return;
      const res = await fetch(`/api/insights/download/insight/${insight.id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strategiq-insight-${insight.id}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(d => ({ ...d, [insight.id]: false }));
    }
  }

  const visible = showAll ? insights : insights.slice(0, DEFAULT_SHOW);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (insights.length === 0) {
    const fallbacks = (fallbackGroups ?? []).map(groupToFallbackCard);
    if (fallbacks.length > 0) {
      // Show action-group-based cards until user re-uploads for full bank
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>Re-upload your data to unlock deeper AI insights with revenue scoring and confidence levels.</span>
          </div>
          {fallbacks.map((insight) => {
            const meta = CATEGORY_META[insight.category] ?? {
              icon: <Brain className="w-4 h-4" />,
              label: insight.category,
              color: 'text-slate-600 bg-slate-100',
            };
            return (
              <div key={insight.id} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_BADGE[insight.confidence] ?? ''}`}>
                        {insight.confidence} priority
                      </span>
                    </div>
                    <h4 className="font-semibold text-sm text-slate-900 leading-snug">{insight.headline}</h4>
                  </div>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{insight.explanation}</p>
                {insight.revenue_at_stake > 0 && (
                  <div className="text-sm font-semibold text-green-600">
                    {formatCurrency(insight.revenue_at_stake, currency)} at stake
                  </div>
                )}
                <div className="flex items-start gap-2 bg-white rounded-lg p-3 border border-slate-100">
                  <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">{insight.suggested_action}</p>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div className="py-12 text-center text-slate-400">
        <Brain className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No insights yet</p>
        <p className="text-sm mt-1">
          Upload your orders to generate AI-powered recommendations from your customer data.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timestamp */}
      {generatedAt && (
        <p className="text-xs text-slate-400 text-right">
          Generated{' '}
          {new Date(generatedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </p>
      )}

      {visible.map((insight) => {
        const meta = CATEGORY_META[insight.category] ?? {
          icon: <Brain className="w-4 h-4" />,
          label: insight.category,
          color: 'text-slate-600 bg-slate-100',
        };
        const isDl = downloading[insight.id] ?? false;

        return (
          <div
            key={insight.id}
            className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100"
          >
            {/* Top row: icon + category + badges */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                  {meta.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONFIDENCE_BADGE[insight.confidence] ?? ''}`}>
                      {insight.confidence} confidence
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm text-slate-900 leading-snug">
                    {insight.headline}
                  </h4>
                </div>
              </div>

              {/* Download button */}
              {insight.customer_keys.length > 0 && (
                <button
                  onClick={() => handleDownload(insight)}
                  disabled={isDl}
                  title="Download affected customers as CSV"
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors disabled:opacity-50"
                >
                  {isDl ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Explanation */}
            <p className="text-sm text-slate-600 leading-relaxed">{insight.explanation}</p>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-3">
              {insight.revenue_at_stake > 0 && (
                <div className="text-sm font-semibold text-green-600">
                  {formatCurrency(insight.revenue_at_stake, currency)} at stake
                </div>
              )}
              {insight.affected_count > 0 && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5" />
                  {insight.affected_count} customer{insight.affected_count !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {/* Suggested action */}
            <div className="flex items-start gap-2 bg-white rounded-lg p-3 border border-slate-100">
              <Check className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700">{insight.suggested_action}</p>
            </div>

          </div>
        );
      })}

      {/* See all / collapse toggle */}
      {insights.length > DEFAULT_SHOW && (
        <button
          onClick={() => setShowAll(s => !s)}
          className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-xl transition-colors border border-purple-100"
        >
          {showAll ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show fewer
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              See all {insights.length} insights
            </>
          )}
        </button>
      )}
    </div>
  );
};
