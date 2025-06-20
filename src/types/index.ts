export interface User {
  id: string;
  email: string;
  name: string;
  plan: 'micro' | 'starter' | 'professional' | 'enterprise';
  createdAt: string;
}

export interface AnalyticsData {
  segments: Segment[];
  forecast: ForecastData[];
  marketBasket: MarketBasketItem[];
  churnRisk: ChurnData[];
}

export interface Segment {
  id: string;
  name: string;
  size: number;
  revenue: number;
  characteristics: string[];
  color: string;
}

export interface ForecastData {
  month: string;
  predicted: number;
  actual?: number;
  confidence: number;
}

export interface MarketBasketItem {
  itemA: string;
  itemB: string;
  confidence: number;
  support: number;
  lift: number;
}

export interface ChurnData {
  segment: string;
  riskLevel: 'low' | 'medium' | 'high';
  percentage: number;
  customers: number;
}

export interface AIInsight {
  type: 'action' | 'observation' | 'recommendation';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
  requiresPro?: boolean;
}

// API Response Types
export interface ProcessingError {
  message: string;
  details?: Record<string, any>;
}

export interface ProcessingMetrics {
  total_revenue: number;
  active_customers: number;
  average_order_value: number;
  churn_risk: number;
  revenue_forecast: {
    month: number;
    forecast: number;
  }[];
  customer_segments: {
    segment: string;
    count: number;
    avgSpend: number;
  }[];
}

export interface ProcessingResponse {
  success: boolean;
  error?: ProcessingError;
  metrics?: ProcessingMetrics;
}

// Component Props Types
export interface DataUploadProps {
  onProcessed: (data: ProcessingMetrics) => void;
}

export interface AnalyticsProps {
  data: ProcessingMetrics;
}