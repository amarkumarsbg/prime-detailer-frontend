import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.appJsonRow.findMany({
    where: { collection: "walletTransactions" }
  });
  console.log("Wallet Transactions rows count:", rows.length);
  console.log("Wallet Transactions rows:", JSON.stringify(rows, null, 2));

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      walletBalance: true
    }
  });
  console.log("Customers wallet balances:", JSON.stringify(customers, null, 2));
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
