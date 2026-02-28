import { mockAgingReport } from "@/lib/data/mock/aging";
import { mockChangeOrders } from "@/lib/data/mock/change-orders";
import { FINANCIAL_MONTHS, mockProjectFinancials } from "@/lib/data/mock/financials";
import { mockProjects } from "@/lib/data/mock/projects";
import { mockScheduleTasks } from "@/lib/data/mock/schedules";
import type {
  AgingReport,
  CashFlowForecastPoint,
  ChangeOrder,
  CostBreakdown,
  DataProvider,
  EVMDataPoint,
  PortfolioKPIs,
  ProjectFinancialBase,
  ProjectFinancials,
  ProjectHealth,
  ProjectHealthMatrixItem,
  RevenueExpenseTrendPoint,
  ScheduleTask,
  UnifiedProject,
} from "./interface";

const roundMetric = (value: number, precision = 2): number =>
  Number(value.toFixed(precision));

const roundCurrency = (value: number): number => Math.round(value);

function cloneCostBreakdown(costBreakdown: CostBreakdown): CostBreakdown {
  return {
    labor: { ...costBreakdown.labor },
    materials: { ...costBreakdown.materials },
    subcontract: { ...costBreakdown.subcontract },
    equipment: { ...costBreakdown.equipment },
    overhead: { ...costBreakdown.overhead },
  };
}

function cloneEVMData(monthlyEVM: EVMDataPoint[]): EVMDataPoint[] {
  return monthlyEVM.map((point) => ({ ...point }));
}

function getFinancialRecord(projectId: string): ProjectFinancialBase | null {
  return mockProjectFinancials[projectId] ?? null;
}

function getPerformanceMetrics(monthlyEVM: EVMDataPoint[]): {
  cpi: number;
  spi: number;
} {
  if (monthlyEVM.length === 0) {
    return { cpi: 1, spi: 1 };
  }

  const latest = monthlyEVM[monthlyEVM.length - 1];
  const cpi = latest.actualCost === 0 ? 1 : latest.earnedValue / latest.actualCost;
  const spi = latest.plannedValue === 0 ? 1 : latest.earnedValue / latest.plannedValue;

  return {
    cpi: roundMetric(cpi),
    spi: roundMetric(spi),
  };
}

function toUnifiedProject(project: (typeof mockProjects)[number]): UnifiedProject {
  const financialRecord = getFinancialRecord(project.id);
  const performance = financialRecord
    ? getPerformanceMetrics(financialRecord.monthlyEVM)
    : { cpi: 1, spi: 1 };

  return {
    ...project,
    ...performance,
  };
}

function getHealthStatus(
  schedulePercent: number,
  budgetPercent: number
): ProjectHealth {
  const variance = Math.abs(schedulePercent - budgetPercent);

  if (variance <= 10) {
    return "good";
  }

  if (variance <= 20) {
    return "warning";
  }

  return "critical";
}

export class MockDataProvider implements DataProvider {
  async getProjects(): Promise<UnifiedProject[]> {
    return mockProjects.map((project) => toUnifiedProject(project));
  }

  async getProjectById(id: string): Promise<UnifiedProject | null> {
    const project = mockProjects.find((item) => item.id === id);

    if (!project) {
      return null;
    }

    return toUnifiedProject(project);
  }

  async getProjectFinancials(projectId: string): Promise<ProjectFinancials | null> {
    const financialRecord = getFinancialRecord(projectId);

    if (!financialRecord) {
      return null;
    }

    const performance = getPerformanceMetrics(financialRecord.monthlyEVM);

    return {
      ...financialRecord,
      costBreakdown: cloneCostBreakdown(financialRecord.costBreakdown),
      monthlyEVM: cloneEVMData(financialRecord.monthlyEVM),
      ...performance,
    };
  }

