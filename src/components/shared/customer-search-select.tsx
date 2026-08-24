"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import { Search, ChevronDown, Check, User } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useVehicleStore } from "@/store/vehicle-store";
import type { Customer } from "@/types";
import { cn } from "@/lib/utils";

interface CustomerSearchSelectProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (id: string) => void;
  placeholder?: string;
  className?: string;
}

export function CustomerSearchSelect({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  placeholder = "Select customer...",
  className,
}: CustomerSearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const vehicleList = useVehicleStore((s) => s.vehicles);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) ?? null;
  }, [customers, selectedCustomerId]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return customers;

    return customers.filter((c) => {
      const nameMatch = c.name.toLowerCase().includes(query);
      
      const queryDigits = query.replace(/\D/g, "");
      const phoneMatch = queryDigits ? c.phone.replace(/\D/g, "").includes(queryDigits) : false;

      // Check vehicle registration numbers
      const customerVehicles = vehicleList.filter((v) => v.customerId === c.id);
      const vehicleMatch = customerVehicles.some((v) =>
        v.registrationNumber.toLowerCase().includes(query)
      );

      return nameMatch || phoneMatch || vehicleMatch;
    });
  }, [customers, search, vehicleList]);

  // Limit displayed results to top 50 to maintain fast rendering performance
  const displayedCustomers = useMemo(() => {
    return filtered.slice(0, 50);
  }, [filtered]);

  // Find customer vehicles to display selected customer's active vehicle summary
  const selectedCustomerVehicles = useMemo(() => {
    if (!selectedCustomer) return [];
    return vehicleList.filter((v) => v.customerId === selectedCustomer.id);
  }, [selectedCustomer, vehicleList]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left font-normal h-10 px-3 py-2", className)}
        >
          {selectedCustomer ? (
            <div className="flex flex-col min-w-0 leading-tight text-left">
              <span className="font-semibold text-sm truncate">{selectedCustomer.name}</span>
              <span className="text-[11px] text-muted-foreground truncate">
                {selectedCustomer.phone}
                {selectedCustomerVehicles.length > 0 && ` • ${selectedCustomerVehicles[0].registrationNumber}`}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="flex items-center border-b border-border px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            placeholder="Search by name, phone, or vehicle number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div 
          className="max-h-64 overflow-y-auto p-1 pb-3 space-y-1"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {displayedCustomers.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No customer found
            </div>
          ) : (
            <>
              {displayedCustomers.map((c) => {
                const active = c.id === selectedCustomerId;
                const customerVehicles = vehicleList.filter((v) => v.customerId === c.id);

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer(c.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors",
                      active && "bg-accent text-accent-foreground"
                    )}
                  >
                    <User className="h-4 w-4 shrink-0 mt-0.5 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.phone}</div>
                      {customerVehicles.length > 0 && (
                        <div className="text-[10px] text-primary/80 font-medium truncate mt-0.5">
                          Vehicles: {customerVehicles.map((v) => v.registrationNumber).join(", ")}
                        </div>
                      )}
                    </div>
                    {active && <Check className="ml-auto h-4 w-4 shrink-0 mt-0.5 text-primary" />}
                  </button>
                );
              })}
              {filtered.length > 50 && (
                <div className="py-2 text-center text-[10px] text-muted-foreground border-t border-border/50 sticky bottom-0 bg-popover">
                  Showing top 50 matches. Refine search to see more.
                </div>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
