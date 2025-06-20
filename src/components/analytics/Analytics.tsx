import React from 'react';
import { 
  BarChart3, ShoppingBag, RefreshCcw, Users, AlertTriangle, 
  TrendingUp, Brain, Package, ShoppingCart, UserCheck, 
  Calendar, Target, Zap 
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { AnalyticsProps } from '../../types';

// Mock data for top products
const mockTopProducts = [
  { name: 'Designer Handbag X', revenue: 45000, units: 150, category: 'Accessories' },
  { name: 'Summer Dress Y', revenue: 38000, units: 280, category: 'Dresses' },
  { name: 'Premium Shoes Z', revenue: 32000, units: 120, category: 'Footwear' },
];

// Mock data for market basket
const mockMarketBasket = [
  { combination: ['Designer Handbag X', 'Silk Scarf A'], confidence: 0.85, lift: 2.3 },
  { combination: ['Summer Dress Y', 'Sandals B'], confidence: 0.75, lift: 1.8 },
];

// Mock data for repeat purchase
const mockRepeatPurchase = [
  { period: '0-30 days', count: 450 },
  { period: '31-60 days', count: 320 },
  { period: '61-90 days', count: 180 },
];

// Mock data for customer segments
const mockCustomerSegments = [
  { segment: 'High Value', count: 1200, avgSpend: 850, color: '#8b5cf6' },
  { segment: 'Regular', count: 2800, avgSpend: 450, color: '#10b981' },
  { segment: 'New', count: 1800, avgSpend: 250, color: '#f59e0b' },
  { segment: 'At Risk', count: 800, avgSpend: 150, color: '#f97316' },
];

export const Analytics: React.FC<AnalyticsProps> = ({ data }) => {
  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Revenue</p>
                <h3 className="text-2xl font-semibold text-slate-900">
                  £{data.total_revenue.toLocaleString()}
                </h3>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center">
                <ShoppingBag className="w-6 h-6 text-purple-600" />
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
                  £{data.average_order_value.toLocaleString()}
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
                  {data.churn_risk}%
                </h3>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Segments */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900 flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-600" />
            Customer Segments
          </h3>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.customer_segments}
                cx="50%"
                cy="50%"
                outerRadius={100}
                fill="#8884d8"
                dataKey="count"
                label={({ segment, count }) => `${segment}: ${count}`}
              >
                {data.customer_segments.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getSegmentColor(entry.segment)} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Products Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <ShoppingBag className="w-5 h-5 mr-2 text-purple-600" />
                  Top Products
                </h3>
                <p className="text-sm text-slate-600">Best-selling items by revenue and units</p>
              </div>
              <Button variant="outline" size="sm">Export</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockTopProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-slate-900">{product.name}</h4>
                    <p className="text-sm text-slate-600">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-slate-900">£{product.revenue.toLocaleString()}</p>
                    <p className="text-sm text-slate-600">{product.units} units</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Market Basket Insights */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-blue-600" />
                  Market Basket Insights
                </h3>
                <p className="text-sm text-slate-600">Frequently combined products</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockMarketBasket.map((combo, index) => (
                <div key={index} className="p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-slate-900">Bundle Opportunity</h4>
                    <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                      {(combo.confidence * 100).toFixed(0)}% confidence
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    {combo.combination.join(' + ')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Repeat Purchase and Customer Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <RefreshCcw className="w-5 h-5 mr-2 text-green-600" />
              Repeat Purchase Behavior
            </h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={mockRepeatPurchase}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Users className="w-5 h-5 mr-2 text-purple-600" />
              Customer Segments
            </h3>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mockCustomerSegments}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                  label={({ segment, count }) => `${segment}: ${count}`}
                >
                  {mockCustomerSegments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Churn Risk and Campaign Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
              Churn Risk Breakdown
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg">
                <h4 className="font-medium text-red-900 mb-2">High Risk Segment</h4>
                <p className="text-sm text-red-700">
                  320 customers haven't made a purchase in 45+ days
                </p>
                <div className="mt-4">
                  <Button variant="outline" size="sm">View Details</Button>
                </div>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-900 mb-2">Medium Risk Segment</h4>
                <p className="text-sm text-yellow-700">
                  580 customers showing decreased engagement
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900 flex items-center">
              <Target className="w-5 h-5 mr-2 text-indigo-600" />
              Campaign Performance
            </h3>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-slate-900">Summer Sale Campaign</h4>
                  <span className="text-sm bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    +24% lift
                  </span>
                </div>
                <p className="text-sm text-slate-600">
                  Average order value increased from £89 to £110
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon - Advanced AI Insights */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 flex items-center">
                <Brain className="w-5 h-5 mr-2 text-purple-600" />
                Advanced AI Insights
                <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                  Coming Soon
                </span>
              </h3>
              <p className="text-sm text-slate-600">
                Powered by advanced machine learning and GPT models
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-white bg-opacity-50 rounded-lg">
              <Zap className="w-8 h-8 text-purple-600 mb-2" />
              <h4 className="font-medium text-slate-900 mb-1">Predictive Analytics</h4>
              <p className="text-sm text-slate-600">
                AI-powered forecasting and trend prediction
              </p>
            </div>
            <div className="p-4 bg-white bg-opacity-50 rounded-lg">
              <Brain className="w-8 h-8 text-indigo-600 mb-2" />
              <h4 className="font-medium text-slate-900 mb-1">Smart Recommendations</h4>
              <p className="text-sm text-slate-600">
                Personalized product suggestions
              </p>
            </div>
            <div className="p-4 bg-white bg-opacity-50 rounded-lg">
              <Target className="w-8 h-8 text-blue-600 mb-2" />
              <h4 className="font-medium text-slate-900 mb-1">Dynamic Pricing</h4>
              <p className="text-sm text-slate-600">
                Automated price optimization
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function getSegmentColor(segment: string): string {
  const colorMap: Record<string, string> = {
    'High Value': '#8b5cf6',
    'Regular': '#10b981',
    'New': '#f59e0b',
    'At Risk': '#f97316'
  };
  return colorMap[segment] || '#8884d8';
} 