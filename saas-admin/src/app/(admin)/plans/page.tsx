"use client";
import { Topbar } from "@/components/layout/topbar";
import { AdminTable, THead, Th, TBody, Tr, Td } from "@/components/shared/admin-table";
import { Info } from "lucide-react";

const PLANS = [
  { code: "STARTER", name: "Starter", branches: 1, users: 3, desc: "Solo or single-location studio" },
  { code: "GROWTH", name: "Growth", branches: 3, users: 10, desc: "Multi-location growth stage" },
  { code: "BUSINESS", name: "Business", branches: 10, users: 25, desc: "Established multi-branch operations" },
  { code: "ENTERPRISE", name: "Enterprise", branches: null, users: null, desc: "Unlimited branches and users" },
  { code: "CUSTOM", name: "Custom", branches: 1, users: 3, desc: "Negotiated custom arrangement" },
];

const TERM_PRICING = [
  { label: "1 Year (12 months)", env: "SUBSCRIPTION_BASE_PRICE_12", default: "₹9,999" },
  { label: "2 Years (24 months)", env: "SUBSCRIPTION_BASE_PRICE_24", default: "₹18,999" },
  { label: "3 Years (36 months)", env: "SUBSCRIPTION_BASE_PRICE_36", default: "₹26,999" },
  { label: "5 Years (60 months)", env: "SUBSCRIPTION_BASE_PRICE_60", default: "₹41,999" },
];

const ADDONS = [
  { label: "Extra Branch", env: "SUBSCRIPTION_EXTRA_BRANCH_PRICE", default: "₹2,500 / branch" },
  { label: "Extra User", env: "SUBSCRIPTION_EXTRA_USER_PRICE", default: "₹750 / user" },
  { label: "Onboarding Fee", env: "SUBSCRIPTION_ONBOARDING_FEE", default: "₹1,500 (first sub only)" },
  { label: "Referral Discount", env: "SUBSCRIPTION_REFERRAL_DISCOUNT", default: "₹1,000" },
  { label: "GST Rate", env: "SUBSCRIPTION_GST_PERCENT", default: "18%" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", margin: "0 0 8px" }}>{children}</h2>;
}

export default function PlansPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <Topbar title="Plans & Pricing" description="Plan catalog and pricing configuration" />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "#f8fafc" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", marginBottom: "20px", fontSize: "13px", color: "#1d4ed8" }}>
          <Info style={{ width: "14px", height: "14px", marginTop: "2px", flexShrink: 0 }} />
          <span>Pricing is configured via backend environment variables. Update the backend <code style={{ background: "#dbeafe", padding: "1px 4px", borderRadius: "3px" }}>.env</code> and restart the API to change prices.</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div>
            <SectionTitle>Plan Catalog</SectionTitle>
            <AdminTable>
              <THead><tr><Th>Plan</Th><Th>Code</Th><Th>Included Branches</Th><Th>Included Users</Th><Th>Description</Th></tr></THead>
              <TBody>{PLANS.map((p) => (<Tr key={p.code}><Td style={{ fontWeight: 500 }}>{p.name}</Td><Td mono muted>{p.code}</Td><Td muted>{p.branches ?? "Unlimited"}</Td><Td muted>{p.users ?? "Unlimited"}</Td><Td muted>{p.desc}</Td></Tr>))}</TBody>
            </AdminTable>
          </div>
          <div>
            <SectionTitle>Base Term Pricing (Starter)</SectionTitle>
            <AdminTable>
              <THead><tr><Th>Term</Th><Th>Environment Variable</Th><Th>Default</Th></tr></THead>
              <TBody>{TERM_PRICING.map((p) => (<Tr key={p.env}><Td style={{ fontWeight: 500 }}>{p.label}</Td><Td mono muted>{p.env}</Td><Td muted>{p.default}</Td></Tr>))}</TBody>
            </AdminTable>
            <p style={{ fontSize: "11px", color: "#94a3b8", margin: "6px 0 0" }}>Multipliers: Growth ×1.8 · Business ×3 · Enterprise ×5 · Custom ×1 (via SUBSCRIPTION_PRICE_MULTIPLIER_* env vars)</p>
          </div>
          <div>
            <SectionTitle>Add-on Pricing</SectionTitle>
            <AdminTable>
              <THead><tr><Th>Add-on</Th><Th>Environment Variable</Th><Th>Default</Th></tr></THead>
              <TBody>{ADDONS.map((a) => (<Tr key={a.env}><Td style={{ fontWeight: 500 }}>{a.label}</Td><Td mono muted>{a.env}</Td><Td muted>{a.default}</Td></Tr>))}</TBody>
            </AdminTable>
          </div>
        </div>
      </div>
    </div>
  );
}