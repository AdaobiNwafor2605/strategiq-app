import React, { useEffect, useState } from 'react';
import { BarChart3, Users, TrendingUp, AlertTriangle, Brain, Target, Lock, DollarSign, ShoppingCart, AlertCircle } from 'lucide-react';
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
  avg_order_value: number;
  churn_risk_percentage: number;
  revenue_forecast: Array<{ 
    period: string; 
    display_name: string; 
    revenue: number; 
    predicted_revenue?: number;
    type: 'actual' | 'validation' | 'forecast';
  }>;
  customer_segments: Array<{
    name: string;
    count: number;
    revenue: number;
    description: string;
  }>;
}

interface DashboardProps {
  data: {
    total_revenue?: number;
    active_customers?: number;
    avg_order_value?: number;
    churn_risk_percentage?: number;
    revenue_forecast?: Array<{ 
      period: string; 
      display_name: string; 
      revenue: number; 
      predicted_revenue?: number;
      type: 'actual' | 'validation' | 'forecast';
    }>;
    customer_segments?: Array<{
      name: string;
      count: number;
      revenue: number;
      description: string;
    }>;
  } | null;
}

export const Dashboard: React.FC<DashboardProps> = ({ data }) => {
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
    return value !== undefined && value !== null && value !== 0;
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

  const segmentData = data.customer_segments?.map(segment => ({
    name: segment.name,
    revenue: segment.revenue,
    customers: segment.count,
    color: segment.name === 'High Value' ? '#8b5cf6' :
           segment.name === 'At Risk' ? '#f97316' :
           segment.name === 'New' ? '#10b981' : '#f59e0b'
  })) || [];

  // Filter insights based on plan
  const availableInsights = hasLimitedAI 
    ? mockInsights.filter(insight => !insight.requiresPro).slice(0, isStarterPlan ? 2 : 1)
    : mockInsights;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
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

        <Card className={!isMetricAvailable(data.avg_order_value) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Average Order Value</p>
                {isMetricAvailable(data.avg_order_value) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {formatCurrency(data.avg_order_value!)}
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

        <Card className={!isMetricAvailable(data.churn_risk_percentage) ? 'opacity-50' : ''}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Churn Risk</p>
                {isMetricAvailable(data.churn_risk_percentage) ? (
                  <h3 className="text-2xl font-bold text-slate-900">
                    {data.churn_risk_percentage!.toFixed(1)}%
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
            <h3 className="text-lg font-semibold text-slate-900">Customer Segments</h3>
            <p className="text-sm text-slate-600">Revenue by customer type</p>
          </CardHeader>
          <CardContent>
            {segmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={segmentData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="revenue"
                    label={({ name, value }) => `${name}: ${formatCurrency(value)}`}
                  >
                    {segmentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                Not Available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-600" />
                AI-Powered Insights
                {hasLimitedAI && (
                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                    {isStarterPlan ? 'Limited (2/10 monthly)' : 'Limited (1/5 monthly)'}
                  </span>
                )}
              </h3>
              <p className="text-sm text-slate-600">
                {hasLimitedAI 
                  ? 'Actionable recommendations based on your data. Upgrade for unlimited insights.'
                  : 'Actionable recommendations based on your data'
                }
              </p>
            </div>
            <div className="flex space-x-2">
              {hasLimitedAI && (
                <Button variant="outline" size="sm">
                  Upgrade Plan
                </Button>
              )}
              <Button variant="outline" size="sm">View All</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {availableInsights.map((insight, index) => (
              <div key={index} className="flex items-start space-x-4 p-4 bg-slate-50 rounded-lg">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  insight.priority === 'high' 
                    ? 'bg-red-100' 
                    : insight.priority === 'medium' 
                    ? 'bg-yellow-100' 
                    : 'bg-green-100'
                }`}>
                  {insight.type === 'recommendation' ? (
                    <Target className={`w-4 h-4 ${
                      insight.priority === 'high' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                  ) : insight.type === 'action' ? (
                    <AlertTriangle className={`w-4 h-4 ${
                      insight.priority === 'high' ? 'text-red-600' : 'text-yellow-600'
                    }`} />
                  ) : (
                    <BarChart3 className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-slate-900">{insight.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      insight.priority === 'high' 
                        ? 'bg-red-100 text-red-700' 
                        : insight.priority === 'medium' 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-green-100 text-green-700'
                    }`}>
                      {insight.priority}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{insight.description}</p>
                  <p className="text-sm font-medium text-green-600">{insight.impact}</p>
                </div>
              </div>
            ))}
            
            {/* Locked insights for limited plans */}
            {hasLimitedAI && mockInsights.filter(insight => insight.requiresPro).slice(0, 2).map((insight, index) => (
              <div key={`locked-${index}`} className="flex items-start space-x-4 p-4 bg-slate-100 rounded-lg opacity-60 relative">
                <div className="absolute inset-0 bg-slate-200 bg-opacity-50 rounded-lg flex items-center justify-center">
                  <div className="bg-white rounded-lg p-3 shadow-sm flex items-center space-x-2">
                    <Lock className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">Upgrade to unlock</span>
                  </div>
                </div>
                <div className="w-8 h-8 bg-slate-300 rounded-lg flex items-center justify-center">
                  <Brain className="w-4 h-4 text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-slate-500">Advanced AI Insight</h4>
                    <span className="text-xs px-2 py-1 rounded-full font-medium bg-slate-200 text-slate-500">
                      Pro
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mb-2">Unlock advanced AI recommendations with Professional plan</p>
                  <p className="text-sm font-medium text-slate-500">Potential high impact</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};