export interface PartRow {
  partName: string;
  customName?: string;
  quantity: number;
  measurement: string;
}

export interface OrderItem {
  id: string;
  code: string;
  clientId?: string | null;
  clientName: string;
  clientLastName: string;
  clientCI: string;
  clientPhone: string;
  clientAddress: string;
  engineModel: string;
  parts: PartRow[];
  services: { name: string; priceUSD: number }[];
  inventoryItems?: {
    id: string;
    name: string;
    priceUSD: number;
    quantity: number;
  }[];
  totalUSD: number;
  totalVES: number;
  paidUSD?: number;
  balanceUSD?: number;
  entryDate: string;
  deliveryDays: number;
  tentativeDeliveryDate: string;
  paymentStatus: "Paga" | "Abonada" | "Pendiente por cobrar";
  orderStatus?: "Ingresado" | "Parcialmente retirado" | "Retirado" | "Cancelada";
  cancelReason?: string | null;
  canceledAt?: string | null;
  canceledBy?: string | null;
  canceledByUserId?: string | null;
  priority: "Baja" | "Media" | "Alta";
  responsible?: string;
  createdBy: string;
  createdByUserId?: string;
}

export interface OrderPartDeliveryRow {
  id: string;
  orderId: string;
  partIndex: number;
  quantity: number;
  note: string;
  deliveredAt: string;
  createdBy: string | null;
  createdByUserId: string | null;
}

export interface OrderPaymentRow {
  id: string;
  orderId: string;
  paidAt: string;
  currency: "USD" | "VES";
  amount: number;
  paidUSD: number;
  paidVES: number | null;
  exchangeRate: number | null;
  note: string;
  createdBy: string | null;
  createdByUserId: string | null;
}
