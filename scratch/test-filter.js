const fs = require('fs');
const path = require('path');

// Read seed-data.json
const raw = fs.readFileSync(path.join(__dirname, '../../backend/prisma/seed-data.json'), 'utf-8');
const data = JSON.parse(raw);

const customers = data.customers || [];
const vehicleList = data.vehicles || [];

console.log("Total Customers:", customers.length);
console.log("Total Vehicles:", vehicleList.length);

function filterCustomers(search) {
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
}

// Test search with "amar"
const result = filterCustomers("amar");
console.log("\nSearch result for 'amar':");
console.log(result.map(c => ({ id: c.id, name: c.name, phone: c.phone })));

// Let's add a customer containing "Amar" to see if it matches
customers.push({ id: "cust-amar", name: "Amar Kumar", phone: "7004509790" });
const result2 = filterCustomers("amar");
console.log("\nSearch result for 'amar' after adding Amar Kumar:");
console.log(result2.map(c => ({ id: c.id, name: c.name, phone: c.phone })));
