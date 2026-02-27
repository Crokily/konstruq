import type {
  CostBreakdown,
  EVMDataPoint,
  ProjectFinancialBase,
} from "@/lib/data/providers/interface";

export const FINANCIAL_MONTHS = [
  "2025-01",
  "2025-02",
  "2025-03",
  "2025-04",
  "2025-05",
  "2025-06",
  "2025-07",
  "2025-08",
  "2025-09",
  "2025-10",
  "2025-11",
  "2025-12",
] as const;

const S_CURVE_PROGRESS = [
  0.02, 0.05, 0.1, 0.18, 0.29, 0.42, 0.56, 0.7, 0.82, 0.91, 0.97, 1,
] as const;

interface FinancialSeed extends Omit<ProjectFinancialBase, "monthlyEVM"> {
  plannedValueToDate: number;
  earnedValueToDate: number;
  actualCostToDate: number;
  evStartRatio: number;
  acStartRatio: number;
}

const roundCurrency = (value: number): number => Math.round(value);

const interpolate = (start: number, end: number, t: number): number =>
  start + (end - start) * t;

function createMonthlyEVM({
  plannedValueToDate,
  earnedValueToDate,
  actualCostToDate,
  evStartRatio,
  acStartRatio,
}: Pick<
  FinancialSeed,
  | "plannedValueToDate"
  | "earnedValueToDate"
  | "actualCostToDate"
  | "evStartRatio"
  | "acStartRatio"
>): EVMDataPoint[] {
  const evEndRatio =
    plannedValueToDate === 0 ? 1 : earnedValueToDate / plannedValueToDate;
  const acEndRatio =
    earnedValueToDate === 0 ? 1 : actualCostToDate / earnedValueToDate;

  const series = FINANCIAL_MONTHS.map((month, index) => {
    const progress = S_CURVE_PROGRESS[index];
    const t = index / (FINANCIAL_MONTHS.length - 1);
    const evRatio = interpolate(evStartRatio, evEndRatio, t);
    const acRatio = interpolate(acStartRatio, acEndRatio, t);

    const plannedValue = roundCurrency(plannedValueToDate * progress);
    const earnedValue = roundCurrency(plannedValue * evRatio);
    const actualCost = roundCurrency(earnedValue * acRatio);

    return {
      month,
      plannedValue,
      earnedValue,
      actualCost,
    };
  });

  series[series.length - 1] = {
    month: FINANCIAL_MONTHS[FINANCIAL_MONTHS.length - 1],
    plannedValue: roundCurrency(plannedValueToDate),
    earnedValue: roundCurrency(earnedValueToDate),
    actualCost: roundCurrency(actualCostToDate),
  };

  return series;
}

