export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  // Display name (first + last, or email fallback)
  name: string;
  firstName: string;
  lastName: string;
  phone?: string;
  country: string;
  currency: 'GBP' | 'USD' | 'EUR';
  brandName?: string;
  brandSize?: string;
  industrySegment?: string;
  dateOfBirth?: string;
  referralSource?: string;
  plan: 'micro' | 'starter' | 'professional' | 'enterprise';
  createdAt: string;
  hasSeenOnboarding: boolean;
  csvUploaded: boolean;
  brandDetailsComplete: boolean;
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

// Advanced Analytics Types
export interface TopProduct {
  product_name: string;
  total_revenue: number;
  total_quantity: number;
  unique_orders: number;
  avg_unit_price: number;
  revenue_per_unit: number;
}

export interface TopProductsResponse {
  sort_by: string;
  total_products: number;
  data: TopProduct[];
}

export interface AOVTrendData {
  period: string;
  aov: number;
  total_revenue: number;
  total_orders: number;
  change_percent: number;
}

export interface AOVTrendsResponse {
  period_type: string;
  data: AOVTrendData[];
}

export interface CustomerAnalysisData {
  period: string;
  new_customers: number;
  returning_customers: number;
  total_customers: number;
  new_customer_revenue: number;
  returning_customer_revenue: number;
  returning_percentage: number;
}

export interface CustomerAnalysisResponse {
  data: CustomerAnalysisData[];
}

export interface GeographicData {
  location: string;
  total_revenue: number;
  unique_customers: number;
  total_orders: number;
  avg_revenue_per_customer: number;
}

export interface GeographicResponse {
  location_column: string;
  total_locations: number;
  data: GeographicData[];
}

export interface OrderVolumeData {
  period: string;
  order_count: number;
  total_items: number;
  change_percent: number;
}

export interface OrderVolumeResponse {
  period_type: string;
  data: OrderVolumeData[];
}

export interface RevenuePerCustomerSegment {
  segment: string;
  customer_count: number;
  avg_revenue_per_customer: number;
  total_segment_revenue: number;
  avg_orders_per_customer: number;
  avg_revenue_per_order: number;
  avg_customer_lifetime_days: number;
}

export interface RevenuePerCustomerResponse {
  summary: {
    total_customers: number;
    total_revenue: number;
    avg_revenue_per_customer: number;
  };
  segments: RevenuePerCustomerSegment[];
}

export interface RevenueTrendData {
  period: string;
  revenue: number;
  orders: number;
  change_percent: number;
}

export interface RevenueTrendsResponse {
  period_type: string;
  total_periods: number;
  data: RevenueTrendData[];
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