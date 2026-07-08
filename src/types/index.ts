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

// ── Upload v2 API types ───────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface V2AnalyzeHeadersResponse {
  success: boolean;
  error?: string;
  all_columns: string[];
  row_count: number;
  auto_matched: Record<string, string>;
  confidence_scores: Record<string, ConfidenceLevel>;
  fuzzy_suggestions: Record<string, string[]>;
  missing: string[];
  needs_mapping: boolean;
  preview_rows: Record<string, unknown>[];
  file_type: 'csv' | 'xlsx' | 'xls';
  sheet_names: string[] | null;
  encoding_used: string | null;
  saved_mapping: Record<string, string>;
  field_labels: Record<string, string>;
  field_descriptions: Record<string, string>;
  field_missing_messages: Record<string, string>;
}

export interface RowError {
  row: number;
  field: string;
  value: string;
  error: string;
  severity: 'error' | 'warning';
}

export interface DuplicateRow {
  row: number;
  order_id: string;
  message: string;
  severity: 'warning';
}

export interface V2ProcessResponse {
  success: boolean;
  error?: string;
  upload_id?: string;
  metrics?: ProcessingMetrics;
  rows_processed?: number;
  row_errors?: RowError[];
  duplicate_rows?: DuplicateRow[];
  warning_count?: number;
  encoding_used?: string;
  uploaded_at?: string;
  is_sample_data?: boolean;
  skipped_customers?: number;
  action_summary?: ActionSummaryFull;
  insights?: BankInsight[];
}

export interface DashboardInsightsPayload {
  uploadId?: string;
  actionSummary?: ActionSummaryFull;
  insights?: BankInsight[];
}

export interface UploadHistoryEntry {
  id: string;
  file_name: string;
  file_size_bytes: number;
  row_count: number | null;
  status: 'processing' | 'complete' | 'failed';
  is_sample_data: boolean;
  created_at: string;
}

export interface V2HistoryResponse {
  data: UploadHistoryEntry[];
}

export interface V2SavedMappingResponse {
  mapping: Record<string, string>;
}

export interface V2SampleStatusResponse {
  is_sample_data: boolean;
  has_data: boolean;
}

export interface DataUploadV2Props {
  onProcessed: (
    data: ProcessingMetrics,
    uploadedAt: string,
    isSampleData: boolean,
    insightsPayload?: DashboardInsightsPayload,
  ) => void;
  isSampleData: boolean;
  onClearSampleData: () => void;
}

export interface AnalyticsProps {
  data: ProcessingMetrics;
}

// ── Customer Insights API types ───────────────────────────────────────────────

export type ActionPriority = 'high' | 'medium' | 'low';

export interface CustomerInsight {
  customer_email?: string;
  customer_id?: string;
  total_revenue: number;
  order_count: number;
  aov: number;
  first_order_date: string | null;
  last_order_date: string | null;
  days_since_last_order: number;
  customer_lifetime_days: number;
  purchase_frequency: number;
  total_quantity_purchased: number;
  distinct_products_purchased: number;
  total_discount_amount: number;
  discount_usage_rate: number;
  refund_total: number;
  net_revenue: number;
  avg_days_between_orders: number;
  first_product_purchased: string | null;
  most_bought_product: string | null;
  // Behavioural flags
  is_repeat_customer: boolean;
  is_one_time_buyer: boolean;
  is_at_risk: boolean;
  is_lapsed: boolean;
  is_discount_dependent: boolean;
  is_full_price_loyal: boolean;
  is_high_value: boolean;
  is_high_return_risk: boolean;
  is_new_customer: boolean;
  // Recommended action
  recommended_action: string;
  action_reason: string;
  action_priority: ActionPriority;
}

export interface CustomerInsightsResponse {
  success: boolean;
  upload_id: string | null;
  row_count: number;
  skipped_rows: number;
  generated_at: string;
  data: CustomerInsight[];
}

export interface ActionSummaryGroup {
  action: string;
  action_priority: ActionPriority;
  customer_count: number;
  total_revenue_at_stake: number;
}

export interface ActionSummaryResponse {
  success: boolean;
  upload_id: string | null;
  generated_at: string;
  summary: {
    generated_at: string;
    groups: ActionSummaryGroup[];
  };
}

export interface V2ProcessResponseWithInsights extends V2ProcessResponse {
  skipped_customers?: number;
}

// ── Dashboard upgrade types ───────────────────────────────────────────────────

export interface InsightSegment {
  name: string;
  customers: number;
  total_revenue: number;
  avg_revenue: number;
  color: string;
  revenue_pct?: number;
  delta_customers?: number;
  delta_revenue?: number;
  benchmark_note?: string;
  description?: string;
  why?: string;
  how_to_treat?: string;
  typical_pct?: string;
}

export interface ActionGroup {
  action: string;
  action_priority: ActionPriority;
  customer_count: number;
  total_revenue_at_stake: number;
  suggested_channel: string;
  suggested_timing: string;
}

export interface ActionSummaryFull {
  generated_at: string;
  groups: ActionGroup[];
  segments: InsightSegment[];
  total_customers?: number;
  total_revenue?: number;
  revenue_at_risk?: number;
  revenue_opportunity?: number;
  what_changed?: string;
}

export interface ActionState {
  action_key: string;
  is_done: boolean;
  snoozed: boolean;
  snooze_upload_id: string | null;
}

export type InsightConfidence = 'high' | 'medium' | 'low';
export type InsightCategory =
  | 'retention_risk'
  | 'growth_opportunity'
  | 'discount_inefficiency'
  | 'product_concentration'
  | 'cohort_quality'
  | 'customer_concentration'
  | 'seasonality';

export interface BankInsight {
  id: string;
  category: InsightCategory;
  headline: string;
  explanation: string;
  revenue_at_stake: number;
  affected_count: number;
  confidence: InsightConfidence;
  suggested_action: string;
  flag_citations: string[];
  data_logic: string;
  score: number;
  customer_keys: string[];
}

export interface InsightBankResponse {
  success: boolean;
  upload_id: string | null;
  generated_at: string;
  insights: BankInsight[];
}

export interface SegmentCustomer {
  name?: string;
  email?: string;
  email_or_id: string;
  total_revenue: number;
  order_count: number;
  last_order_date: string;
  days_since_last_order: number;
  aov: number;
  recommended_action: string;
  action_priority: ActionPriority;
}

export interface ActionCustomer {
  email_or_id: string;
  total_revenue: number;
  order_count: number;
  last_order_date: string;
  reason: string;
  channel: string;
  timing: string;
}