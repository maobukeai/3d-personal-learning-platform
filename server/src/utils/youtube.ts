export interface YoutubeMetadata {
  title: string;
  description: string;
  thumbnail: string;
  lessons: {
    title: string;
    videoUrl: string;
    order: number;
  }[];
}

export async function parseYoutubeUrl(url: string): Promise<YoutubeMetadata> {
  // Extract Video ID or Playlist ID
  const videoIdMatch = url.match(
    /(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/|watch\?.*v=)([^#\&\?]*).*/,
  );
  const playlistIdMatch = url.match(/[&?]list=([^#\&\?]*).*/);

  const videoId = videoIdMatch ? videoIdMatch[1] : null;
  const playlistId = playlistIdMatch ? playlistIdMatch[1] : null;

  if (playlistId) {
    // For playlists, we'd ideally use the YouTube Data API.
    // Without a key, we can try to get basic info from oembed for the first video,
    // but getting all items requires either a key or a more complex scrape.
    // For now, let's treat it as a single video if it's a combined link,
    // OR we can try to fetch the playlist page and parse ytInitialData.

    try {
      const response = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/);
      const title = titleMatch ? titleMatch[1] : 'YouTube Playlist';

      // Very basic regex to find video IDs in the playlist page
      // In a real app, parsing ytInitialData (JSON) is better.
      const videoMatches = [...html.matchAll(/"videoId":"([^"]+)"/g)];
      const uniqueVideoIds = [...new Set(videoMatches.map((m) => m[1]))];

      const lessons = uniqueVideoIds.slice(0, 50).map((vid, index) => ({
        title: `第 ${index + 1} 课`, // Playlist page doesn't easily give titles via regex
        videoUrl: `https://www.youtube.com/embed/${vid}`,
        order: index + 1,
      }));

      return {
        title: title || 'YouTube Playlist',
        description: 'YouTube 播放列表导入',
        thumbnail:
          uniqueVideoIds.length > 0
            ? `https://i.ytimg.com/vi/${uniqueVideoIds[0]}/hqdefault.jpg`
            : '',
        lessons: lessons,
      };
    } catch (e) {
      console.error('Playlist parse error:', e);
    }
  }

  if (videoId) {
    // Single Video via oEmbed
    const apiResponse = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    const data = await apiResponse.json();

    return {
      title: data.title,
      description: data.author_name,
      thumbnail: data.thumbnail_url,
      lessons: [
        {
          title: data.title,
          videoUrl: `https://www.youtube.com/embed/${videoId}`,
          order: 1,
        },
      ],
    };
  }

  throw new Error('无法识别的 YouTube 链接');
}
