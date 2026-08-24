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
