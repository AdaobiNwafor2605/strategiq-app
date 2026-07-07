import React, { useEffect, useState } from 'react';
import { BarChart3, Users, TrendingUp, AlertTriangle, Brain, Target, Lock, DollarSign, ShoppingCart, AlertCircle, Clock, Zap } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '../ui/Card';
import { Button } from '../ui/Button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const mockSegmentData = [
  { name: 'High-Value', customers: 1200, revenue: 45000, color: '#8b5cf6' },
  { name: 'Frequent Buyers', customers: 2800, revenue: 32000, color: '#10b981' },
  { name: 'New Customers', customers: 1800, revenue: 18000, color: '#f59e0b' },
  { name: 'At Risk', customers: 800, revenue: 8000, color: '#f97316' }
];

const mockForecastData = [
  { month: 'Jan', predicted: 35000, actual: 32000 },
  { month: 'Feb', predicted: 38000, actual: 36000 },
  { month: 'Mar', predicted: 42000, actual: 40000 },
  { month: 'Apr', predicted: 45000, actual: 43000 },
  { month: 'May', predicted: 48000, actual: null },
  { month: 'Jun', predicted: 52000, actual: null }
];

const mockInsights = [
  {
    type: 'recommendation' as const,
    title: 'Bundle Opportunity Detected',
    description: 'Customers who buy "Silk Scarves" are 85% likely to purchase "Designer Handbags". Consider creating a bundle.',
    priority: 'high' as const,
    impact: '+£12K monthly revenue',
    requiresPro: false
  },
  {
    type: 'action' as const,
    title: 'High-Risk Customer Segment',
    description: '320 customers in the "Premium" segment haven\'t purchased in 45 days. Launch targeted retention campaign.',
    priority: 'high' as const,
    impact: 'Prevent £15K churn',
    requiresPro: true
  },
  {
    type: 'observation' as const,
    title: 'Seasonal Trend Identified',
    description: 'Summer dress sales typically increase 40% in May. Consider increasing inventory by April 15th.',
    priority: 'medium' as const,
    impact: '+£8K opportunity',
    requiresPro: true
  },
  {
    type: 'recommendation' as const,
    title: 'Cross-Sell Opportunity',
    description: 'Customers buying "Winter Coats" show 70% likelihood to purchase "Wool Accessories" within 30 days.',
    priority: 'medium' as const,
    impact: '+£5K monthly revenue',
    requiresPro: true
  }
];

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
  const { user } = useAuth();
  const isStarterPlan = user?.plan === 'starter';
  const isMicroPlan = user?.plan === 'micro';
  const hasLimitedAI = isStarterPlan || isMicroPlan;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedMetrics = localStorage.getItem('dashboardMetrics');
    if (storedMetrics) {
      setMetrics(JSON.parse(storedMetrics));
    }
    setLoading(false);
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
  

  // Filter insights based on plan
  const availableInsights = hasLimitedAI 
    ? mockInsights.filter(insight => !insight.requiresPro).slice(0, isStarterPlan ? 2 : 1)
    : mockInsights;

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
        <Card className={segmentData.length === 0 ? 'opacity-50' : ''}>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Build Automated Segments</h3>
            <p className="text-sm text-slate-600">AI-powered customer segmentation</p>
          </CardHeader>
          <CardContent>
            <h4 className="font-semibold text-slate-900 mb-4">RFM Customer Segments</h4>
            

            
            {data?.customer_segments && data.customer_segments.length > 0 ? (
              <div className="space-y-6">
                {/* Visual Segment Cards */}
                <div className="grid grid-cols-4 gap-4">
                  {segmentData
                    .sort((a, b) => b.customers - a.customers) // Sort by customer count descending
                    .map((segment, index) => {
                      // Use the color already assigned in segmentData
                      const segmentColor = segment.color;
                      
                      return (
                        <div 
                          key={index} 
                          className="relative rounded-xl p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:scale-105 flex flex-col justify-between h-32"
                          style={{ 
                            backgroundColor: segmentColor,
                            boxShadow: `0 4px 12px rgba(0,0,0,0.15), 0 0 0 1px ${segmentColor}`
                          }}
                        >
                          <div className="space-y-2 flex-1">
                            <h4 className="font-bold text-sm leading-tight text-white drop-shadow-sm">
                              {segment.name}
                            </h4>
                            <div className="space-y-1 text-xs text-white">
                              <div className="font-medium drop-shadow-sm">
                                {segment.customers.toLocaleString()} customers
                              </div>
                              <div className="font-semibold text-base drop-shadow-sm">
                                £{segment.revenue.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                              <div className="text-xs opacity-90 drop-shadow-sm">
                                £{segment.avg_revenue.toFixed(0)} avg
                              </div>
                            </div>
                          </div>
                          
                          {/* Icon with better visibility */}
                          <div className="absolute top-3 right-3 opacity-40">
                            <Users className="w-4 h-4 text-white drop-shadow-sm" />
                          </div>
                          
                          {/* Subtle gradient overlay for depth */}
                          <div 
                            className="absolute inset-0 rounded-xl opacity-10 pointer-events-none"
                            style={{
                              background: `linear-gradient(135deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 100%)`
                            }}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p>Upload data to generate customer segments</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card className="relative overflow-hidden">
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
        <CardContent className="relative">
          {/* Sample insights that are always visible */}
          <div className="space-y-4">
            {/* Sample Insight 1 */}
            <div className="flex items-start space-x-4 p-4 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-100">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-slate-900">High Churn Risk Detected</h4>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-red-100 text-red-700">
                    high
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">57 customers haven't purchased in 60+ days. Consider targeted re-engagement campaigns.</p>
                <p className="text-sm font-medium text-green-600">Potential revenue recovery: £2,250</p>
              </div>
            </div>

            {/* Sample Insight 2 */}
            <div className="flex items-start space-x-4 p-4 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-yellow-100">
                <Target className="w-4 h-4 text-yellow-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-slate-900">Upsell Opportunity</h4>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">
                    medium
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">Champions segment shows 40% higher purchase frequency. Target similar products to Loyal Customers.</p>
                <p className="text-sm font-medium text-green-600">Estimated revenue increase: £4,500</p>
              </div>
            </div>

            {/* Sample Insight 3 */}
            <div className="flex items-start space-x-4 p-4 bg-slate-50 rounded-lg">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-100">
                <BarChart3 className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-slate-900">Seasonal Trend Identified</h4>
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-700">
                    low
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">Revenue peaks detected in Q4. Prepare inventory and marketing campaigns 2 months early.</p>
                <p className="text-sm font-medium text-green-600">Optimize for 25% revenue boost</p>
              </div>
            </div>
          </div>

          {/* Overlay for upgrade prompt */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/80 to-white/95 flex items-center justify-center">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-200 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-slate-500" />
              </div>
              <h3 className="text-xl font-semibold text-slate-700 mb-2">
                Starter Membership required to unlock these insights
              </h3>
              <p className="text-slate-600 mb-6">
                Get AI-powered recommendations to grow your business
              </p>
              <Button className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2">
                Upgrade Plan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};