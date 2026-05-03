// Utility functions for checking premium feature availability based on uploaded data columns
// This does NOT affect data ingestion - only checks what's already processed

export const hasRequiredColumns = (columns: string[], required: string[]): boolean => {
  return required.every(col => columns.includes(col));
};

export interface PremiumFeature {
  id: string;
  title: string;
  description: string;
  requiredTier: 'Starter' | 'Pro';
  requiredColumns: string[];
  benefits: string[];
  available: boolean;
  dataQualityCheck?: (columns: string[]) => { sufficient: boolean; reason?: string };
}

// Premium feature definitions - checks what's possible with current data
export const PREMIUM_FEATURES: PremiumFeature[] = [
  {
    id: 'repeat-behavior',
    title: 'Repeat Purchase Behavior',
    description: 'Analyze customer loyalty and repeat purchase patterns',
    requiredTier: 'Starter',
    requiredColumns: ['order_id', 'customer_email', 'order_date'],
    benefits: [
      'Customer retention insights',
      'Purchase frequency analysis', 
      'Loyalty score calculations',
      'Repeat customer identification'
    ],
    available: false
  },
  {
    id: 'basket-trends',
    title: 'Market Basket Analysis',
    description: 'Discover product bundles and cross-selling opportunities',
    requiredTier: 'Starter', 
    requiredColumns: ['order_id', 'product_name', 'customer_email'],
    benefits: [
      'Product affinity mapping',
      'Bundle recommendations',
      'Cross-sell opportunities',
      'Shopping pattern insights'
    ],
    available: false
  },
  {
    id: 'customer-segments',
    title: 'Advanced Customer Segmentation',
    description: 'RFM analysis and behavioral customer grouping',
    requiredTier: 'Pro',
    requiredColumns: ['total', 'quantity', 'customer_email', 'order_date'],
    benefits: [
      'RFM segmentation (Recency, Frequency, Monetary)',
      'High-value customer identification',
      'Targeted marketing insights',
      'Customer journey mapping'
    ],
    available: false
  },
  {
    id: 'clv-analysis',
    title: 'Customer Lifetime Value (CLV)',
    description: 'Predict long-term customer value and profitability',
    requiredTier: 'Pro',
    requiredColumns: ['customer_email', 'order_date', 'total'],
    benefits: [
      'CLV predictions and rankings',
      'Customer acquisition cost optimization',
      'Revenue forecasting per customer',
      'Retention strategy prioritization'
    ],
    available: false
  },
  {
    id: 'churn-prediction',
    title: 'AI-Powered Churn Prediction',
    description: 'Machine learning models to predict customer churn risk',
    requiredTier: 'Pro',
    requiredColumns: ['customer_email', 'order_date', 'total'],
    benefits: [
      'Churn probability scores',
      'At-risk customer alerts',
      'Retention campaign targeting',
      'Proactive customer success'
    ],
    available: false,
    dataQualityCheck: (columns: string[]) => {
      // Need sufficient historical data for ML models
      return { sufficient: true }; // Simplified for now
    }
  },
  {
    id: 'advanced-forecasting',
    title: 'Advanced Revenue Forecasting',
    description: 'Seasonal trends and predictive revenue modeling',
    requiredTier: 'Pro',
    requiredColumns: ['order_date', 'total'],
    benefits: [
      'Seasonal trend analysis',
      'Multi-period forecasting',
      'Scenario planning',
      'Inventory optimization insights'
    ],
    available: false
  },
  {
    id: 'ai-insights',
    title: 'AI-Powered Business Insights',
    description: 'Automated insights and anomaly detection',
    requiredTier: 'Pro',
    requiredColumns: ['order_date', 'total', 'customer_email'],
    benefits: [
      'Automated insight generation',
      'Anomaly detection',
      'Business performance alerts',
      'Competitive intelligence'
    ],
    available: false,
    dataQualityCheck: (columns: string[]) => {
      // Need sufficient data volume for AI insights
      return { sufficient: true }; // Will check row count in component
    }
  }
];

// Check which premium features are available based on uploaded data columns
export const checkPremiumFeatureAvailability = (availableColumns: string[]): PremiumFeature[] => {
  return PREMIUM_FEATURES.map(feature => ({
    ...feature,
    available: hasRequiredColumns(availableColumns, feature.requiredColumns)
  }));
};

// Get summary of available premium features
export const getPremiumFeatureSummary = (availableColumns: string[]) => {
  const features = checkPremiumFeatureAvailability(availableColumns);
  const starterFeatures = features.filter(f => f.requiredTier === 'Starter' && f.available);
  const proFeatures = features.filter(f => f.requiredTier === 'Pro' && f.available);
  
  return {
    totalAvailable: features.filter(f => f.available).length,
    starterAvailable: starterFeatures.length,
    proAvailable: proFeatures.length,
    starterFeatures,
    proFeatures,
    allFeatures: features
  };
}; 