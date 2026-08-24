export interface CrmRow {
  id: string;
  createdAt: string;
  npWaybillNumber: string | null;
  paymentTypeId: string;
  recipientFullName: string;
  recipientPhone: string;
  totalAmount: number;
  shipmentStatusId: string | null;
  productTypeIds: string[];
}

export interface CrmTableResponse {
  items: CrmRow[];
  total: number;
  totalAmountSum: number;
}
