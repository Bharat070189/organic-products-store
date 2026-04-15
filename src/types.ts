export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
  createdAt: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerPincode: string;
  paymentMethod: 'cod' | 'online';
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: number;
}

export interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  isActive: boolean;
  createdAt: number;
}

export interface Banner {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  link?: string;
  isActive: boolean;
  createdAt: number;
}

export interface AppSettings {
  shippingCharge: number;
  minOrderForFreeShipping: number;
  lowStockThreshold: number;
  razorpayEnabled?: boolean;
}

export interface SavedAddress {
  id: string;
  label: 'Home' | 'Office' | 'Other';
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  mobile?: string;
  addresses?: SavedAddress[];
  createdAt?: number;
}

export interface Category {
  id: string;
  name: string;
  createdAt: number;
}
