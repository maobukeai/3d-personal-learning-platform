import { parseBilibiliUrl } from '../src/utils/bilibili';

async function test() {
  const url = '銆愩€怟urt銆態lender闆跺熀纭€鍏ラ棬鏁欑▼ | Blender涓枃鍖烘柊鎵嬪繀鍒锋暀绋(宸插畬缁)-鍝斿摡鍝斿摡銆 https://b23.tv/F1qXNme';
  try {
    const metadata = await parseBilibiliUrl(url);
    console.log('Metadata:', JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

test();
