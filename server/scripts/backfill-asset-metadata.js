"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const asset_processor_1 = require("./src/utils/asset-processor");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Starting backfill of 3D asset metadata...');
    const assets = await prisma.asset.findMany({
        where: {
            OR: [
                { vertices: null },
                { faces: null },
                { dimensions: null }
            ],
            type: { in: ['GLB', 'GLTF'] }
        }
    });
    console.log(`Found ${assets.length} assets to process.`);
    for (const asset of assets) {
        try {
            const fileName = asset.url.split('/').pop();
            if (!fileName)
                continue;
            const filePath = path_1.default.join(__dirname, '../uploads/assets', fileName);
            if (!fs_1.default.existsSync(filePath)) {
                console.warn(`File not found for asset ${asset.id}: ${filePath}`);
                continue;
            }
            console.log(`Processing asset: ${asset.title} (${asset.id})`);
            const metadata = await (0, asset_processor_1.process3DAsset)(filePath);
            if (metadata) {
                await prisma.asset.update({
                    where: { id: asset.id },
                    data: metadata
                });
                console.log(`Successfully updated asset: ${asset.title}`);
            }
        }
        catch (error) {
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
//# sourceMappingURL=backfill-asset-metadata.js.map