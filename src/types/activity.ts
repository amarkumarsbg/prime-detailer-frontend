export type ActivityEntityType =
  | "JOB_CARD"
  | "CUSTOMER"
  | "VEHICLE"
  | "INVOICE"
  | "APPOINTMENT"
  | "INVENTORY"
  | "STAFF"
  | "LEAVE"
  | "PAYROLL"
  | "STAFF_REWARD"
  | "QUOTATION"
  | "EXPENSE"
  | "WALLET";

export type ActivityAction =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "PAYMENT_RECEIVED"
  | "ASSIGNED"
  | "COMPLETED"
  | "CANCELLED"
  | "STOCK_ADJUSTED"
  | "WHATSAPP_SENT"
  | "EMAIL_SENT"
  | "MECHANIC_SWITCHED"
  | "OWNERSHIP_TRANSFERRED"
  | "WALLET_CREDITED"
  | "WALLET_DEBITED";

export interface ActivityLog {
  id: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityLabel: string;
  userId: string;
  userName: string;
  details: string;
  createdAt: string;
}
