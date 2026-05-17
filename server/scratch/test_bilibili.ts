import { parseBilibiliUrl } from '../src/utils/bilibili';

async function test() {
  const url = 'https://www.bilibili.com/video/BV1uT4y1P7vE';
  try {
    const metadata = await parseBilibiliUrl(url);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
