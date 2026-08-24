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
  orderCount: number;
  revenueByDay: RevenueByDay[];
  expensesByCategory: ExpenseCategoryBreakdown[];
  shipmentStatusBreakdown: ShipmentStatusBreakdown[];
}
