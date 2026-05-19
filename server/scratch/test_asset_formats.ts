import prisma from '../src/services/prisma';

async function test() {
  const asset = await prisma.asset.findFirst();
  if (!asset) {
    console.log('No asset found to test. Please seed the database first.');
    return;
  }
  console.log('Original asset:', { id: asset.id, categoryId: asset.categoryId, formats: asset.formats });

  // Test 1: Update title, should NOT reset categoryId
  console.log('\n--- Test 1: Update title only ---');
  const title = 'Updated Title ' + Date.now();
  const categoryId = undefined; // Simulated missing categoryId in req.body
  const updateData1: any = {};
  if (title !== undefined) updateData1.title = title;
  if (categoryId !== undefined) updateData1.categoryId = categoryId;
  
  const asset1 = await prisma.asset.update({
    where: { id: asset.id },
    data: updateData1
  });
  console.log('After update 1:', { id: asset1.id, categoryId: asset1.categoryId, title: asset1.title });
  if (asset1.categoryId !== asset.categoryId) {
    console.error('FAIL: categoryId was reset!');
  } else {
    console.log('PASS: categoryId preserved');
  }

  // Test 2: Set formats to null
  console.log('\n--- Test 2: Set formats to null ---');
  const formats2 = null; // Simulated formats: null in req.body
  const updateData2: any = {};
  if (formats2 !== undefined) {
    updateData2.formats = formats2 ? JSON.stringify(formats2) : null;
  }
  const asset2 = await prisma.asset.update({
    where: { id: asset.id },
    data: updateData2
  });
  console.log('After update 2:', { id: asset2.id, formats: asset2.formats });
  if (asset2.formats !== null) {
    console.error('FAIL: formats not null!');
  } else {
    console.log('PASS: formats set to null');
  }

  // Test 3: Set formats to value
  console.log('\n--- Test 3: Set formats to object ---');
  const formats3 = { glb: 'http://example.com/model.glb' };
  const updateData3: any = {};
  if (formats3 !== undefined) {
    updateData3.formats = formats3 ? JSON.stringify(formats3) : null;
  }
  const asset3 = await prisma.asset.update({
    where: { id: asset.id },
    data: updateData3
  });
  console.log('After update 3:', { id: asset3.id, formats: asset3.formats });
  if (asset3.formats !== JSON.stringify(formats3)) {
    console.error('FAIL: formats not updated correctly!');
  } else {
    console.log('PASS: formats updated correctly');
  }
}

test()
  .catch((err) => {
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
