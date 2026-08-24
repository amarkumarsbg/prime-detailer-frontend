export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  referralCode: string;
  referredBy?: string;
  totalVisits: number;
  rewardPoints: number;
  walletBalance: number;
  lastVisitDate?: string;
  isInactive?: boolean;
  /** Demo: counts toward “verified email” on users overview */
  emailVerified?: boolean;  /** Profile photo stored as a data URL (same format as User.avatar). */
  avatar?: string | null;  createdAt: string;
}

export interface WalletTransaction {
  id: string;
  customerId: string;
  customerName: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  source: "REFERRAL_REWARD" | "LOYALTY_POINTS" | "ADMIN_CREDIT" | "INVOICE_PAYMENT" | "REFUND";
  referenceId?: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastVisitDate: string;
  daysSinceLastVisit: number;
  assignedTo?: string;
  assignedToName?: string;
  status: "PENDING" | "CALLED" | "SCHEDULED" | "NOT_INTERESTED" | "REENGAGED";
  callNotes?: string;
  nextCallbackDate?: string;
  createdAt: string;
  updatedAt: string;
}
