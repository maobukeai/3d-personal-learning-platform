import prisma from '../services/prisma';
import { syncEngine } from '../mirror/services/sync-engine.service';

async function checkSync() {
  const sources = await prisma.mirrorSource.findMany();
  console.log('Mirror Sources Sync Status:');
  for (const s of sources) {
    console.log(`- [${s.id}] ${s.displayName}: syncStatus=${s.syncStatus}`);
  }

  const runningLogs = await prisma.syncLog.findMany({
    where: { status: 'RUNNING' }
  });
  console.log('Running Sync Logs:', JSON.stringify(runningLogs, null, 2));

  // Check syncEngine active list
  const activeSyncs = (syncEngine as any).activeSyncs;
  console.log('SyncEngine Active Syncs:', activeSyncs ? Array.from(activeSyncs) : 'not found');
}

checkSync()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
