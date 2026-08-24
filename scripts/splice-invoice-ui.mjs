import fs from "fs";

const p =
  "c:/Users/amark/OneDrive/Desktop/prime-detailer-fs-demo/frontend/src/components/billing/sales-invoice-detail-client.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
const start = lines.findIndex((l) => l.includes("const formatShortDate"));
const dialogStart = lines.findIndex((l) => l.includes("<Dialog open={recordDialogOpen}"));
const mid = fs.readFileSync(
  "c:/Users/amark/OneDrive/Desktop/prime-detailer-fs-demo/frontend/scripts/splice-invoice-ui-fragment.txt",
  "utf8"
).split(/\r?\n/);

if (start < 0 || dialogStart < 0) {
  console.error("markers not found", start, dialogStart);
  process.exit(1);
}
const out = [...lines.slice(0, start), ...mid, ...lines.slice(dialogStart)];
fs.writeFileSync(p, out.join("\n"));
console.log("ok", start, dialogStart, mid.length);
