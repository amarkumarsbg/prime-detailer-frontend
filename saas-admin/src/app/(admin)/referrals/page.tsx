"use client";
import { useEffect, useState } from "react";
import { Tag, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Topbar } from "@/components/layout/topbar";
import { ErrorBanner } from "@/components/shared/error-banner";
import { RefreshingBar } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { FilterBar } from "@/components/shared/filter-bar";
import { AdminTable, THead, Th, TBody, Tr, Td, AdminTableSkeleton } from "@/components/shared/admin-table";
import { listPlatformReferrals, createPlatformReferral, type PlatformReferralCode } from "@/api/platform";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function ReferralsPage() {
  const [codes, setCodes] = useState<PlatformReferralCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCode, setNewCode] = useState("");
  const [newDiscount, setNewDiscount] = useState(1000);
  const [newNotes, setNewNotes] = useState("");

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError(null);
    try { const res = await listPlatformReferrals(showInactive); setCodes(res.referralCodes); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); setRefreshing(false); }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [showInactive]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const code = newCode.trim().toUpperCase();
    if (!code) { toast.error("Code is required"); return; }
    if (!/^[A-Z0-9-]{4,24}$/.test(code)) { toast.error("4–24 uppercase letters, digits, or hyphens only."); return; }
    setCreating(true);
    try {
      await createPlatformReferral({ code, discountAmount: newDiscount, notes: newNotes || undefined });
      toast.success(`Code ${code} created.`);
      setShowForm(false); setNewCode(""); setNewDiscount(1000); setNewNotes("");
      await load(true);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    finally { setCreating(false); }
  }

  const newCodeBtn = (
    <button onClick={() => setShowForm((v) => !v)} style={{ display: "flex", alignItems: "center", gap: "5px", height: "32px", padding: "0 12px", borderRadius: "6px", border: "none", background: "#2563eb", color: "#fff", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>
      <Plus style={{ width: "13px", height: "13px" }} /> New Code
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Topbar title="Referral Codes" description="Subscription referral code management" actions={newCodeBtn} />
      {showForm && (
        <div style={{ padding: "12px 24px", borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
          <form onSubmit={handleCreate} style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#64748b", marginBottom: "4px" }}>Code (uppercase, 4-24 chars)</div>
              <input placeholder="PARTNER-2026" value={newCode} onChange={(e) => setNewCode(e.target.value.toUpperCase())} required
                style={{ height: "36px", padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px", width: "160px", outline: "none" }} />
            </div>
            <div>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#64748b", marginBottom: "4px" }}>Discount (₹)</div>
              <input type="number" min={0} value={newDiscount} onChange={(e) => setNewDiscount(Number(e.target.value))}
                style={{ height: "36px", padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px", width: "100px", outline: "none" }} />
            </div>
            <div style={{ flex: 1, minWidth: "180px" }}>
              <div style={{ fontSize: "11px", fontWeight: 500, color: "#64748b", marginBottom: "4px" }}>Notes (optional)</div>
              <input placeholder="Partner notes…" value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                style={{ height: "36px", padding: "0 10px", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "13px", width: "100%", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="submit" disabled={creating} style={{ display: "flex", alignItems: "center", gap: "5px", height: "36px", padding: "0 16px", borderRadius: "6px", border: "none", background: creating ? "#93c5fd" : "#2563eb", color: "#fff", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>
                {creating && <Loader2 style={{ width: "13px", height: "13px", animation: "spin 1s linear infinite" }} />}
                {creating ? "Creating…" : "Create"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ height: "36px", padding: "0 14px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", color: "#374151", fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            </div>
          </form>
        </div>
      )}
      <FilterBar onRefresh={() => load(true)} refreshing={loading}>
        <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
      </FilterBar>
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", background: "#f8fafc" }}>
        {error && <div style={{ marginBottom: "12px" }}><ErrorBanner message={error} onRetry={load} /></div>}
        {loading ? <AdminTableSkeleton rows={5} cols={5} /> : codes.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
            <EmptyState icon={Tag} title="No referral codes yet" description="Create your first referral code using the button above." />
          </div>
        ) : (
          <AdminTable>
            <THead><tr><Th>Code</Th><Th>Discount</Th><Th>Status</Th><Th>Created By</Th><Th>Notes</Th><Th>Created</Th></tr></THead>
            <TBody>
              {codes.map((c) => (
                <Tr key={c.id}>
                  <Td><span style={{ fontFamily: "monospace", fontWeight: 600, letterSpacing: "0.04em" }}>{c.code}</span></Td>
                  <Td><span style={{ color: "#16a34a", fontWeight: 500 }}>{formatCurrency(c.discountAmount)}</span></Td>
                  <Td><span style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: c.isActive ? "#f0fdf4" : "#f8fafc", color: c.isActive ? "#16a34a" : "#94a3b8", border: `1px solid ${c.isActive ? "#bbf7d0" : "#e2e8f0"}` }}>{c.isActive ? "Active" : "Inactive"}</span></Td>
                  <Td muted>{c.createdBy}</Td>
                  <Td muted>{c.notes ?? "—"}</Td>
                  <Td muted nowrap>{formatDate(c.createdAt)}</Td>
                </Tr>
              ))}
            </TBody>
          </AdminTable>
        )}
      </div>
    </div>
  );
}