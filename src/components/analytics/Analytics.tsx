import React, { useState, useEffect } from 'react';
import { 
  BarChart3, ShoppingBag, RefreshCcw, Users, AlertTriangle, 
  TrendingUp, Brain, Package, ShoppingCart, UserCheck, 
  Calendar, Target, Zap, MapPin, DollarSign, TrendingDown,
  ArrowUp, ArrowDown, Activity, Star, Globe, Crown, Lock
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  Area, AreaChart, ComposedChart
} from 'recharts';
import {
  AnalyticsProps, TopProductsResponse, AOVTrendsResponse,
  CustomerAnalysisResponse, GeographicResponse, OrderVolumeResponse,
  RevenuePerCustomerResponse, RevenueTrendsResponse
} from '../../types';
import { supabase } from '../../contexts/AuthContext';

const COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#3b82f6', '#8b5cf6'];

interface AnalyticsExtendedProps extends AnalyticsProps {
  onPremiumFeaturesClick?: () => void;
}

export const Analytics: React.FC<AnalyticsExtendedProps> = ({ data, onPremiumFeaturesClick }) => {
  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [topProductsData, setTopProductsData] = useState<TopProductsResponse | null>(null);
  const [aovTrendsData, setAovTrendsData] = useState<AOVTrendsResponse | null>(null);
  const [customerAnalysisData, setCustomerAnalysisData] = useState<CustomerAnalysisResponse | null>(null);
  const [geographicData, setGeographicData] = useState<GeographicResponse | null>(null);
  const [orderVolumeData, setOrderVolumeData] = useState<OrderVolumeResponse | null>(null);
  const [revenuePerCustomerData, setRevenuePerCustomerData] = useState<RevenuePerCustomerResponse | null>(null);
  const [revenueTrendsData, setRevenueTrendsData] = useState<RevenueTrendsResponse | null>(null);
  const [dataInsights, setDataInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const authHeader = async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return {};
    return { Authorization: `Bearer ${session.access_token}` };
  };

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      const headers = await authHeader();
      const endpoints = [
        fetch(`/api/analytics/top-products?limit=10&sort_by=revenue`, { headers }),
        fetch(`/api/analytics/aov-trends?period=${selectedPeriod}`, { headers }),
        fetch(`/api/analytics/customer-analysis`, { headers }),
        fetch(`/api/analytics/geographic-analysis`, { headers }),
        fetch(`/api/analytics/order-volume-trends?period=${selectedPeriod}`, { headers }),
        fetch(`/api/analytics/revenue-per-customer`, { headers }),
        fetch(`/api/analytics/revenue-trends?period=${selectedPeriod}`, { headers }),
        fetch(`/api/analytics/data-insights-check`, { headers })
      ];

      const [
        topProductsRes, aovTrendsRes, customerAnalysisRes, 
        geographicRes, orderVolumeRes, revenuePerCustomerRes, revenueTrendsRes, dataInsightsRes
      ] = await Promise.all(endpoints);

      const [
        topProducts, aovTrends, customerAnalysis,
        geographic, orderVolume, revenuePerCustomer, revenueTrends, dataInsightsData
      ] = await Promise.all([
        topProductsRes.json(), aovTrendsRes.json(), customerAnalysisRes.json(),
        geographicRes.json(), orderVolumeRes.json(), revenuePerCustomerRes.json(), 
        revenueTrendsRes.json(), dataInsightsRes.json()
      ]);

      setTopProductsData(topProducts.error ? null : topProducts);
      setAovTrendsData(aovTrends.error ? null : aovTrends);
      setCustomerAnalysisData(customerAnalysis.error ? null : customerAnalysis);
      setGeographicData(geographic.error ? null : geographic);
      setOrderVolumeData(orderVolume.error ? null : orderVolume);
      setRevenuePerCustomerData(revenuePerCustomer.error ? null : revenuePerCustomer);
      setRevenueTrendsData(revenueTrends.error ? null : revenueTrends);
      setDataInsights(dataInsightsData.error ? null : dataInsightsData);
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedPeriod]);

  const formatCurrency = (value: number) => `£${value.toLocaleString()}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Advanced Analytics</h1>
          <p className="text-slate-600">Comprehensive insights from your uploaded data</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex bg-white rounded-lg p-1 shadow-sm">
            {(['daily', 'weekly', 'monthly'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setSelectedPeriod(period)}
                className={`px-3 py-1 rounded-md text-sm font-medium capitalize transition-colors ${
                  selectedPeriod === period
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-3">
            <Button onClick={fetchAnalyticsData} disabled={loading}>
              <RefreshCcw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            {onPremiumFeaturesClick && (
              <Button 
                onClick={onPremiumFeaturesClick}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                <Crown className="w-4 h-4 mr-2" />
                Premium Features
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {formatCurrency(data.total_revenue)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Active Customers</p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {data.active_customers.toLocaleString()}
                </h3>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Average Order Value</p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {formatCurrency(data.average_order_value)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Churn Risk</p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  {formatPercent(data.churn_risk)}
                </h3>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Overview */}
      {dataInsights && dataInsights.data_overview && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-slate-600" />
              Data Overview
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">Total Rows</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {dataInsights.data_overview.total_rows?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">Unique Customers</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {dataInsights.data_overview.unique_customers?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">Unique Orders</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {dataInsights.data_overview.unique_orders?.toLocaleString() || '0'}
                </p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <p className="text-sm text-slate-600">Unique Products</p>
                <p className="text-2xl font-semibold text-slate-900">
                  {dataInsights.data_overview.unique_products?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Revenue Over Time */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-purple-600" />
            Revenue Over Time
          </h3>
        </CardHeader>
        <CardContent>
          {revenueTrendsData?.data ? (
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={revenueTrendsData.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip 
                  formatter={(value, name) => [
                    name === 'revenue' ? formatCurrency(Number(value)) : value,
                    name === 'revenue' ? 'Revenue' : 'Orders'
                  ]}
                />
                <Bar yAxisId="right" dataKey="orders" fill="#8b5cf6" name="orders" />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="revenue" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              {loading ? 'Loading revenue trends...' : 'No revenue data available'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Products & AOV Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Star className="w-5 h-5 mr-2 text-yellow-600" />
              Top Products
            </h3>
          </CardHeader>
          <CardContent>
            {topProductsData?.data ? (
              <div className="space-y-4">
                {topProductsData.data.slice(0, 5).map((product, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-purple-700">#{index + 1}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{product.product_name}</h4>
                        <p className="text-sm text-slate-600">{product.total_quantity} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900">{formatCurrency(product.total_revenue)}</p>
                      <p className="text-sm text-slate-600">{formatCurrency(product.avg_unit_price)}/unit</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                {loading ? 'Loading top products...' : 'No product data available'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* AOV Trends */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-green-600" />
              Average Order Value Trends
            </h3>
          </CardHeader>
          <CardContent>
            {aovTrendsData?.data ? (
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={aovTrendsData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatCurrency(Number(value)), 'AOV']} />
                  <Area type="monotone" dataKey="aov" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                {loading ? 'Loading AOV trends...' : 'No AOV data available'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Analysis */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <UserCheck className="w-5 h-5 mr-2 text-blue-600" />
            Returning vs New Customers
          </h3>
        </CardHeader>
        <CardContent>
          {customerAnalysisData?.data ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={customerAnalysisData.data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="new_customers" stackId="a" fill="#3b82f6" name="New Customers" />
                <Bar dataKey="returning_customers" stackId="a" fill="#10b981" name="Returning Customers" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              {loading ? 'Loading customer analysis...' : 'No customer data available'}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geographic Analysis & Order Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Geographic Analysis */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Globe className="w-5 h-5 mr-2 text-indigo-600" />
              Geographic Distribution
            </h3>
          </CardHeader>
          <CardContent>
            {geographicData?.data ? (
              <div className="space-y-3">
                {geographicData.data.slice(0, 8).map((location, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <MapPin className="w-4 h-4 text-indigo-600" />
                      <span className="font-medium text-slate-900">{location.location}</span>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-slate-900">{formatCurrency(location.total_revenue)}</p>
                      <p className="text-sm text-slate-600">{location.unique_customers} customers</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                {loading ? 'Loading geographic data...' : 'No location data available'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Order Volume Trends */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Package className="w-5 h-5 mr-2 text-orange-600" />
              Order Volume Trends
            </h3>
          </CardHeader>
          <CardContent>
            {orderVolumeData?.data ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={orderVolumeData.data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="order_count" stroke="#f59e0b" strokeWidth={3} name="Orders" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex items-center justify-center text-slate-500">
                {loading ? 'Loading order volume...' : 'No order volume data available'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue per Customer */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Target className="w-5 h-5 mr-2 text-pink-600" />
            Revenue per Customer Analysis
          </h3>
        </CardHeader>
        <CardContent>
          {revenuePerCustomerData ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Total Customers</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {revenuePerCustomerData.summary.total_customers.toLocaleString()}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Total Revenue</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {formatCurrency(revenuePerCustomerData.summary.total_revenue)}
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Avg Revenue/Customer</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {formatCurrency(revenuePerCustomerData.summary.avg_revenue_per_customer)}
                  </p>
                </div>
              </div>

              {/* Customer Segments */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {revenuePerCustomerData.segments.map((segment, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-slate-900">{segment.segment}</h4>
                      <span className={`w-3 h-3 rounded-full ${
                        segment.segment === 'Premium' ? 'bg-purple-500' :
                        segment.segment === 'High' ? 'bg-green-500' :
                        segment.segment === 'Medium' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}></span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-slate-600">
                        {segment.customer_count} customers
                      </p>
                      <p className="text-sm font-medium text-slate-900">
                        {formatCurrency(segment.avg_revenue_per_customer)} avg
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500">
              {loading ? 'Loading customer revenue analysis...' : 'No customer revenue data available'}
            </div>
          )}
        </CardContent>
      </Card>


    </div>
  );
}; 