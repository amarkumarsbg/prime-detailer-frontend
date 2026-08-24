/** Download a starter CSV admins can fill and re-import. */
export function downloadCustomerImportTemplate() {
  const csv = [
    "Name,Phone,Email,Address",
    "Rahul Sharma,9876543210,rahul@example.com,Mumbai",
    "Priya Patel,9123456780,,",
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "customer-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
