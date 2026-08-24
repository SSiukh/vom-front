export interface Expense {
  id: string;
  typeId: string;
  name: string | null;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpensePayload {
  typeId: string;
  name?: string;
  amount: number;
}

export type UpdateExpensePayload = Partial<CreateExpensePayload>;
