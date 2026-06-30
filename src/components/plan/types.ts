export type PlanItem = {
  id: string;
  sourceId: string;
  text: string;
  done: boolean;
  createdAt: string;
  completedAt?: string | null;
  carryOverFrom?: string | null;
  order: number;
};

export type DailyPlan = {
  date: string;
  items: PlanItem[];
};

export type DailyPlanTemplate = {
  id: string;
  name: string;
  items: string[];
  createdAt: string;
};
