import fs from 'fs';

const dbPath = './prisma/dev.db';
const searchHex = 'e59586e6a087'; // 商标 in UTF-8
const buffer = fs.readFileSync(dbPath);
const searchBuffer = Buffer.from(searchHex, 'hex');

let pos = 0;
let found = false;
while ((pos = buffer.indexOf(searchBuffer, pos)) !== -1) {
  console.log(`Found "商标" at position ${pos}`);
  // Print some context
  const start = Math.max(0, pos - 50);
  const end = Math.min(buffer.length, pos + 50);
  console.log(
    'Context:',
    buffer
      .slice(start, end)
      .toString('utf8')
      .replace(/[^\x20-\x7E]/g, '.'),
  );
  pos += 1;
  found = true;
}

if (!found) {
  console.log('"商标" not found in DB file');
}
