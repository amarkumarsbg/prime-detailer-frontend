import type { JobCard } from "./job-card";

export interface DashboardStats {
  /** Demo aggregate customer satisfaction (0–5). */
  averageRating: number;
  carsReceivedToday: number;
  carsDeliveredToday: number;
  inProgressServices: number;
  dailyRevenue: number;
  totalExpensesToday: number;
  netProfitToday: number;
  newCustomersToday: number;
  inactiveCustomers: number;
  activeJobCards: number;
  pendingPayments: number;
  monthlyRevenue: { month: string; revenue: number; expenses: number; profit: number }[];
  serviceBreakdown: { name: string; count: number }[];
  todaysBookings: JobCard[];
  readyForDelivery: JobCard[];
}
