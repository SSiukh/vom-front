export interface Product {
  id: string;
  typeId: string;
  name: string;
  photoUrl: string;
  price: number;
  promoPrice: number | null;
  stockQuantity: number;
  createdAt: string;
  updatedAt: string;
}
