import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Loader2, Users } from 'lucide-react';
import { supabase } from '../../contexts/AuthContext';
import type { SegmentCustomer } from '../../types';
import { filterCustomersBySegment } from '../../utils/customerFilters';

interface SegmentModalProps {
  segmentName: string;
  segmentColor: string;
  currency: string;
  sessionCustomers?: Record<string, unknown>[];
  onClose: () => void;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function deriveCustomerName(customer: SegmentCustomer): string {
  if (customer.name && customer.name.trim()) return customer.name;
  const source = customer.email ?? customer.email_or_id ?? '';
  if (source.includes('@')) {
    const local = source.split('@')[0];
    return local
      .replace(/[._-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || 'Unknown';
  }
  return 'Unknown';
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

export const SegmentModal: React.FC<SegmentModalProps> = ({
  segmentName,
  segmentColor,
  currency,
  sessionCustomers = [],
  onClose,
}) => {
  const [customers, setCustomers] = useState<SegmentCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) {
            setCustomers(filterCustomersBySegment(sessionCustomers, segmentName));
          }
          return;
        }
        const res = await fetch(
          `/api/insights/segment-customers/${encodeURIComponent(segmentName)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (res.ok) {
          const body = await res.json();
          if (!cancelled && body.success && body.customers?.length > 0) {
            setCustomers(body.customers ?? []);
            return;
          }
        }
        if (!cancelled) {
          setCustomers(filterCustomersBySegment(sessionCustomers, segmentName));
        }
      } catch {
        if (!cancelled) {
          setCustomers(filterCustomersBySegment(sessionCustomers, segmentName));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [segmentName, sessionCustomers]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  async function handleDownload() {
    setDownloading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const safeName = segmentName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const res = await fetch(
        `/api/insights/download/segment/${encodeURIComponent(segmentName)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `strategiq-segment-${safeName}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 rounded-t-2xl"
          style={{ backgroundColor: segmentColor }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{segmentName}</h2>
              {!loading && (
                <p className="text-xs text-white/80">
                  {customers.length} customer{customers.length !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              CSV
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Users className="w-8 h-8 mb-2" />
              <p className="text-sm">No customers in this segment yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Email / ID</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Total Spent</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600">Orders</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-600 hidden sm:table-cell">Last Order</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {customers.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-slate-800 font-medium truncate max-w-[160px]">
                      {deriveCustomerName(c)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 truncate max-w-[220px]">
                      {c.email ?? c.email_or_id}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-800 font-semibold">
                      {formatCurrency(c.total_revenue, currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {c.order_count}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 hidden sm:table-cell">
                      {c.last_order_date || '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
                          PRIORITY_BADGE[c.action_priority] ?? PRIORITY_BADGE.low
                        }`}
                      >
                        {c.recommended_action.length > 35
                          ? c.recommended_action.slice(0, 35) + '…'
                          : c.recommended_action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
