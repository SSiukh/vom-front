import type { ProductBrand } from '../../../shared/models/product-brand.model';

export interface Expense {
  id: string;
  typeId: string;
  name: string | null;
  amount: number;
  brand: ProductBrand | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExpensePayload {
  typeId: string;
  name?: string;
  amount: number;
  brand: ProductBrand | null;
}

export type UpdateExpensePayload = Partial<CreateExpensePayload>;
