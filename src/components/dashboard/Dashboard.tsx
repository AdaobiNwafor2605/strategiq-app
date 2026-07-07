import React, { useEffect, useState } from 'react';
import { BarChart3, Users, TrendingUp, AlertTriangle, Brain, Target, DollarSign, ShoppingCart, AlertCircle, Clock, Zap } from 'lucide-react';
import { supabase } from '../../contexts/AuthContext';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { Loader2 } from 'lucide-react';

type InsightCard = {
  icon: React.ReactElement;
  iconBg: string;
  title: string;
  description: string;
  impact: string | null;
  priority: 'high' | 'medium' | 'low';
};

function insightFromGroup(group: ActionGroup): InsightCard {
  const a = group.action.toLowerCase();
  const n = group.customer_count;
  const rev = group.total_revenue_at_stake;
  const impact = rev > 0
    ? `${n} customer${n !== 1 ? 's' : ''} · £${rev.toLocaleString('en-GB', { maximumFractionDigits: 0 })} revenue at stake`
    : `${n} customer${n !== 1 ? 's' : ''}`;

  if (a.includes('re-engagement') || a.includes("call, don't email")) {
    return {
      icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
      iconBg: 'bg-red-100',
      title: 'High-Value Customers Going Quiet',
      description: `${n} of your most valuable customers haven't purchased in 180+ days. A mass email won't cut it — these ones need a personal message.`,
      impact,
      priority: group.action_priority,
    };
  }
  if (a.includes('win-back')) {
    return {
      icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
      iconBg: 'bg-red-100',
      title: 'Win-Back Window Open',
      description: `${n} valuable customers have gone past 2× their usual buying gap. A targeted email with a genuine incentive can recover them before they go cold.`,
      impact,
      priority: group.action_priority,
    };
  }
  if (a.includes('vip') || a.includes('full price') && a.includes('no discount')) {
    return {
      icon: <BarChart3 className="w-4 h-4 text-green-600" />,
      iconBg: 'bg-green-100',
      title: 'Protect Your Full-Price Buyers',
      description: `${n} customers have never used a discount. Putting them in a sale campaign trains them to wait for deals — exclude them from every promotion.`,
      impact,
      priority: group.action_priority,
    };
  }
  if (a.includes('onboarding')) {
    return {
      icon: <Target className="w-4 h-4 text-yellow-600" />,
      iconBg: 'bg-yellow-100',
      title: 'New Customers Need Nurturing',
      description: `${n} customers made their first purchase recently. Early nurture is the highest-leverage retention activity — the next 60 days decide if they come back.`,
      impact,
      priority: group.action_priority,
    };
  }
  if (a.includes('second-purchase') || a.includes('nudge')) {
    return {
      icon: <TrendingUp className="w-4 h-4 text-blue-600" />,
      iconBg: 'bg-blue-100',
      title: 'Convert First-Time Buyers Now',
      description: `${n} one-time buyers are in their 30–60 day window. This is your best chance to turn them into repeat customers — don't let it pass.`,
      impact,
      priority: group.action_priority,
    };
  }
  if (a.includes('discount') || a.includes('full price')) {
    return {
      icon: <Brain className="w-4 h-4 text-purple-600" />,
      iconBg: 'bg-purple-100',
      title: 'Test Full-Price Conversion',
      description: `${n} customers have used discounts on most of their orders. Test whether they'll buy at full price — you may be leaving margin on the table.`,
      impact,
      priority: group.action_priority,
    };
  }
  return {
    icon: <Target className="w-4 h-4 text-slate-600" />,
    iconBg: 'bg-slate-100',
    title: group.action,
    description: `${n} customers in this segment.`,
    impact,
    priority: group.action_priority,
  };
}

