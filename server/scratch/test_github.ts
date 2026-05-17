import { parseGithubUrl } from '../src/utils/github';

async function test() {
  const url = 'https://github.com/mrdoob/three.js';
  try {
    const metadata = await parseGithubUrl(url);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
