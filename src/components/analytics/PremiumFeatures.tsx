import React, { useState, useEffect } from 'react';
import { 
  Crown, Star, Zap, Lock, BarChart3, ArrowLeft
} from 'lucide-react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { getPremiumFeatureSummary } from '../../utils/columnUtils';
import { PremiumTile } from '../ui/PremiumTile';

interface PremiumFeaturesProps {
  onBackClick?: () => void;
}

export const PremiumFeatures: React.FC<PremiumFeaturesProps> = ({ onBackClick }) => {
  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [dataInsights, setDataInsights] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const userHasPremiumAccess = false; // This would come from auth context in real app

  const fetchDataInsights = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/analytics/data-insights-check');
      const data = await response.json();
      setDataInsights(data);
      
      if (data && !data.error && data.data_overview) {
        setAvailableColumns(data.data_overview.columns_available || []);
      }
    } catch (error) {
      console.error('Error fetching data insights:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataInsights();
  }, []);

  const handleUpgradeClick = () => {
    // Handle upgrade click - could open modal, navigate to pricing, etc.
    console.log('Upgrade clicked');
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBackClick && (
            <Button 
              variant="outline" 
              onClick={onBackClick}
              className="flex items-center"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Analytics
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center">
              <Crown className="w-6 h-6 mr-3 text-purple-600" />
              Premium Features
            </h1>
            <p className="text-slate-600">
              Unlock deeper insights with advanced analytics based on your uploaded data
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="ml-3 text-slate-600">Analyzing your data...</span>
        </div>
      ) : availableColumns.length > 0 ? (
        <PremiumInsightsPreview 
          availableColumns={availableColumns}
          userHasPremiumAccess={userHasPremiumAccess}
          onUpgradeClick={handleUpgradeClick}
          dataInsights={dataInsights}
        />
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No Data Available
            </h3>
            <p className="text-slate-600 mb-4">
              Upload your sales data to see available premium features
            </p>
            <p className="text-sm text-slate-500">
              Once you upload data, we'll show you which advanced analytics are possible
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Premium Insights Preview Component
const PremiumInsightsPreview: React.FC<{
  availableColumns: string[];
  userHasPremiumAccess: boolean;
  onUpgradeClick: () => void;
  dataInsights: any;
}> = ({ availableColumns, userHasPremiumAccess, onUpgradeClick, dataInsights }) => {
  const premiumSummary = getPremiumFeatureSummary(availableColumns);
  
  if (premiumSummary.totalAvailable === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-slate-400" />
          </div>
          <h4 className="text-lg font-semibold text-slate-900 mb-2">
            No Premium Analyses Available
          </h4>
          <p className="text-slate-600 mb-4">
            Your current data doesn't include the required columns for premium features
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
            <h5 className="font-medium text-blue-900 mb-2">To unlock premium features, include:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Customer email addresses</li>
              <li>• Order dates and IDs</li>
              <li>• Product names and quantities</li>
              <li>• Order totals and pricing</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Overview Card */}
      {dataInsights && dataInsights.data_overview && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Your Data Overview</h3>
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

      {/* Feature Availability Summary */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900">Feature Availability Summary</h3>
          <p className="text-slate-600">
            {dataInsights?.overall_recommendation || 'Analyzing your data capabilities...'}
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Starter Features</p>
                  <p className="text-2xl font-semibold text-blue-600">
                    {premiumSummary.starterAvailable}
                  </p>
                </div>
                <Star className="w-8 h-8 text-blue-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Pro Features</p>
                  <p className="text-2xl font-semibold text-purple-600">
                    {premiumSummary.proAvailable}
                  </p>
                </div>
                <Crown className="w-8 h-8 text-purple-500" />
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Available</p>
                  <p className="text-2xl font-semibold text-green-600">
                    {premiumSummary.totalAvailable}
                  </p>
                </div>
                <Zap className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Premium Feature Tiles */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-slate-900">Available Premium Features</h3>
          <p className="text-slate-600">
            Based on your data structure, these advanced analytics are available
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {premiumSummary.allFeatures.map((feature) => (
              <PremiumTile
                key={feature.id}
                feature={feature}
                locked={!userHasPremiumAccess}
                userHasPremiumAccess={userHasPremiumAccess}
                onUpgradeClick={onUpgradeClick}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Call to Action */}
      {!userHasPremiumAccess && premiumSummary.totalAvailable > 0 && (
        <Card>
          <CardContent className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white text-center">
            <h4 className="text-xl font-semibold mb-2">
              Ready to unlock {premiumSummary.totalAvailable} premium feature{premiumSummary.totalAvailable !== 1 ? 's' : ''}?
            </h4>
            <p className="mb-4 opacity-90">
              Your data is perfectly structured for advanced analytics. Get deeper insights now.
            </p>
            <div className="flex items-center justify-center space-x-4">
              <Button 
                onClick={onUpgradeClick}
                className="bg-white text-purple-600 hover:bg-gray-100"
              >
                <Crown className="w-4 h-4 mr-2" />
                View Pricing Plans
              </Button>
              <Button 
                variant="outline" 
                className="border-white text-white hover:bg-white hover:text-purple-600"
              >
                Learn More
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 