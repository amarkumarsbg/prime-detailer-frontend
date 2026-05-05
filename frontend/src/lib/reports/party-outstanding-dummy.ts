/** Demo receivable / ageing rows aligned with reference UI amounts. */

export type AgeingBucketRow = {
  id: string;
  partyName: string;
  byTomorrow: number | null;
  upcoming: number | null;
  totalDue: number | null;
  d1to15: number | null;
  d16to30: number | null;
  d30plus: number | null;
  totalOverdue: number | null;
  totalAmount: number;
};

export const AGEING_DUMMY_ROWS: AgeingBucketRow[] = [
  {
    id: "a1",
    partyName: "GARWARE HI-TECH FILMS LIMITED",
    byTomorrow: null,
    upcoming: null,
    totalDue: null,
    d1to15: null,
    d16to30: null,
    d30plus: 47400.6,
    totalOverdue: 47400.6,
    totalAmount: 47400.6,
  },
  {
    id: "a2",
    partyName: "HI TECH CAR SPA & DETAILING",
    byTomorrow: null,
    upcoming: null,
    totalDue: null,
    d1to15: null,
    d16to30: null,
    d30plus: 217,
    totalOverdue: 217,
    totalAmount: 217,
  },
];

export type OutstandingPartyRow = {
  id: string;
  name: string;
  category: string | null;
  contact: string | null;
  /** Positive = to collect, negative = to pay */
  closingBalance: number | null;
};

const EXTRA_NAMES: { name: string; contact: string | null }[] = [
  { name: "AAKASH", contact: null },
  { name: "Abhishek YADAV", contact: "7880721596" },
  { name: "AKASH SRIVASTAV", contact: "9066000369" },
  { name: "ALLOY PLANET", contact: "9837634365" },
  { name: "Ambrish Singh", contact: null },
  { name: "BROTHERS AUTO", contact: null },
  { name: "Cash Sale", contact: "6391356666" },
  { name: "DAADS", contact: "9565999955" },
  { name: "DCLARIO TECHNOLOGIES INDIA PRIVATE LIMITED", contact: null },
  { name: "GANPATI ENTERPRISES", contact: "7409001024" },
  { name: "GAURAV GAUTUM", contact: "8318334845" },
];

export const OUTSTANDING_DUMMY_ROWS: OutstandingPartyRow[] = [
  ...EXTRA_NAMES.map((r, i) => ({
    id: `ex-${i}`,
    name: r.name,
    category: null as string | null,
    contact: r.contact,
    closingBalance: null as number | null,
  })),
  {
    id: "o1",
    name: "GARWARE HI-TECH FILMS LIMITED",
    category: null,
    contact: null,
    closingBalance: 47400.6,
  },
  {
    id: "o2",
    name: "HI TECH CAR SPA & DETAILING",
    category: null,
    contact: null,
    closingBalance: 217,
  },
].sort((a, b) => a.name.localeCompare(b.name));
