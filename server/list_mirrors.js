const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const mirrors = await prisma.mirrorSource.findMany();
  console.log("MIRROR SOURCES:", JSON.stringify(mirrors, null, 2));
  
  const manualStations = await prisma.manualStation.findMany();
  console.log("MANUAL STATIONS:", JSON.stringify(manualStations, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
