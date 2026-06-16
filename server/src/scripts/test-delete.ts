import { storageService } from '../services/storage.service';
import { getActiveStorageConfig } from '../mirror/services/metadata.helper';
import prisma from '../services/prisma';

async function testDelete() {
  const activeConfig = await getActiveStorageConfig('MIRROR');
  if (!activeConfig) {
    console.log('No active cloud configuration.');
    return;
  }

  const testKey1 = 'mirror/test-delete-1.txt';
  const testKey2 = 'mirror/test-delete-2.txt';

  console.log('Uploading test files...');
  await storageService.uploadJsonString(activeConfig, testKey1, 'test 1');
  await storageService.uploadJsonString(activeConfig, testKey2, 'test 2');

  console.log('Listing files under mirror/test-delete...');
  const filesBefore = await storageService.listAllObjectsWithPrefix(activeConfig, 'mirror/test-delete');
  console.log('Files before deletion:', JSON.stringify(filesBefore, null, 2));

  console.log('Calling deleteFilesBulk...');
  await storageService.deleteFilesBulk(activeConfig, [testKey1, testKey2]);

  const filesAfter = await storageService.listAllObjectsWithPrefix(activeConfig, 'mirror/test-delete');
  console.log('Files after deletion (should be empty):', JSON.stringify(filesAfter, null, 2));
}

testDelete()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
