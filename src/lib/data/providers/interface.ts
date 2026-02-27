import type {
  ProcoreChangeOrder,
  ProcoreProject,
  ProcoreScheduleTask,
} from "@/lib/types/procore";
import type {
  AgingBucket as SageAgingBucket,
  SageProject,
} from "@/lib/types/sage";

export type ProjectHealth = "good" | "warning" | "critical";
export type ProjectStatus = "Active" | "Pre-Construction" | "Completed" | "On Hold";
export type ChangeOrderStatus = "Approved" | "Pending" | "Rejected";
export type ScheduleTaskStatus =
  | "Not Started"
  | "In Progress"
  | "Completed"
  | "Delayed";

export interface ProjectSourceRefs {
  procore?: Pick<ProcoreProject, "id" | "name" | "project_number" | "active">;
  sage?: Pick<
    SageProject,
    "PROJECTID" | "NAME" | "PROJECTSTATUS" | "CONTRACTAMOUNT"
  >;
}

export interface BaseProject {
  id: string;
  name: string;
  type: string;
  status: ProjectStatus;
  city: string;
  state: string;
  startDate: string;
  completionDate: string;
  totalValue: number;
  percentComplete: number;
  projectNumber: string;
  sourceRefs?: ProjectSourceRefs;
}

export interface UnifiedProject extends BaseProject {
  cpi: number;
  spi: number;
}

export interface CostCategory {
  budget: number;
  actual: number;
  committed: number;
}

export interface CostBreakdown {
  labor: CostCategory;
  materials: CostCategory;
  subcontract: CostCategory;
  equipment: CostCategory;
  overhead: CostCategory;
}

export interface EVMDataPoint {
  month: string;
  plannedValue: number;
  earnedValue: number;
  actualCost: number;
}

export interface ProjectFinancialBase {
  projectId: string;
  originalContractAmount: number;
  approvedChangeOrders: number;
  revisedContractAmount: number;
  costToDate: number;
  committedCosts: number;
  estimatedCostAtCompletion: number;
  billedToDate: number;
  receivedToDate: number;
  retainage: number;
  costBreakdown: CostBreakdown;
  monthlyEVM: EVMDataPoint[];
}

export interface ProjectFinancials extends ProjectFinancialBase {
  cpi: number;
  spi: number;
}

export interface PortfolioKPIs {
  activeProjectsCount: number;
  totalContractValue: number;
  avgCpi: number;
  atRiskCount: number;
}

export interface ProjectHealthMatrixItem {
  projectId: string;
  name: string;
  schedulePercent: number;
  budgetPercent: number;
  health: ProjectHealth;
}

export interface RevenueExpenseTrendPoint {
  month: string;
  revenue: number;
  expenses: number;
}

export interface CashFlowForecastPoint {
  month: string;
  arAmount: number;
  apAmount: number;
  netCashFlow: number;
}

export type AgingBucket = SageAgingBucket;

export interface AgingReport {
  ar: AgingBucket[];
  ap: AgingBucket[];
}

export interface ChangeOrder {
  id: string;
  projectId: string;
  number: ProcoreChangeOrder["number"];
  title: ProcoreChangeOrder["title"];
  status: ChangeOrderStatus;
  amount: number;
  createdAt: string;
}

export interface ScheduleTask {
  id: string;
  projectId: string;
  name: ProcoreScheduleTask["name"];
  startDate: string;
  finishDate: string;
  percentComplete: number;
  status: ScheduleTaskStatus;
  parentId: string | null;
  isMilestone: boolean;
}

export interface DataProvider {
  getProjects(): Promise<UnifiedProject[]>;
  getProjectById(id: string): Promise<UnifiedProject | null>;
  getProjectFinancials(projectId: string): Promise<ProjectFinancials | null>;
  getPortfolioKPIs(): Promise<PortfolioKPIs>;
  getProjectHealthMatrix(): Promise<ProjectHealthMatrixItem[]>;
  getRevenueExpenseTrend(): Promise<RevenueExpenseTrendPoint[]>;
  getCostBreakdown(projectId: string): Promise<CostBreakdown | null>;
  getEVMData(projectId: string): Promise<EVMDataPoint[]>;
  getCashFlowForecast(): Promise<CashFlowForecastPoint[]>;
  getAgingReport(): Promise<AgingReport>;
  getChangeOrders(projectId: string): Promise<ChangeOrder[]>;
  getScheduleTasks(projectId: string): Promise<ScheduleTask[]>;
}
