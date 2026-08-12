/** Download a starter CSV admins can fill and re-import. */
export function downloadVehicleImportTemplate() {
  const csv = [
    "Registration Number,Customer Phone,Make,Model,Fuel Type,Segment,Year,Color",
    "KA01AB1234,9876543201,Maruti,Swift,Petrol,Hatchback,2022,White",
    "MH12CD5678,9876543202,Hyundai,Creta,Diesel,SUV,2023,Grey",
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "vehicle-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
