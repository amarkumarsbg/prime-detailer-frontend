"use client";

import { Button } from "@/components/ui/button";
import {
  Car,
  Users,
  ClipboardList,
  Receipt,
  Package,
  Calendar,
  UserCog,
  Wrench,
  History,
  BarChart3,
  Search,
  Plus,
} from "lucide-react";

type EmptyStateType =
  | "vehicles"
  | "customers"
  | "job-cards"
  | "billing"
  | "inventory"
  | "appointments"
  | "staff"
  | "services"
  | "activity"
  | "reports"
  | "search"
  | "generic";

const EMPTY_STATE_CONFIG: Record<EmptyStateType, { icon: React.ElementType; title: string; description: string }> = {
  vehicles: { icon: Car, title: "No vehicles yet", description: "Register your first vehicle to start tracking service history." },
  customers: { icon: Users, title: "No customers yet", description: "Add your first customer to get started with the CRM." },
  "job-cards": { icon: ClipboardList, title: "No job cards", description: "Create a job card when a vehicle comes in for service." },
  billing: { icon: Receipt, title: "No invoices yet", description: "Invoices will appear here once job cards are completed." },
  inventory: { icon: Package, title: "No parts in inventory", description: "Add parts to start tracking your stock levels." },
  appointments: { icon: Calendar, title: "No appointments", description: "Schedule your first appointment to manage bookings." },
  staff: { icon: UserCog, title: "No staff members", description: "Add team members to assign them to job cards." },
  services: { icon: Wrench, title: "No services", description: "Add services to build your service catalog." },
  activity: { icon: History, title: "No activity yet", description: "System activity will be logged here automatically." },
  reports: { icon: BarChart3, title: "No data to report", description: "Reports will populate as you use the system." },
  search: { icon: Search, title: "No results found", description: "Try adjusting your search or filters." },
  generic: { icon: ClipboardList, title: "Nothing here yet", description: "Data will appear here once available." },
};

interface EmptyStateProps {
  type: EmptyStateType;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ type, actionLabel, onAction }: EmptyStateProps) {
  const { icon: Icon, title, description } = EMPTY_STATE_CONFIG[type];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mb-4">
        <Icon className="w-8 h-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} className="mt-4">
          <Plus className="w-4 h-4 mr-2" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
