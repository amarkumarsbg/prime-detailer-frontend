"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useCommunicationStore } from "@/store/communication-store";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Mail,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { formatDate, cn } from "@/lib/utils";
import type { CustomerMessage } from "@/types";

export default function MessagesLogPage() {
  const messages = useCommunicationStore((s) => s.messages);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // 1. Search matching
      const s = search.toLowerCase().trim();
      const matchSearch =
        !s ||
        msg.recipient.toLowerCase().includes(s) ||
        (msg.customerName && msg.customerName.toLowerCase().includes(s)) ||
        (msg.subject && msg.subject.toLowerCase().includes(s)) ||
        msg.body.toLowerCase().includes(s);

      // 2. Type matching
      const matchType = typeFilter === "all" || msg.type === typeFilter;

      // 3. Status matching
      const matchStatus = statusFilter === "all" || msg.status === statusFilter;

      return matchSearch && matchType && matchStatus;
    });
  }, [messages, search, typeFilter, statusFilter]);

  const handleResetFilters = () => {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Messages Log"
        description="View and track all transactional emails, SMS, and WhatsApp messages delivered to customers."
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by recipient, customer name, subject, message content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex gap-2 shrink-0">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[130px] bg-background">
              <SelectValue placeholder="Channel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="sent">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          {(search || typeFilter !== "all" || statusFilter !== "all") && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleResetFilters}
              title="Reset Filters"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {filteredMessages.length === 0 ? (
        <Card className="border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No communication logs found matching filters.</p>
            {(search || typeFilter !== "all" || statusFilter !== "all") && (
              <Button variant="link" onClick={handleResetFilters} className="mt-2">
                Clear all filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((msg) => {
            const isEmail = msg.type === "email";
            const isWhatsApp = msg.type === "whatsapp";
            const isExpanded = expandedIds[msg.id];
            const displayBody = isEmail
              ? msg.body
              : msg.body.length > 250 && !isExpanded
              ? `${msg.body.slice(0, 250)}...`
              : msg.body;

            return (
              <div
                key={msg.id}
                className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm hover:bg-card/90 transition-all hover:shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "p-2.5 rounded-xl shrink-0 mt-0.5",
                        isWhatsApp
                          ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                          : isEmail
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      )}
                    >
                      {isWhatsApp ? (
                        <MessageSquare className="w-5 h-5" />
                      ) : isEmail ? (
                        <Mail className="w-5 h-5" />
                      ) : (
                        <MessageSquare className="w-5 h-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-sm capitalize">
                          {msg.type} Channel
                        </span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full",
                            msg.status === "sent"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                          )}
                        >
                          {msg.status === "sent" ? "Delivered" : "Failed"}
                        </span>
                      </div>

                      <div className="text-sm text-foreground/80 font-medium">
                        To:{" "}
                        {msg.customerId ? (
                          <Link
                            href={`/customers/${msg.customerId}`}
                            className="text-primary hover:underline font-semibold"
                          >
                            {msg.customerName} ({msg.recipient})
                          </Link>
                        ) : (
                          <span className="text-muted-foreground italic">
                            Unregistered Customer ({msg.recipient})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-xs text-muted-foreground shrink-0 md:self-start">
                    {formatDate(msg.createdAt)}
                  </div>
                </div>

                {msg.subject && (
                  <div className="mt-3 flex items-center gap-1.5 text-sm font-semibold border-b border-border/40 pb-2">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>Subject: {msg.subject}</span>
                  </div>
                )}

                <div className="mt-3">
                  {isEmail ? (
                    <div className="relative">
                      <div
                        className={cn(
                          "text-xs text-muted-foreground border border-border/50 rounded-lg p-3 bg-muted/20 overflow-x-auto max-h-[160px] overflow-y-auto transition-all",
                          isExpanded && "max-h-[800px]"
                        )}
                        dangerouslySetInnerHTML={{ __html: displayBody }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(msg.id)}
                        className="mt-2 text-muted-foreground text-xs h-7 hover:text-foreground"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3.5 h-3.5 mr-1" /> Collapse Email Body
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3.5 h-3.5 mr-1" /> Expand Email Body
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm text-foreground/90 whitespace-pre-wrap border border-border/50 rounded-lg p-3 bg-muted/20">
                        {displayBody}
                      </div>
                      {msg.body.length > 250 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(msg.id)}
                          className="mt-1 text-muted-foreground text-xs h-7 hover:text-foreground"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5 mr-1" /> Read Less
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5 mr-1" /> Read More
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {msg.error && (
                  <p className="text-xs text-rose-600 mt-2 font-medium bg-rose-50 dark:bg-rose-950/20 p-2.5 rounded-lg border border-rose-150 dark:border-rose-900/30">
                    Error Reason: {msg.error}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
