import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { process3DAsset } from './src/utils/asset-processor';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting backfill of 3D asset metadata...');

  const assets = await prisma.asset.findMany({
    where: {
      OR: [{ vertices: null }, { faces: null }, { dimensions: null }],
      type: { in: ['GLB', 'GLTF'] },
    },
  });

  console.log(`Found ${assets.length} assets to process.`);

  for (const asset of assets) {
    try {
      const fileName = asset.url.split('/').pop();
      if (!fileName) continue;

      const filePath = path.join(__dirname, '../uploads/assets', fileName);
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found for asset ${asset.id}: ${filePath}`);
        continue;
      }

      console.log(`Processing asset: ${asset.title} (${asset.id})`);
      const metadata = await process3DAsset(filePath);

      if (metadata) {
        await prisma.asset.update({
          where: { id: asset.id },
          data: metadata,
        });
        console.log(`Successfully updated asset: ${asset.title}`);
      }
    } catch (error) {
      console.error(`Error processing asset ${asset.id}:`, error);
    }
  }

  console.log('Backfill completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
