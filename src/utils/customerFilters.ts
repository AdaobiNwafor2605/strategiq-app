import type { ActionCustomer, ActionPriority, SegmentCustomer } from '../types';

export function slugifyAction(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function effectiveSegment(customer: Record<string, unknown>): string {
  const stored = customer._segment;
  if (typeof stored === 'string' && stored.trim()) return stored;
  if (customer.is_lapsed) return 'Lapsed';
  if (customer.is_high_value && customer.is_full_price_loyal) return 'VIPs';
  if (customer.is_at_risk) return 'Going Quiet';
  if (customer.is_new_customer) return 'New Customers';
  if (customer.is_one_time_buyer) return 'One-Time Buyers';
  if (customer.is_discount_dependent) return 'Discount Shoppers';
  return 'Regulars';
}

function customerKey(customer: Record<string, unknown>): string {
  return String(customer.customer_email ?? customer.customer_id ?? '');
}

function formatDate(value: unknown): string {
  if (!value) return '';
  const text = String(value);
  try {
    return new Date(text).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return text;
  }
}

export function toSegmentCustomer(customer: Record<string, unknown>): SegmentCustomer {
  const emailOrId = customerKey(customer);
  return {
    email_or_id: emailOrId,
    email: customer.customer_email ? String(customer.customer_email) : undefined,
    name: customer.customer_name ? String(customer.customer_name) : undefined,
    total_revenue: Number(customer.total_revenue ?? 0),
    order_count: Number(customer.order_count ?? 0),
    last_order_date: formatDate(customer.last_order_date),
    days_since_last_order: Number(customer.days_since_last_order ?? -1),
    aov: Number(customer.aov ?? 0),
    recommended_action: String(customer.recommended_action ?? ''),
    action_priority: (customer.action_priority as ActionPriority) ?? 'low',
  };
}

export function toActionCustomer(customer: Record<string, unknown>): ActionCustomer {
  return {
    email_or_id: customerKey(customer),
    total_revenue: Number(customer.total_revenue ?? 0),
    order_count: Number(customer.order_count ?? 0),
    last_order_date: formatDate(customer.last_order_date),
    reason: String(customer.action_reason ?? ''),
    channel: String(customer.suggested_channel ?? ''),
    timing: String(customer.suggested_timing ?? ''),
  };
}

export function filterCustomersBySegment(
  customers: Record<string, unknown>[],
  segmentName: string,
): SegmentCustomer[] {
  return customers
    .filter((c) => effectiveSegment(c) === segmentName)
    .map(toSegmentCustomer)
    .sort((a, b) => b.total_revenue - a.total_revenue);
}

export function filterCustomersByAction(
  customers: Record<string, unknown>[],
  actionKey: string,
  actionTitle?: string,
  weeklyGrowthPlan?: Record<string, unknown>,
): ActionCustomer[] {
  const byKey = new Map<string, Record<string, unknown>>();
  for (const customer of customers) {
    const key = customerKey(customer);
    if (key) byKey.set(key, customer);
  }

  if (weeklyGrowthPlan) {
    const ids: string[] = [];
    for (const section of (weeklyGrowthPlan.sections as Record<string, unknown>[]) ?? []) {
      for (const action of (section.actions as Record<string, unknown>[]) ?? []) {
        if (slugifyAction(String(action.action ?? '')) === actionKey) {
          ids.push(...((action.customer_ids as string[]) ?? []).map(String));
        }
      }
    }
    if (ids.length > 0) {
      const matched = ids
        .map((id) => byKey.get(id))
        .filter((c): c is Record<string, unknown> => Boolean(c))
        .map(toActionCustomer);
      if (matched.length > 0) {
        return matched.sort((a, b) => b.total_revenue - a.total_revenue);
      }
    }
  }

  return customers
    .filter((c) => {
      const action = String(c.recommended_action ?? '');
      return slugifyAction(action) === actionKey
        || (actionTitle ? action === actionTitle : false);
    })
    .map(toActionCustomer)
    .sort((a, b) => b.total_revenue - a.total_revenue);
}