interface DashboardMetrics {
  total_revenue: number;
  active_customers: number;
  average_order_value: number;
  churn_risk: number;
  revenue_forecast: Array<{ 
    period: string; 
    display_name: string; 
    revenue: number; 
    predicted_revenue?: number;
    type: 'actual' | 'validation' | 'forecast';
  }>;
  customer_segments: Array<{
    name: string;
    color: string;
    customers: number;
    total_revenue: number;
    avg_revenue: number;
  }>;
}

interface ActionGroup {
  action: string;
  action_priority: 'high' | 'medium' | 'low';
  customer_count: number;
  total_revenue_at_stake: number;
}

interface InsightSegment {
  name: string;
  customers: number;
  total_revenue: number;
  avg_revenue: number;
  color: string;
}

interface DashboardProps {
  uploadedAt?: string | null;
  isSampleData?: boolean;
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

export const Dashboard: React.FC<DashboardProps> = ({ data, uploadedAt, isSampleData }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionGroups, setActionGroups] = useState<ActionGroup[]>([]);
  const [actionSummaryGeneratedAt, setActionSummaryGeneratedAt] = useState<string | null>(null);
  const [insightSegments, setInsightSegments] = useState<InsightSegment[]>([]);

  useEffect(() => {
    const storedMetrics = localStorage.getItem('dashboardMetrics');
    if (storedMetrics) {
      setMetrics(JSON.parse(storedMetrics));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function fetchActionSummary() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch('/api/insights/action-summary', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const body = await res.json();
        if (body.success && body.summary) {
          setActionGroups(body.summary.groups ?? []);
          setActionSummaryGeneratedAt(body.summary.generated_at ?? null);
          setInsightSegments(body.summary.segments ?? []);
        }
      } catch {
        // Silently skip — insights not yet generated
      }
    }
    fetchActionSummary();
  }, []);

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

  // Helper function to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Helper function to check if a metric is available
  const isMetricAvailable = (value: any) => {
    return value !== undefined && value !== null;
  };

  // Prepare chart data from real ML forecast data
  const forecastData = data.revenue_forecast?.map((item) => ({
    month: item.display_name,
    // Green line: ALL actual data (historical + validation periods)
    actual: (item.type === 'actual' || item.type === 'validation') ? item.revenue : null,
    // Purple line: predictions for validation period + future forecasts
    forecast: (item.type === 'validation') ? item.predicted_revenue : 
              (item.type === 'forecast') ? item.revenue : null
  })) || [];

  const segmentData = data?.customer_segments?.map(segment => {
    const mappedSegment = {
      name: segment.name,
      revenue: segment.total_revenue,
      customers: segment.customers,
      avg_revenue: segment.avg_revenue,
      color: segment.color
    };
    return mappedSegment;
  }) || [];
  

