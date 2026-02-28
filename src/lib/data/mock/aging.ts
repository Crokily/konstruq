import type { AgingReport } from "@/lib/data/providers/interface";

export const mockAgingReport: AgingReport = {
  ar: [
    { label: "Current", amount: 4_200_000, count: 28 },
    { label: "1-30", amount: 2_100_000, count: 19 },
    { label: "31-60", amount: 1_300_000, count: 12 },
    { label: "61-90", amount: 800_000, count: 8 },
    { label: "90+", amount: 400_000, count: 5 },
  ],
  ap: [
    { label: "Current", amount: 3_800_000, count: 31 },
    { label: "1-30", amount: 1_900_000, count: 22 },
    { label: "31-60", amount: 1_100_000, count: 14 },
    { label: "61-90", amount: 500_000, count: 7 },
    { label: "90+", amount: 200_000, count: 4 },
  ],
};
