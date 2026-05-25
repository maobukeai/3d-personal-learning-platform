import { logger } from './logger';
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
  logger.info(`[Bilibili] Parsing input: ${url}`);

  // Extract actual URL from potential share text
  const urlMatch = url.match(/https?:\/\/[^\s]+/);
  if (!urlMatch) {
    throw new Error('未在输入中找到有效的 B站 链接');
  }
  let targetUrl = urlMatch[0];
  logger.info(`[Bilibili] Extracted URL: ${targetUrl}`);

  // Resolve short links (b23.tv)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    throw new Error('未在输入中找到有效的链接格式');
  }

  if (parsedUrl.hostname === 'b23.tv' || parsedUrl.hostname.endsWith('.b23.tv')) {
    try {
      const response = await fetch(targetUrl, { method: 'HEAD', redirect: 'follow' });
      targetUrl = response.url;
      logger.info(`[Bilibili] Resolved short link to: ${targetUrl}`);
    } catch (e) {
      logger.error('[Bilibili] Failed to resolve short link:', e);
      // Continue with original URL, maybe it has ID anyway
    }
  }

  // 1. Check for MediaList (mlid)
  const mlidMatch = targetUrl.match(/[?&]list=ml(\d+)/) || targetUrl.match(/list\/ml(\d+)/);
  if (mlidMatch && mlidMatch[1]) {
    logger.info(`[Bilibili] Detected MediaList ID: ${mlidMatch[1]}`);
    return await fetchBilibiliMediaList(mlidMatch[1]);
  }

  // 2. Extract BVID or AVID
  const bvidMatch = targetUrl.match(/(BV[a-zA-Z0-9]+)/);
  const avidMatch = targetUrl.match(/[?&]aid=(\d+)/) || targetUrl.match(/\/av(\d+)/);

  const bvid = (bvidMatch ? bvidMatch[1] : null) as string | null;
  const avid = (avidMatch ? avidMatch[1] : null) as string | null;

  if (!bvid && !avid) {
    throw new Error(
      '无法从链接中识别 B站 视频 ID (BVID/AVID)。目前支持普通视频、系列视频和播放列表。',
    );
  }

  const videoId = bvid || `av${avid}`;
  logger.info(`[Bilibili] Detected ID: ${videoId}`);

  // Fetch video page HTML
  const fetchUrl = bvid
    ? `https://www.bilibili.com/video/${bvid}`
    : `https://www.bilibili.com/video/av${avid}`;
  const htmlResponse = await fetch(fetchUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.bilibili.com',
    },
  });

  const html = await htmlResponse.text();

  // Try multiple regex patterns for INITIAL_STATE
  const stateMatch =
    html.match(/window\.__INITIAL_STATE__=(.+?);\(function\(\)/) ||
    html.match(/window\.__INITIAL_STATE__=(.+?);<\/script>/) ||
    html.match(/window\.__INITIAL_STATE__=(.+?);$/m);

  if (!stateMatch || !stateMatch[1]) {
    logger.info('[Bilibili] HTML parse failed or INITIAL_STATE not found, falling back to API');
    const apiUrl = bvid
      ? `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
      : `https://api.bilibili.com/x/web-interface/view?aid=${avid}`;

    const viewResponse = await fetch(apiUrl, {
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
    return await parseFromBilibiliData(viewJson.data, bvid || viewJson.data.bvid);
  }

  try {
    const state = JSON.parse(stateMatch[1]);

    // Bilibili state structure can be very inconsistent
    const bvidFromState = state.bvid || (state.videoData && state.videoData.bvid);
    const aidFromState = state.aid || (state.videoData && state.videoData.aid);

    // Use API if state is missing basic info
    if (!bvidFromState && !aidFromState) {
      logger.info('[Bilibili] State missing ID, falling back to API');
      return await fetchFromApi(bvid, avid);
    }

    // Try to find video metadata in state
    const title = state.videoData?.title || state.title || '';
    const pic = state.videoData?.pic || state.pic || '';
    const cid =
      state.cid ||
      state.videoData?.cid ||
      (state.videoData?.pages && state.videoData.pages[0]?.cid);

    // If we have critical info missing, API is safer
    if (!title || !cid) {
      logger.info('[Bilibili] State incomplete (missing title/cid), falling back to API');
      return await fetchFromApi(bvid, avid);
    }

    const mergedData = {
      ...state.videoData,
      bvid: bvidFromState,
      aid: aidFromState,
      title,
      pic,
      cid,
      ugc_season: state.ugc_season || state.videoData?.ugc_season,
      archive_series: state.archive_series || state.videoData?.archive_series,
      pages: state.videoData?.pages || state.pages,
    };
    return await parseFromBilibiliData(mergedData, bvid || bvidFromState);
  } catch (error) {
    logger.error('[Bilibili] Parse error, falling back to API:', (error instanceof Error ? error.message : String(error)));
    return await fetchFromApi(bvid, avid);
  }
}

async function fetchFromApi(bvid: string | null, avid: string | null): Promise<BilibiliMetadata> {
  const apiUrl = bvid
    ? `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`
    : `https://api.bilibili.com/x/web-interface/view?aid=${avid}`;

  logger.info(`[Bilibili] Fetching from API: ${apiUrl}`);
  const viewResponse = await fetch(apiUrl, {
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
  return await parseFromBilibiliData(viewJson.data, bvid || viewJson.data.bvid);
}

async function parseFromBilibiliData(data: any, bvid: string): Promise<BilibiliMetadata> {
  const currentBvid = bvid || data.bvid;
  logger.info(
    `[Bilibili] Parsing Data: bvid=${currentBvid}, ugc_season=${!!data.ugc_season}, archive_series=${!!data.archive_series}, pages=${data.pages?.length}`,
  );

  // A. Professional Collection (ugc_season)
  if (data.ugc_season && data.ugc_season.sections) {
    logger.info('[Bilibili] Handling as Professional Collection (ugc_season)');
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
    return {
      title: data.title || (data.ugc_season && data.ugc_season.title) || 'B站 视频课程',
      description: data.desc || (data.ugc_season && data.ugc_season.intro) || '',
      thumbnail: fixPic(data.pic || (data.ugc_season && data.ugc_season.cover)),
      lessons,
    };
  }

  // B. Archive Series (Space Series)
  if (data.archive_series && data.archive_series.series_id) {
    logger.info(`[Bilibili] Handling as Archive Series: ${data.archive_series.series_id}`);
    return await fetchBilibiliSeries(
      data.archive_series.series_id,
      data.owner?.mid || 0,
      data.title,
      data.pic,
    );
  }

  // C. Multi-part Video (Pages)
  if (data.pages && data.pages.length > 1) {
    logger.info(`[Bilibili] Handling as Multi-part Video (${data.pages.length} pages)`);
    const lessons = data.pages.map((page: any) => ({
      title: page.part || data.title + ` (P${page.page})`,
      videoUrl: `https://player.bilibili.com/player.html?bvid=${currentBvid}&cid=${page.cid}&page=${page.page}&high_quality=1&as_wide=1&danmaku=0`,
      order: page.page,
    }));
    return { title: data.title, description: data.desc, thumbnail: fixPic(data.pic), lessons };
  }

  // D. Single Video (Fallback)
  logger.info('[Bilibili] Fallback to Single Video');
  const cid = data.cid || (data.pages && data.pages[0]?.cid);
  if (!cid) {
    logger.warn('[Bilibili] No CID found in data:', JSON.stringify(data).substring(0, 500));
  }
  return {
    title: data.title,
    description: data.desc,
    thumbnail: fixPic(data.pic),
    lessons: [
      {
        title: data.title,
        videoUrl: `https://player.bilibili.com/player.html?bvid=${currentBvid}&cid=${cid}&page=1&high_quality=1&as_wide=1&danmaku=0`,
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