  async getPortfolioKPIs(): Promise<PortfolioKPIs> {
    const projects = await this.getProjects();
    const activeProjects = projects.filter((project) => project.status === "Active");

    const totalContractValue = activeProjects.reduce((sum, project) => {
      const financialRecord = getFinancialRecord(project.id);
      return sum + (financialRecord?.revisedContractAmount ?? project.totalValue);
    }, 0);

    const avgCpi =
      activeProjects.length === 0
        ? 0
        : roundMetric(
            activeProjects.reduce((sum, project) => sum + project.cpi, 0) /
              activeProjects.length
          );

    const atRiskCount = activeProjects.filter(
      (project) => project.cpi < 0.95 || project.spi < 0.95
    ).length;

    return {
      activeProjectsCount: activeProjects.length,
      totalContractValue,
      avgCpi,
      atRiskCount,
    };
  }

  async getProjectHealthMatrix(): Promise<ProjectHealthMatrixItem[]> {
    return mockProjects.map((project) => {
      const financialRecord = getFinancialRecord(project.id);
      const budgetPercent = financialRecord
        ? roundMetric(
            (financialRecord.costToDate / financialRecord.estimatedCostAtCompletion) *
              100,
            1
          )
        : 0;

      const schedulePercent = project.percentComplete;

      return {
        projectId: project.id,
        name: project.name,
        schedulePercent,
        budgetPercent,
        health: getHealthStatus(schedulePercent, budgetPercent),
      };
    });
  }

  async getRevenueExpenseTrend(): Promise<RevenueExpenseTrendPoint[]> {
    const trend = FINANCIAL_MONTHS.map((month) => ({
      month,
      revenue: 0,
      expenses: 0,
    }));

    const monthIndex = FINANCIAL_MONTHS.reduce<Record<string, number>>(
      (acc, month, index) => {
        acc[month] = index;
        return acc;
      },
      {}
    );

    Object.values(mockProjectFinancials).forEach((financialRecord) => {
      financialRecord.monthlyEVM.forEach((point, index) => {
        const previousPoint =
          index === 0
            ? { earnedValue: 0, actualCost: 0 }
            : financialRecord.monthlyEVM[index - 1];

        const indexForMonth = monthIndex[point.month];
        const monthEntry = trend[indexForMonth];

        monthEntry.revenue += point.earnedValue - previousPoint.earnedValue;
        monthEntry.expenses += point.actualCost - previousPoint.actualCost;
      });
    });

    return trend.map((point) => ({
      month: point.month,
      revenue: roundCurrency(point.revenue),
      expenses: roundCurrency(point.expenses),
    }));
  }

  async getCostBreakdown(projectId: string): Promise<CostBreakdown | null> {
    const financialRecord = getFinancialRecord(projectId);

    if (!financialRecord) {
      return null;
    }

    return cloneCostBreakdown(financialRecord.costBreakdown);
  }

  async getEVMData(projectId: string): Promise<EVMDataPoint[]> {
    const financialRecord = getFinancialRecord(projectId);
    return financialRecord ? cloneEVMData(financialRecord.monthlyEVM) : [];
  }

  async getCashFlowForecast(): Promise<CashFlowForecastPoint[]> {
    const forecastBase = [
      { month: "2026-01", arAmount: 5_100_000, apAmount: 4_400_000 },
      { month: "2026-02", arAmount: 4_800_000, apAmount: 4_200_000 },
      { month: "2026-03", arAmount: 5_400_000, apAmount: 4_100_000 },
      { month: "2026-04", arAmount: 5_700_000, apAmount: 4_300_000 },
      { month: "2026-05", arAmount: 6_000_000, apAmount: 4_500_000 },
      { month: "2026-06", arAmount: 6_300_000, apAmount: 4_600_000 },
    ];

    return forecastBase.map((point) => ({
      ...point,
      netCashFlow: point.arAmount - point.apAmount,
    }));
  }

  async getAgingReport(): Promise<AgingReport> {
    return {
      ar: mockAgingReport.ar.map((bucket) => ({ ...bucket })),
      ap: mockAgingReport.ap.map((bucket) => ({ ...bucket })),
    };
  }

  async getChangeOrders(projectId: string): Promise<ChangeOrder[]> {
    return mockChangeOrders
      .filter((order) => order.projectId === projectId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((order) => ({ ...order }));
  }

  async getScheduleTasks(projectId: string): Promise<ScheduleTask[]> {
    return mockScheduleTasks
      .filter((task) => task.projectId === projectId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .map((task) => ({ ...task }));
  }
}
