import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import type { InsightSegment } from '../../types';

const SEGMENT_INFO: Record<string, {
  description: string;
  why: string;
  how_to_treat: string;
  typical_pct: string;
}> = {
  VIPs: {
    description: 'Your highest-value, full-price loyal buyers.',
    why: 'They generate the most revenue and buy without needing a discount — protecting them from promotion lists preserves your margins.',
    how_to_treat: 'Reward with exclusivity (early access, personal notes) — never with discounts.',
    typical_pct: '5–10% of customers, 25–40% of revenue',
  },
  Regulars: {
    description: 'Repeat buyers who purchase at a steady pace.',
    why: 'These customers drive the backbone of your recurring revenue and are most likely to refer others.',
    how_to_treat: 'Stay top of mind with consistent communication. Personalise by most-bought product.',
    typical_pct: '15–25% of customers, 30–40% of revenue',
  },
  'New Customers': {
    description: 'First-time buyers in the last 30 days.',
    why: 'The 30-day post-purchase window is the highest-leverage retention moment. Most churn happens here.',
    how_to_treat: 'Send an onboarding sequence (3–4 emails). Make them feel noticed — not like a batch send.',
    typical_pct: '10–20% per month in a growing brand',
  },
  'One-Time Buyers': {
    description: 'Customers who bought exactly once.',
    why: '60–80% of first-time buyers never return without a specific nudge. This is your biggest revenue leak.',
    how_to_treat: 'Send a second-purchase nudge at 30–45 days. Use the product they bought to personalise it.',
    typical_pct: '30–50% of total base — should shrink over time',
  },
  'Going Quiet': {
    description: 'Repeat buyers who are overdue by their own standards.',
    why: "They've shown they can buy again — they just haven't. Targeted re-engagement recovers 10–20% of this group.",
    how_to_treat: 'Personal re-engagement email referencing their last product. Not a batch discount blast.',
    typical_pct: '5–15% of customers',
  },
  Lapsed: {
    description: 'Customers with no purchase in 180+ days.',
    why: 'Still worth trying — the cost to win back a lapsed customer is 5× cheaper than acquiring a new one.',
    how_to_treat: 'One targeted win-back attempt, then move them to a low-frequency list. Don\'t spam.',
    typical_pct: 'Under 15% is healthy — above 25% signals a retention emergency',
  },
  'Discount Shoppers': {
    description: 'Buyers who used a discount on 70%+ of their orders.',
    why: 'Discount-dependent customers squeeze margin and anchor to sale prices over time.',
    how_to_treat: "Test removing them from your next promotion. Some will buy anyway. Those who don't — that's their real LTV.",
    typical_pct: 'Under 15% is healthy',
  },
};

function normalizeSegmentName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

interface SegmentCardProps {
  segment: InsightSegment;
  totalRevenue: number;
  currency: string;
  onView: (name: string) => void;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export const SegmentCard: React.FC<SegmentCardProps> = ({
  segment,
  totalRevenue,
  currency,
  onView,
}) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const info =
    SEGMENT_INFO[segment.name] ??
    Object.entries(SEGMENT_INFO).find(
      ([key]) => normalizeSegmentName(key) === normalizeSegmentName(segment.name),
    )?.[1];
  const description = segment.description || info?.description || '';
  const why = segment.why || info?.why || '';
  const how_to_treat = segment.how_to_treat || info?.how_to_treat || '';
  const typical_pct = segment.typical_pct || info?.typical_pct || '';
  const hasInfo = !!(description || why || how_to_treat || typical_pct);

  const revPct =
    segment.revenue_pct !== undefined
      ? segment.revenue_pct
      : totalRevenue > 0
      ? Math.round((segment.total_revenue / totalRevenue) * 100 * 10) / 10
      : 0;

  const hasTrend = segment.delta_customers !== undefined && segment.delta_customers !== 0;
  const trendUp = (segment.delta_customers ?? 0) > 0;
  const hasRevTrend = segment.delta_revenue !== undefined && segment.delta_revenue !== 0;

