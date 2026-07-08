import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, Download, Check, Clock,
  Users, Loader2, Target, MessageSquare, Zap,
} from 'lucide-react';
import { supabase } from '../../contexts/AuthContext';
import type { ActionCustomer, ActionGroup, ActionPriority, ActionSummaryFull } from '../../types';
import { filterCustomersByAction, slugifyAction } from '../../utils/customerFilters';

interface ActionsListProps {
  groups: ActionGroup[];
  uploadId: string | null;
  currency: string;
  generatedAt: string | null;
  sessionCustomers?: Record<string, unknown>[];
  actionSummary?: ActionSummaryFull | null;
}

type PriorityFilter = 'all' | ActionPriority;

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const PRIORITY_BADGE: Record<ActionPriority, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};
const PRIORITY_DOT: Record<ActionPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-slate-300',
};
const CHANNEL_ICON: Record<string, React.ReactElement> = {
  'Email': <MessageSquare className="w-3 h-3" />,
  'Email / Ads': <Zap className="w-3 h-3" />,
  'Personal outreach': <Users className="w-3 h-3" />,
  'Regular comms': <MessageSquare className="w-3 h-3" />,
};

interface ExpandedCustomers {
  [actionKey: string]: { loading: boolean; data: ActionCustomer[] };
}

interface ActionStateMap {
  [actionKey: string]: { is_done: boolean; snoozed: boolean; snooze_upload_id: string | null };
}

