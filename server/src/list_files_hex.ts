import fs from 'fs';
import path from 'path';

const dir = './uploads/assets';

if (fs.existsSync(dir)) {
  const files = fs.readdirSync(dir);
  console.log(`Files in ${dir}:`);
  files.forEach((file) => {
    console.log(`${file} (${Buffer.from(file).toString('hex')})`);
  });
} else {
  console.log(`${dir} does not exist`);
}
