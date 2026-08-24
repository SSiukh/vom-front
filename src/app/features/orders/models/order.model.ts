export interface OrderItem {
  productId: string | null;
  productTypeId: string;
  nameSnapshot: string;
  photoUrlSnapshot: string | null;
  price: number;
  isPromo: boolean;
  quantity: number;
  subtotal: number;
}

export interface Recipient {
  phone: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
}

export interface DeliveryDetails {
  cityRef: string;
  warehouseRef: string | null;
  streetRef: string | null;
  house: string | null;
  apartment: string | null;
  postomatRef: string | null;
}

export interface Order {
  id: string;
  shipmentTypeId: string;
  paymentTypeId: string;
  partialAmount: number | null;
  totalAmount: number;
  items: OrderItem[];
  senderId: string;
  senderAddressRef: string;
  recipient: Recipient;
  deliveryTypeId: string;
  deliveryDetails: DeliveryDetails;
  npWaybillNumber: string | null;
  npWaybillRef: string | null;
  shipmentStatusId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemPayload {
  productTypeId: string;
  productId?: string;
  name?: string;
  price?: number;
  quantity: number;
  isPromo?: boolean;
}

export interface CreateOrderPayload {
  shipmentTypeId: string;
  paymentTypeId: string;
  partialAmount?: number;
  items: CreateOrderItemPayload[];
  senderId: string;
  senderAddressRef: string;
  recipient: {
    phone: string;
    lastName: string;
    firstName: string;
    middleName?: string;
  };
  deliveryTypeId: string;
  deliveryDetails: {
    cityRef: string;
    warehouseRef?: string;
    streetRef?: string;
    house?: string;
    apartment?: string;
    postomatRef?: string;
  };
}

export interface UpdateOrderPayload {
  shipmentTypeId?: string;
  paymentTypeId?: string;
  partialAmount?: number;
  items?: CreateOrderItemPayload[];
}