export const ActionsList: React.FC<ActionsListProps> = ({
  groups,
  uploadId,
  currency,
  generatedAt,
  sessionCustomers = [],
  actionSummary = null,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [expandedData, setExpandedData] = useState<ExpandedCustomers>({});
  const [actionStates, setActionStates] = useState<ActionStateMap>({});
  const [pendingState, setPendingState] = useState<Record<string, boolean>>({});
  const sessionRef = useRef<{ access_token: string } | null>(null);

  // Load action states and cache session on mount
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      sessionRef.current = session;
      try {
        const res = await fetch('/api/insights/action-state', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (body.success) {
          const map: ActionStateMap = {};
          for (const s of (body.states ?? [])) {
            map[s.action_key] = {
              is_done: s.is_done,
              snoozed: s.snoozed,
              snooze_upload_id: s.snooze_upload_id ?? null,
            };
          }
          setActionStates(map);
        }
      } catch { /* ignore */ }
    }
    init();
  }, []);

  const filteredGroups = useMemo(() => {
    let list = groups.filter(g => !g.action.toLowerCase().includes('monitor'));
    if (priorityFilter !== 'all') {
      list = list.filter(g => g.action_priority === priorityFilter);
    }
    return list;
  }, [groups, priorityFilter]);

  const monitorGroup = useMemo(
    () => groups.find(g => g.action.toLowerCase().includes('monitor')),
    [groups],
  );

  const toggleExpanded = useCallback(async (actionKey: string, actionTitle: string) => {
    const isOpening = !expanded[actionKey];
    setExpanded(prev => ({ ...prev, [actionKey]: isOpening }));

    if (!isOpening || expandedData[actionKey]) return;

    setExpandedData(d => ({ ...d, [actionKey]: { loading: true, data: [] } }));

    try {
      let rows: ActionCustomer[] = [];
      const session = sessionRef.current ?? (await supabase.auth.getSession()).data.session;
      if (session) sessionRef.current = session;

      if (session) {
        const res = await fetch(`/api/insights/action-customers/${actionKey}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const body = await res.json();
          rows = body.customers ?? [];
        }
      }

      if (rows.length === 0 && sessionCustomers.length > 0) {
        rows = filterCustomersByAction(
          sessionCustomers,
          actionKey,
          actionTitle,
          actionSummary?.weekly_growth_plan as Record<string, unknown> | undefined,
        );
      }

      setExpandedData(d => ({
        ...d,
        [actionKey]: { loading: false, data: rows },
      }));
    } catch {
      setExpandedData(d => ({
        ...d,
        [actionKey]: {
          loading: false,
          data: filterCustomersByAction(
            sessionCustomers,
            actionKey,
            actionTitle,
            actionSummary?.weekly_growth_plan as Record<string, unknown> | undefined,
          ),
        },
      }));
    }
  }, [expanded, expandedData, sessionCustomers, actionSummary]);

  async function updateState(actionKey: string, patch: { is_done?: boolean; snoozed?: boolean }) {
    setPendingState(p => ({ ...p, [actionKey]: true }));
    const current = actionStates[actionKey] ?? { is_done: false, snoozed: false, snooze_upload_id: null };
    const next = {
      ...current,
      ...patch,
      snooze_upload_id: patch.snoozed ? (uploadId ?? null) : current.snooze_upload_id,
    };
    setActionStates(prev => ({ ...prev, [actionKey]: next }));
    try {
      const session = sessionRef.current;
      if (!session) return;
      await fetch('/api/insights/action-state', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action_key: actionKey,
          is_done: next.is_done,
          snoozed: next.snoozed,
          upload_id: uploadId,
        }),
      });
    } catch { /* revert on error */ } finally {
      setPendingState(p => ({ ...p, [actionKey]: false }));
    }
  }

  async function handleDownload(actionKey: string) {
    const session = sessionRef.current;
    if (!session) return;
    const res = await fetch(`/api/insights/download/action/${actionKey}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `strategiq-action-${actionKey}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Empty state
  if (groups.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400">
        <Target className="w-10 h-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-medium text-slate-500">You're all caught up</p>
        <p className="text-sm mt-1">Upload fresh data to generate your next action list.</p>
      </div>
    );
  }

  const filterButtons: PriorityFilter[] = ['all', 'high', 'medium', 'low'];
  const filterLabels: Record<PriorityFilter, string> = {
    all: 'All',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">Filter:</span>
        {filterButtons.map(f => (
          <button
            key={f}
            onClick={() => setPriorityFilter(f)}
            className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
              priorityFilter === f
                ? 'bg-purple-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {filterLabels[f]}
          </button>
        ))}
        {generatedAt && (
          <span className="ml-auto text-xs text-slate-400">
            Updated{' '}
            {new Date(generatedAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
      </div>

      {/* Empty filtered state */}
      {filteredGroups.length === 0 && (
        <div className="py-8 text-center text-slate-400">
          <p className="text-sm">No {priorityFilter} priority actions right now.</p>
        </div>
      )}

      {/* Action rows */}
      <div className="divide-y divide-slate-100">
        {filteredGroups.map((group) => {
          const actionKey = slugifyAction(group.action);
          const state = actionStates[actionKey] ?? { is_done: false, snoozed: false, snooze_upload_id: null };
          const isExpanded = expanded[actionKey] ?? false;
          const expandInfo = expandedData[actionKey];
          const isPending = pendingState[actionKey];

          // Snoozed only hides if the snooze was set for the CURRENT upload — expires on next upload
          const activelySnoozed = state.snoozed && (!state.snooze_upload_id || state.snooze_upload_id === uploadId);
          if (activelySnoozed) return null;

          return (
            <div
              key={actionKey}
              className={`transition-colors ${state.is_done ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3 py-3 first:pt-0">
                {/* Priority dot */}
                <div className="flex items-center h-5 mt-0.5">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      PRIORITY_DOT[group.action_priority] ?? 'bg-slate-300'
                    }`}
                  />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <button
                    className="w-full text-left"
                    onClick={() => toggleExpanded(actionKey, group.action)}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm font-medium text-slate-800 leading-tight ${
                          state.is_done ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {group.action}
                      </p>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500">
                      {group.customer_count} customer
                      {group.customer_count !== 1 ? 's' : ''}
                      {group.total_revenue_at_stake > 0 && (
                        <>
                          {' '}·{' '}
                          <span className="text-green-600 font-medium">
                            {formatCurrency(group.total_revenue_at_stake, currency)} at stake
                          </span>
                        </>
                      )}
                    </span>

                    {/* Channel badge */}
                    {group.suggested_channel && (
                      <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {CHANNEL_ICON[group.suggested_channel] ?? <MessageSquare className="w-3 h-3" />}
                        {group.suggested_channel}
                      </span>
                    )}

                    {/* Timing badge */}
                    {group.suggested_timing && (
                      <span className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                        <Clock className="w-3 h-3" />
                        {group.suggested_timing}
                      </span>
                    )}

                    {/* Priority badge */}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                        PRIORITY_BADGE[group.action_priority] ?? PRIORITY_BADGE.low
                      }`}
                    >
                      {group.action_priority}
                    </span>
                  </div>

                  {/* Expanded customer list */}
                  {isExpanded && (
                    <div className="mt-3 bg-slate-50 rounded-lg overflow-hidden">
                      {expandInfo?.loading ? (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                        </div>
                      ) : expandInfo && expandInfo.data.length > 0 ? (
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="text-left px-3 py-2 text-slate-500 font-semibold">Customer</th>
                              <th className="text-right px-3 py-2 text-slate-500 font-semibold">Spent</th>
                              <th className="text-right px-3 py-2 text-slate-500 font-semibold hidden sm:table-cell">Last Order</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {expandInfo.data.slice(0, 20).map((c, i) => (
                              <tr key={i} className="hover:bg-slate-100/50">
                                <td className="px-3 py-2 text-slate-700 truncate max-w-[160px]">
                                  {c.email_or_id}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-700 font-medium">
                                  {formatCurrency(c.total_revenue, currency)}
                                </td>
                                <td className="px-3 py-2 text-right text-slate-500 hidden sm:table-cell">
                                  {c.last_order_date || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-xs text-slate-400 p-3 text-center">No customers found.</p>
                      )}
                      {expandInfo && expandInfo.data.length > 20 && (
                        <p className="text-xs text-slate-400 px-3 pb-2 text-center">
                          Showing top 20 of {expandInfo.data.length} — download CSV to see all.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                  {/* Download CSV */}
                  <button
                    onClick={() => handleDownload(actionKey)}
                    title="Download CSV"
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {/* Snooze */}
                  <button
                    onClick={() => updateState(actionKey, { snoozed: !state.snoozed })}
                    title="Snooze until next upload"
                    disabled={isPending}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-50"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>

                  {/* Mark done */}
                  <button
                    onClick={() => updateState(actionKey, { is_done: !state.is_done })}
                    title={state.is_done ? 'Mark as not done' : 'Mark as done'}
                    disabled={isPending}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${
                      state.is_done
                        ? 'bg-green-100 text-green-600'
                        : 'text-slate-400 hover:bg-green-50 hover:text-green-600'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Monitor group — shown at the bottom in muted style */}
      {monitorGroup && priorityFilter === 'all' && (
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-center gap-3 py-2 opacity-50">
            <div className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-500">{monitorGroup.action}</p>
              <p className="text-xs text-slate-400">
                {monitorGroup.customer_count} customer
                {monitorGroup.customer_count !== 1 ? 's' : ''} — no immediate action needed
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
