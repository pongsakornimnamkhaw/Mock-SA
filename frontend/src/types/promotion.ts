// ============================================================
// TypeScript types — ตรงกับ Go GORM models
// ============================================================

export type PromotionStatus = 'active' | 'expired' | 'draft';
export type DiscountType = 'percent' | 'fixed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Zone {
  zone_id: string;
  zone_name: string;
}

export interface DiscountInfo {
  discount_id: string;
  discount_type: DiscountType;
  discount_value: number;
  max_discount_amount: number;
  promo_code: string;
  promotion_id: string;
}

export interface QuotaAndPeriod {
  quota_id: string;
  start_date: string;
  end_date: string;
  total_quota: number;
  used_quota: number;
  promotion_id: string;
}

export interface TermsAndConditions {
  term_id: string;
  terms_detail: string;
  promotion_id: string;
}

export interface PromotionCondition {
  condition_id: string;
  max_usage_per_user: number;
  min_order_amount: number;
  promotion_id: string;
}

export interface PromotionUsageLog {
  usage_log_id: string;
  used_at: string;
  user_name: string;
  user_id: string;
  order_id: string;
  purchased_zone: string;
  final_amount: number;
  discount_amount?: number;
  promotion_id: string;
}

export interface PromotionApproval {
  approval_id: string;
  requested_by: string;
  requested_at: string;
  approved_by: string;
  approved_at: string;
  status: ApprovalStatus;
  remark: string;
  promotion_id: string;
}

export interface Concert {
  concert_id: string;
  concert_name: string;
  event_date: string;
  venue: string;
}

export interface Promotion {
  promotion_id: string;
  promotion_name: string;
  description: string;
  banner_image_url: string;
  status: PromotionStatus;
  concert_id: string;
  created_at: string;
  updated_at: string;
  total_revenue?: number;
  total_discount?: number;
  // Relations
  concert?: Concert;
  discount_info?: DiscountInfo;
  quota_and_period?: QuotaAndPeriod;
  terms_and_conditions?: TermsAndConditions;
  promotion_condition?: PromotionCondition;
  promotion_usage_logs?: PromotionUsageLog[];
  promotion_approvals?: PromotionApproval[];
  zones?: Zone[];
}

// UI helper types
export interface EditHistoryEntry {
  id: string;
  timestamp: Date;
  action: 'edit' | 'view';
  promotion_name: string;
  promotion_id: string;
}

export type TabStatus = 'all' | PromotionStatus;
export type ApprovalTab = 'all' | ApprovalStatus;

// ============================================================
// Employee & Activity Log types
// ============================================================

export type EmployeePermission = 'view_only' | 'edit' | 'admin';

export interface Employee {
  employee_id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
  department: string;
  email: string;
  phone: string;
  permission: EmployeePermission;
  edit_scope?: string;
  personnel_type?: PersonnelType;
}

export interface ActivityLog {
  log_id: string;
  date: string;
  user_name: string;
  user_code: string;
  activity_type: string;
  action_code?: string;
  detail: string;
}

// ============================================================
// Personnel type — shared between backend and frontend
// ============================================================

export type PersonnelType = 'internal' | 'external';

// ============================================================
// Employee password reset request — admin panel view
// ============================================================

export interface EmployeeResetRequest {
  requestId: string;
  referenceCode: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  personnelType: PersonnelType;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}
