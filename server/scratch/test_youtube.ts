import { parseYoutubeUrl } from '../src/utils/youtube';

async function test() {
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  try {
    const metadata = await parseYoutubeUrl(url);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