  // Top 3 real insight cards — exclude the catch-all "Monitor" group
  const insightCards: InsightCard[] = actionGroups
    .filter(g => !g.action.toLowerCase().includes('monitor'))
    .slice(0, 3)
    .map(insightFromGroup);

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Freshness / sample data bar */}
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

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className={!isMetricAvailable(data.total_revenue) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Revenue</p>
                {isMetricAvailable(data.total_revenue) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {formatCurrency(data.total_revenue!)}
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

        <Card className={!isMetricAvailable(data.active_customers) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Active Customers</p>
                {isMetricAvailable(data.active_customers) ? (
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

        <Card className={!isMetricAvailable(data.average_order_value) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Average Order Value</p>
                {isMetricAvailable(data.average_order_value) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {formatCurrency(data.average_order_value!)}
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

        <Card className={!isMetricAvailable(data.churn_risk) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Churn Risk</p>
                {isMetricAvailable(data.churn_risk) ? (
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

      {/* Charts Row */}
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
                  <Tooltip formatter={(value) => [formatCurrency(value as number), '']} />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
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
        <Card className={insightSegments.length === 0 && segmentData.length === 0 ? 'opacity-50' : ''}>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Customer Segments</h3>
            <p className="text-sm text-slate-600">Who your customers are and what they're worth</p>
          </CardHeader>
          <CardContent>
            {insightSegments.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {insightSegments.map((segment, index) => (
                  <div
                    key={index}
                    className="relative rounded-xl p-4 text-white shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer transform hover:scale-[1.02] flex flex-col justify-between h-28"
                    style={{
                      backgroundColor: segment.color,
                      boxShadow: `0 4px 12px rgba(0,0,0,0.15)`,
                    }}
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-sm leading-tight text-white drop-shadow-sm">
                        {segment.name}
                      </h4>
                      <div className="text-xs text-white/90 font-medium">
                        {segment.customers.toLocaleString()} customer{segment.customers !== 1 ? 's' : ''}
                      </div>
                    </div>
                    <div>
                      <div className="font-semibold text-base text-white drop-shadow-sm">
                        £{segment.total_revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-white/80">
                        £{segment.avg_revenue.toFixed(0)} avg spend
                      </div>
                    </div>
                    <div className="absolute top-3 right-3 opacity-30">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div
                      className="absolute inset-0 rounded-xl opacity-10 pointer-events-none"
                      style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)' }}
                    />
                  </div>
                ))}
              </div>
            ) : segmentData.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {segmentData.map((segment, index) => (
                  <div
                    key={index}
                    className="relative rounded-xl p-4 text-white shadow-md hover:shadow-lg transition-all duration-200 flex flex-col justify-between h-28"
                    style={{ backgroundColor: segment.color }}
                  >
                    <div>
                      <h4 className="font-bold text-sm text-white">{segment.name}</h4>
                      <div className="text-xs text-white/90">{segment.customers.toLocaleString()} customers</div>
                    </div>
                    <div>
                      <div className="font-semibold text-base text-white">
                        £{segment.revenue.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-white/80">£{segment.avg_revenue.toFixed(0)} avg</div>
                    </div>
                  </div>
                ))}
              </div>
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

      {/* Weekly Action Summary */}
      {actionGroups.length > 0 && (
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
              {actionSummaryGeneratedAt && (
                <span className="text-xs text-slate-400">
                  Updated {new Date(actionSummaryGeneratedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-100">
              {actionGroups.map((group, i) => {
                const priorityStyles = {
                  high: { badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
                  medium: { badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-400' },
                  low: { badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' },
                };
                const style = priorityStyles[group.action_priority] ?? priorityStyles.low;

                return (
                  <div key={i} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 leading-tight">
                        {group.action}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {group.customer_count} customer{group.customer_count !== 1 ? 's' : ''}
                        {group.total_revenue_at_stake > 0 && (
                          <> · <span className="text-green-600 font-medium">{formatCurrency(group.total_revenue_at_stake)} at stake</span></>
                        )}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${style.badge}`}>
                      {group.action_priority}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI-Powered Insights — real data from customer pipeline */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-600" />
                AI-Powered Insights
              </h3>
              <p className="text-sm text-slate-600">
                Actionable recommendations based on your data
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {insightCards.length > 0 ? (
            <div className="space-y-4">
              {insightCards.map((card, i) => {
                const priorityBadge = {
                  high: 'bg-red-100 text-red-700',
                  medium: 'bg-yellow-100 text-yellow-700',
                  low: 'bg-green-100 text-green-700',
                }[card.priority];

                return (
                  <div key={i} className="flex items-start space-x-4 p-4 bg-slate-50 rounded-lg">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${card.iconBg}`}>
                      {card.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-slate-900">{card.title}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ml-2 ${priorityBadge}`}>
                          {card.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{card.description}</p>
                      {card.impact && (
                        <p className="text-sm font-medium text-green-600">{card.impact}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <Brain className="w-10 h-10 mx-auto mb-3 text-slate-300" />
              <p className="text-sm font-medium text-slate-500">No insights yet</p>
              <p className="text-sm mt-1">Upload your orders to see real recommendations based on your customer data.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};