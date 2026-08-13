import type { MembershipTier, VehicleSegment } from "@/types";

export function highEndComparisonTag(name: string): string | undefined {
  const n = name.toLowerCase();
  if (n.includes("ppf")) return "Best Protection";
  if (n.includes("graphene")) return "Longest Durability";
  if (n.includes("ceramic") || n.includes("ceram")) return "Best Shine";
  return undefined;
}

export function formatExpectedDeliveryDate(date: Date | string | null | undefined): string {
  if (!date) return "Not set";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Not set";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${month} ${day}, ${year}, ${hours}:${minutes} ${ampm}`;
}

export function segmentBannerLabel(seg: VehicleSegment | ""): string {
  if (!seg) return "vehicle";
  if (seg === "BIKE") return "bike";
  return seg.replace(/_/g, " ").toLowerCase();
}

export function formatHighEndIntervalMonths(m: number): string {
  return m >= 12 ? `${m / 12}yr` : `${m}mo`;
}

export function membershipTierLabel(tier: MembershipTier): string {
  switch (tier) {
    case "MONTHLY":
      return "Monthly";
    case "QUARTERLY":
      return "Quarterly";
    case "HALF_YEARLY":
      return "Half-yearly";
    case "YEARLY":
      return "Yearly";
    default:
      return tier;
  }
}
