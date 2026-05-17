
import { parseBilibiliUrl } from '../src/utils/bilibili';
import { parseYoutubeUrl } from '../src/utils/youtube';
import { parseGithubUrl } from '../src/utils/github';

async function test() {
  const urls = [
    { name: 'Bilibili Valid', url: 'https://www.bilibili.com/video/BV1u64y1u7as' },
    { name: 'Bilibili Invalid', url: 'https://www.bilibili.com/video/BV1invalid' },
    { name: 'Bilibili Short', url: 'https://b23.tv/example' },
    { name: 'YouTube Valid', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
    { name: 'GitHub Valid', url: 'https://github.com/microsoft/vscode' }
  ];

  for (const item of urls) {
    console.log(`\n--- Testing ${item.name} ---`);
    try {
      const meta = await (item.name.startsWith('Bilibili') ? parseBilibiliUrl(item.url) : 
                         item.name.startsWith('YouTube') ? parseYoutubeUrl(item.url) : 
                         parseGithubUrl(item.url));
      console.log(`${item.name} Success:`, JSON.stringify(meta, null, 2).substring(0, 200));
    } catch (e: any) {
      console.error(`${item.name} Failed:`, e.message);
    }
  }
}

test();