  function showTooltip() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const tooltipWidth = 288; // w-72
      let left = rect.left;
      // Don't go off the right edge of the screen
      if (left + tooltipWidth > window.innerWidth - 8) {
        left = window.innerWidth - tooltipWidth - 8;
      }
      setTooltipPos({ top: rect.bottom + 8, left });
    }
    setTooltipOpen(true);
  }

  function hideTooltip() {
    closeTimer.current = setTimeout(() => setTooltipOpen(false), 150);
  }

  function cancelHide() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }

  function toggleTooltip(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (tooltipOpen) {
      setTooltipOpen(false);
      return;
    }
    showTooltip();
  }

  return (
    <div
      className="rounded-xl p-4 text-white shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-[1.02] flex flex-col justify-between min-h-[130px] relative overflow-visible"
      style={{ backgroundColor: segment.color, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}
      onClick={() => onView(segment.name)}
      role="button"
      tabIndex={0}
      aria-label={`View ${segment.name} customers`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onView(segment.name); }}
    >
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 rounded-xl opacity-10 pointer-events-none"
        style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)' }}
      />

      {/* Top row: name + info icon */}
      <div className="flex items-start justify-between gap-1">
        <h4 className="font-bold text-sm leading-tight text-white drop-shadow-sm">
          {segment.name}
        </h4>

        {hasInfo && (
          <button
            ref={btnRef}
            type="button"
            className="shrink-0 w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
            onClick={toggleTooltip}
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
            onFocus={showTooltip}
            onBlur={hideTooltip}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setTooltipOpen(false);
              }
            }}
            aria-label={`What is ${segment.name}?`}
            aria-haspopup="dialog"
            aria-expanded={tooltipOpen}
          >
            <Info className="w-3 h-3 text-white" />
          </button>
        )}
      </div>

      {/* Customer count */}
      <div className="text-xs text-white/90 font-medium mt-1">
        {segment.customers.toLocaleString()} customer{segment.customers !== 1 ? 's' : ''}
      </div>

      {(hasTrend || hasRevTrend) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-white/80 mt-0.5">
          {hasTrend && (
            <span className="inline-flex items-center gap-1">
              {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendUp ? '+' : ''}
              {segment.delta_customers} customers
            </span>
          )}
          {hasRevTrend && (
            <span className="inline-flex items-center gap-1">
              {(segment.delta_revenue ?? 0) > 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {(segment.delta_revenue ?? 0) > 0 ? '+' : ''}
              {formatCurrency(segment.delta_revenue ?? 0, currency)}
            </span>
          )}
        </div>
      )}

      {/* Revenue block */}
      <div className="mt-2">
        <div className="font-semibold text-base text-white drop-shadow-sm">
          {formatCurrency(segment.total_revenue, currency)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/80">
            {formatCurrency(segment.avg_revenue, currency)} avg spend
          </span>
          <span className="text-xs font-semibold bg-white/20 rounded-full px-2 py-0.5">
            {revPct}% of rev
          </span>
        </div>
        {(hasTrend || hasRevTrend) && (
          <div className="text-xs text-white/70 mt-0.5">vs previous upload</div>
        )}
      </div>

      {/* Tooltip — rendered into document.body so it's never clipped */}
      {tooltipOpen && hasInfo && createPortal(
        <div
          style={{ position: 'fixed', top: tooltipPos.top, left: tooltipPos.left, zIndex: 9999, width: 288 }}
          className="rounded-xl bg-white text-slate-800 shadow-2xl p-4 space-y-2.5 text-xs border border-slate-100"
          role="tooltip"
          onMouseEnter={cancelHide}
          onMouseLeave={hideTooltip}
        >
          {description && (
            <p className="font-semibold text-sm text-slate-900">{description}</p>
          )}
          {why && (
            <div>
              <span className="font-semibold text-slate-700">Why it matters: </span>
              <span className="text-slate-600">{why}</span>
            </div>
          )}
          {how_to_treat && (
            <div>
              <span className="font-semibold text-slate-700">How to treat: </span>
              <span className="text-slate-600">{how_to_treat}</span>
            </div>
          )}
          {typical_pct && (
            <div>
              <span className="font-semibold text-slate-700">Healthy range: </span>
              <span className="text-slate-600">{typical_pct}</span>
            </div>
          )}
          <p className="text-slate-400 pt-1 border-t border-slate-100">Click the card to see the full customer list</p>
        </div>,
        document.body
      )}
    </div>
  );
};
