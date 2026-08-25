export interface Sender {
  id: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SenderVerificationResult {
  fullName: string;
  phone: string;
}

export interface SenderAddress {
  npAddressRef: string;
  description: string;
}

export interface CreateSenderPayload {
  apiKey: string;
  cityRef: string;
  warehouseRef: string;
}

export interface SetSenderWarehousePayload {
  cityRef: string;
  warehouseRef: string;
}
