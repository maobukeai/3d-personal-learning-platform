export interface BilibiliMetadata {
  title: string;
  description: string;
  thumbnail: string;
  lessons: {
    title: string;
    videoUrl: string;
    order: number;
  }[];
}

export async function parseBilibiliUrl(url: string): Promise<BilibiliMetadata> {
  console.log(`[Bilibili] Parsing URL: ${url}`);
  let targetUrl = url;

  // Resolve short links (b23.tv)
  if (url.includes('b23.tv')) {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    targetUrl = response.url;
    console.log(`[Bilibili] Resolved short link to: ${targetUrl}`);
  }

  // 1. Check for MediaList (mlid) - e.g. list/ml123 or list=ml123
  const mlidMatch = targetUrl.match(/[?&]list=ml(\d+)/) || targetUrl.match(/list\/ml(\d+)/);
  if (mlidMatch && mlidMatch[1]) {
    console.log(`[Bilibili] Detected MediaList ID: ${mlidMatch[1]}`);
    return await fetchBilibiliMediaList(mlidMatch[1]);
  }

  // 2. Extract BVID
  const bvidMatch = targetUrl.match(/(BV[a-zA-Z0-9]+)/);
  if (!bvidMatch || !bvidMatch[1]) {
    throw new Error('无法从链接中识别 B站 视频 ID (BVID)');
  }
  const bvid = bvidMatch[1];
  console.log(`[Bilibili] Detected BVID: ${bvid}`);

  // Fetch video page HTML
  const htmlResponse = await fetch(`https://www.bilibili.com/video/${bvid}`, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.bilibili.com',
    },
  });

  const html = await htmlResponse.text();
  const match =
    html.match(/window\.__INITIAL_STATE__=(.+?);\(function\(\)/) ||
    html.match(/window\.__INITIAL_STATE__=(.+?);<\/script>/);

  if (!match || !match[1]) {
    // Fallback to API if HTML parsing fails
    const viewResponse = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com',
      },
    });
    const viewJson = await viewResponse.json();
    if (viewJson.code !== 0) {
      throw new Error(viewJson.message || '获取 B站 视频数据失败');
    }
    return await parseFromBilibiliData(viewJson.data, bvid);
  }

  try {
    const state = JSON.parse(match[1]);
    if (!state.videoData) {
      throw new Error('未找到视频数据');
    }
    return await parseFromBilibiliData({ ...state.videoData, ugc_season: state.ugc_season }, bvid);
  } catch (error) {
    throw new Error('解析 B站 页面数据失败');
  }
}

async function parseFromBilibiliData(data: any, bvid: string): Promise<BilibiliMetadata> {
  console.log(
    `[Bilibili] Parsing Data: ugc_season=${!!data.ugc_season}, archive_series=${!!data.archive_series}, pages=${data.pages?.length}`,
  );

  // A. Professional Collection (ugc_season)
  if (data.ugc_season && data.ugc_season.sections) {
    console.log('[Bilibili] Handling as Professional Collection (ugc_season)');
    const lessons: { title: string; videoUrl: string; order: number }[] = [];
    let order = 1;
    for (const section of data.ugc_season.sections) {
      for (const episode of section.episodes) {
        lessons.push({
          title: episode.title,
          videoUrl: `https://player.bilibili.com/player.html?bvid=${episode.bvid}&cid=${episode.cid}&page=1&high_quality=1&as_wide=1&danmaku=0`,
          order: order++,
        });
      }
    }
    return { title: data.title, description: data.desc, thumbnail: fixPic(data.pic), lessons };
  }

  // B. Archive Series (Space Series)
  if (data.archive_series && data.archive_series.series_id) {
    console.log(`[Bilibili] Handling as Archive Series: ${data.archive_series.series_id}`);
    return await fetchBilibiliSeries(
      data.archive_series.series_id,
      data.owner?.mid || 0,
      data.title,
      data.pic,
    );
  }

  // C. Multi-part Video (Pages)
  if (data.pages && data.pages.length > 1) {
    console.log(`[Bilibili] Handling as Multi-part Video (${data.pages.length} pages)`);
    const lessons = data.pages.map((page: any) => ({
      title: page.part || data.title + ` (P${page.page})`,
      videoUrl: `https://player.bilibili.com/player.html?bvid=${bvid}&cid=${page.cid}&page=${page.page}&high_quality=1&as_wide=1&danmaku=0`,
      order: page.page,
    }));
    return { title: data.title, description: data.desc, thumbnail: fixPic(data.pic), lessons };
  }

  // D. Single Video (Fallback)
  console.log('[Bilibili] Fallback to Single Video');
  return {
    title: data.title,
    description: data.desc,
    thumbnail: fixPic(data.pic),
    lessons: [
      {
        title: data.title,
        videoUrl: `https://player.bilibili.com/player.html?bvid=${bvid}&cid=${data.cid || (data.pages && data.pages[0]?.cid)}&page=1&high_quality=1&as_wide=1&danmaku=0`,
        order: 1,
      },
    ],
  };
}

function fixPic(pic: string) {
  if (!pic) return '';
  return pic.startsWith('//') ? 'https:' + pic : pic;
}

async function fetchBilibiliSeries(
  seriesId: number,
  mid: number,
  defaultTitle: string,
  defaultPic: string,
): Promise<BilibiliMetadata> {
  const seriesResponse = await fetch(
    `https://api.bilibili.com/x/series/archives?mid=${mid}&series_id=${seriesId}&only_normal=true&sort=asc&pn=1&ps=100`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com',
      },
    },
  );

  const seriesJson = await seriesResponse.json();
  if (seriesJson.code !== 0) {
    throw new Error('获取系列列表失败');
  }

  const lessons = seriesJson.data.archives.map((archive: any, index: number) => ({
    title: archive.title,
    videoUrl: `https://player.bilibili.com/player.html?bvid=${archive.bvid}&cid=${archive.cid}&page=1&high_quality=1&as_wide=1&danmaku=0`,
    order: index + 1,
  }));

  return {
    title: defaultTitle,
    description: 'B站 系列视频导入',
    thumbnail: fixPic(defaultPic),
    lessons,
  };
}

async function fetchBilibiliMediaList(mlid: string): Promise<BilibiliMetadata> {
  const response = await fetch(
    `https://api.bilibili.com/x/v1/medialist/resource/list?type=3&oid=${mlid}&pn=1&ps=100`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com',
      },
    },
  );

  const json = await response.json();
  if (json.code !== 0) {
    throw new Error('获取播放列表失败');
  }

  const lessons = json.data.medias.map((media: any, index: number) => ({
    title: media.title,
    videoUrl: `https://player.bilibili.com/player.html?bvid=${media.bv_id}&cid=${media.id}&page=1&high_quality=1&as_wide=1&danmaku=0`,
    order: index + 1,
  }));

  return {
    title: 'B站 播放列表',
    description: '通过 mlid 导入的播放列表',
    thumbnail: lessons[0] ? 'https://i0.hdslb.com/bfs/archive/' : '', // Placeholder
    lessons,
  };
}
