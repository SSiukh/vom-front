export interface RevenueByDay {
  date: string;
  revenue: number;
}

export interface ExpenseCategoryBreakdown {
  expenseTypeId: string;
  label: string;
  amount: number;
}

export interface ShipmentStatusBreakdown {
  shipmentStatusId: string;
  label: string;
  count: number;
}

export interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  realizedRevenue: number;
  pendingRevenue: number;
  lostRevenue: number;
  sharedExpenses: number | null;
  orderCount: number;
  revenueByDay: RevenueByDay[];
  expensesByCategory: ExpenseCategoryBreakdown[];
  shipmentStatusBreakdown: ShipmentStatusBreakdown[];
}