const financialSeeds: FinancialSeed[] = [
  {
    projectId: "riverside-medical-center",
    originalContractAmount: 44_600_000,
    approvedChangeOrders: 2_300_000,
    revisedContractAmount: 46_900_000,
    costToDate: 29_900_000,
    committedCosts: 38_400_000,
    estimatedCostAtCompletion: 42_200_000,
    billedToDate: 33_600_000,
    receivedToDate: 30_800_000,
    retainage: 1_680_000,
    costBreakdown: {
      labor: { budget: 15_500_000, actual: 10_900_000, committed: 13_200_000 },
      materials: {
        budget: 8_800_000,
        actual: 6_100_000,
        committed: 7_800_000,
      },
      subcontract: {
        budget: 12_300_000,
        actual: 8_700_000,
        committed: 11_700_000,
      },
      equipment: { budget: 2_900_000, actual: 2_200_000, committed: 2_800_000 },
      overhead: { budget: 2_700_000, actual: 2_000_000, committed: 2_900_000 },
    },
    plannedValueToDate: 29_000_000,
    earnedValueToDate: 27_600_000,
    actualCostToDate: 29_900_000,
    evStartRatio: 0.76,
    acStartRatio: 1.15,
  },
  {
    projectId: "harbor-view-condominiums",
    originalContractAmount: 27_800_000,
    approvedChangeOrders: 1_300_000,
    revisedContractAmount: 29_100_000,
    costToDate: 19_100_000,
    committedCosts: 23_300_000,
    estimatedCostAtCompletion: 24_300_000,
    billedToDate: 22_900_000,
    receivedToDate: 21_400_000,
    retainage: 1_150_000,
    costBreakdown: {
      labor: { budget: 6_600_000, actual: 5_100_000, committed: 6_200_000 },
      materials: { budget: 5_200_000, actual: 4_200_000, committed: 4_900_000 },
      subcontract: {
        budget: 8_800_000,
        actual: 6_900_000,
        committed: 8_500_000,
      },
      equipment: { budget: 1_500_000, actual: 1_100_000, committed: 1_300_000 },
      overhead: { budget: 2_200_000, actual: 1_800_000, committed: 2_400_000 },
    },
    plannedValueToDate: 19_700_000,
    earnedValueToDate: 20_100_000,
    actualCostToDate: 19_100_000,
    evStartRatio: 0.92,
    acStartRatio: 1.02,
  },
  {
    projectId: "techpark-office-complex-phase-2",
    originalContractAmount: 67_100_000,
    approvedChangeOrders: 4_300_000,
    revisedContractAmount: 71_400_000,
    costToDate: 41_900_000,
    committedCosts: 60_100_000,
    estimatedCostAtCompletion: 66_300_000,
    billedToDate: 37_200_000,
    receivedToDate: 33_100_000,
    retainage: 1_860_000,
    costBreakdown: {
      labor: {
        budget: 20_400_000,
        actual: 12_600_000,
        committed: 17_500_000,
      },
      materials: {
        budget: 13_700_000,
        actual: 8_400_000,
        committed: 12_900_000,
      },
      subcontract: {
        budget: 22_500_000,
        actual: 14_000_000,
        committed: 21_400_000,
      },
      equipment: { budget: 4_800_000, actual: 3_100_000, committed: 3_900_000 },
      overhead: { budget: 4_900_000, actual: 3_800_000, committed: 4_400_000 },
    },
    plannedValueToDate: 40_000_000,
    earnedValueToDate: 35_200_000,
    actualCostToDate: 41_900_000,
    evStartRatio: 0.7,
    acStartRatio: 1.21,
  },
  {
    projectId: "downtown-parking-structure",
    originalContractAmount: 12_000_000,
    approvedChangeOrders: 600_000,
    revisedContractAmount: 12_600_000,
    costToDate: 9_550_000,
    committedCosts: 10_500_000,
    estimatedCostAtCompletion: 10_900_000,
    billedToDate: 10_800_000,
    receivedToDate: 10_100_000,
    retainage: 540_000,
    costBreakdown: {
      labor: { budget: 2_500_000, actual: 2_200_000, committed: 2_400_000 },
      materials: { budget: 2_100_000, actual: 1_900_000, committed: 2_000_000 },
      subcontract: { budget: 4_600_000, actual: 3_800_000, committed: 4_400_000 },
      equipment: { budget: 800_000, actual: 700_000, committed: 800_000 },
      overhead: { budget: 900_000, actual: 950_000, committed: 900_000 },
    },
    plannedValueToDate: 10_200_000,
    earnedValueToDate: 10_300_000,
    actualCostToDate: 9_550_000,
    evStartRatio: 0.95,
    acStartRatio: 0.99,
  },
  {
    projectId: "greenfield-elementary-school",
    originalContractAmount: 18_500_000,
    approvedChangeOrders: 700_000,
    revisedContractAmount: 19_200_000,
    costToDate: 7_800_000,
    committedCosts: 12_500_000,
    estimatedCostAtCompletion: 17_100_000,
    billedToDate: 8_100_000,
    receivedToDate: 7_200_000,
    retainage: 410_000,
    costBreakdown: {
      labor: { budget: 5_100_000, actual: 2_300_000, committed: 3_900_000 },
      materials: { budget: 3_700_000, actual: 1_600_000, committed: 2_600_000 },
      subcontract: { budget: 6_200_000, actual: 2_500_000, committed: 4_500_000 },
      equipment: { budget: 800_000, actual: 300_000, committed: 500_000 },
      overhead: { budget: 1_300_000, actual: 1_100_000, committed: 1_000_000 },
    },
    plannedValueToDate: 7_600_000,
    earnedValueToDate: 7_000_000,
    actualCostToDate: 7_800_000,
    evStartRatio: 0.79,
    acStartRatio: 1.13,
  },
  {
    projectId: "sunset-strip-hotel-renovation",
    originalContractAmount: 22_000_000,
    approvedChangeOrders: 800_000,
    revisedContractAmount: 22_800_000,
    costToDate: 3_100_000,
    committedCosts: 6_600_000,
    estimatedCostAtCompletion: 20_300_000,
    billedToDate: 2_900_000,
    receivedToDate: 2_300_000,
    retainage: 150_000,
    costBreakdown: {
      labor: { budget: 5_800_000, actual: 900_000, committed: 2_000_000 },
      materials: { budget: 4_300_000, actual: 800_000, committed: 1_500_000 },
      subcontract: { budget: 6_900_000, actual: 1_000_000, committed: 2_300_000 },
      equipment: { budget: 1_200_000, actual: 100_000, committed: 300_000 },
      overhead: { budget: 2_100_000, actual: 300_000, committed: 500_000 },
    },
    plannedValueToDate: 3_200_000,
    earnedValueToDate: 2_700_000,
    actualCostToDate: 3_100_000,
    evStartRatio: 0.72,
    acStartRatio: 1.16,
  },
];

export const mockProjectFinancials: Record<string, ProjectFinancialBase> =
  financialSeeds.reduce<Record<string, ProjectFinancialBase>>((acc, seed) => {
    const {
      plannedValueToDate,
      earnedValueToDate,
      actualCostToDate,
      evStartRatio,
      acStartRatio,
      ...financialBase
    } = seed;

    acc[seed.projectId] = {
      ...financialBase,
      costBreakdown: financialBase.costBreakdown as CostBreakdown,
      monthlyEVM: createMonthlyEVM({
        plannedValueToDate,
        earnedValueToDate,
        actualCostToDate,
        evStartRatio,
        acStartRatio,
      }),
    };

    return acc;
  }, {});
