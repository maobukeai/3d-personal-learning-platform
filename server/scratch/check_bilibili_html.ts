
import { parseBilibiliUrl } from '../src/utils/bilibili';
import fs from 'fs';

async function test() {
  const url = 'https://www.bilibili.com/video/BV1u64y1u7as';
  console.log(`Parsing URL: ${url}`);
  try {
    const bvid = 'BV1u64y1u7as';
    const htmlResponse = await fetch(`https://www.bilibili.com/video/${bvid}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com',
      },
    });
    const html = await htmlResponse.text();
    fs.writeFileSync('bilibili_page.html', html);
    console.log('Saved HTML to bilibili_page.html');

    const match =
      html.match(/window\.__INITIAL_STATE__=(.+?);\(function\(\)/) ||
      html.match(/window\.__INITIAL_STATE__=(.+?);<\/script>/);

    if (match && match[1]) {
      console.log('Match found!');
      fs.writeFileSync('bilibili_state.json', match[1]);
    } else {
      console.log('No match for __INITIAL_STATE__');
      // Check if it's there but with different format
      const index = html.indexOf('__INITIAL_STATE__');
      if (index !== -1) {
        console.log('Found __INITIAL_STATE__ in text, but regex failed.');
        console.log('Snippet:', html.substring(index, index + 200));
      } else {
          // Check for __RENDER_DATA__ which is used in some newer pages
          const renderIndex = html.indexOf('__RENDER_DATA__');
          if (renderIndex !== -1) {
              console.log('Found __RENDER_DATA__ instead of __INITIAL_STATE__');
              console.log('Snippet:', html.substring(renderIndex, renderIndex + 200));
          }
      }
    }
  } catch (e: any) {
    console.error('Test failed:', e.message);
  }
}

test();
