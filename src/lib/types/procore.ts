// =============================================================
// Procore REST API v1.0 / v1.1 Types
// Based on: https://developers.procore.com/reference/rest/v1/projects
// =============================================================

export interface ProcoreProject {
  id: number;
  name: string;
  project_number: string;
  display_name: string;
  active: boolean;
  address: string;
  city: string;
  state_code: string;
  country_code: string;
  zip: string;
  county: string;
  start_date: string | null;
  completion_date: string | null;
  actual_start_date: string | null;
  projected_finish_date: string | null;
  total_value: number | null;
  estimated_value: number | null;
  square_feet: number | null;
  description: string;
  phone: string;
  time_zone: string;
  code: string;
  is_demo: boolean;
  public_notes: string;
  created_at: string;
  updated_at: string;
  project_stage: {
    id: number;
    name: string;
  };
  project_type: {
    id: number;
    name: string;
  } | null;
  company: {
    id: number;
    name: string;
  };
}

export interface ProcoreBudgetDetail {
  id: number;
  project_id: number;
  cost_code: {
    id: number;
    name: string;
    full_code: string;
    biller: string;
  };
  budget_line_item_id: number;
  original_budget_amount: number;
  budget_modifications: number;
  revised_budget: number;
  approved_change_orders: number;
  revised_budget_with_change_orders: number;
  pending_budget_changes: number;
  pending_change_orders: number;
  committed_costs: number;
  direct_costs: number;
  pending_cost_changes: number;
  forecasted_cost: number;
  over_under: number;
}

export interface ProcoreRFI {
  id: number;
  project_id: number;
  number: string;
  subject: string;
  status: string; // 'draft' | 'open' | 'closed'
  due_date: string | null;
  assignee: {
    id: number;
    name: string;
  } | null;
  created_at: string;
  updated_at: string;
  days_open: number;
}

export interface ProcoreChangeOrder {
  id: number;
  project_id: number;
  number: string;
  title: string;
  status: string; // 'draft' | 'pending' | 'approved' | 'rejected'
  change_order_type: string;
  grand_total: number;
  created_at: string;
  updated_at: string;
  due_date: string | null;
}

export interface ProcoreScheduleTask {
  id: number;
  project_id: number;
  name: string;
  start_date: string;
  finish_date: string;
  actual_start_date: string | null;
  actual_finish_date: string | null;
  percent_complete: number;
  status: string;
  parent_id: number | null;
  wbs_code: string;
  is_milestone: boolean;
  resource_names: string[];
}

export interface ProcoreDailyLog {
  id: number;
  project_id: number;
  date: string;
  weather_conditions: string;
  notes: string;
  created_by: {
    id: number;
    name: string;
  };
  manpower_count: number;
  created_at: string;
}

export interface ProcoreSubmittal {
  id: number;
  project_id: number;
  number: string;
  title: string;
  status: string;
  spec_section: string;
  due_date: string | null;
  submitted_date: string | null;
  created_at: string;
}

// OAuth token
export interface ProcoreTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
}
