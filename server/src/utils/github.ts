export interface GithubMetadata {
  title: string;
  description: string;
  thumbnail: string;
  lessons: {
    title: string;
    content: string;
    order: number;
  }[];
}

export async function parseGithubUrl(url: string): Promise<GithubMetadata> {
  console.log(`[GitHub] Parsing URL: ${url}`);

  // Extract owner and repo
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    throw new Error('无效的 GitHub 仓库链接');
  }

  const owner = match[1];
  const repo = match[2].replace(/\.git$/, '');
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

  const headers: any = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': '3d-learning-platform-server',
  };

  // Add token if available in env to increase rate limit
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    // 1. Fetch Repo Info
    const repoResponse = await fetch(apiUrl, { headers });

    if (!repoResponse.ok) {
      if (repoResponse.status === 403) {
        throw new Error('GitHub API 频率限制，请稍后再试或配置 Token');
      }
      throw new Error('无法获取 GitHub 仓库信息，请检查仓库是否存在或是否为公开仓库');
    }

    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch || 'main';

    // 2. Fetch README content from raw URL (Doesn't count against API limit)
    const rawReadmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${defaultBranch}/README.md`;
    let readmeResponse = await fetch(rawReadmeUrl);

    // Fallback to API if raw URL fails (e.g. filename is readme.md or README.txt)
    if (!readmeResponse.ok) {
      const readmeApiUrl = `https://api.github.com/repos/${owner}/${repo}/readme`;
      const readmeHeaders = { ...headers, Accept: 'application/vnd.github.v3.raw' };
      readmeResponse = await fetch(readmeApiUrl, { headers: readmeHeaders });
    }

    let lessons: { title: string; content: string; order: number }[] = [];

    if (readmeResponse.ok) {
      const readmeText = await readmeResponse.text();

      // 3. Parse README for headers as lessons
      // Matches # Header or ## Header
      const headerMatches = readmeText.matchAll(/^(#{1,3})\s+(.+)$/gm);
      let order = 1;

      for (const match of headerMatches) {
        const title = match[2].trim();
        if (title.toLowerCase() === 'readme' || title === repoData.name) continue;

        lessons.push({
          title,
          content: `来自 GitHub 仓库 ${repoData.full_name} 的章节：${title}`,
          order: order++,
        });
      }
    }

    // Fallback if no headers found
    if (lessons.length === 0) {
      lessons.push({
        title: '项目概览',
        content: repoData.description || 'GitHub 项目主页',
        order: 1,
      });
    }

    return {
      title: repoData.name,
      description: repoData.description || '',
      thumbnail: repoData.owner.avatar_url,
      lessons,
    };
  } catch (error: any) {
    console.error('[GitHub] Parse error:', error);
    throw new Error(error.message || '解析 GitHub 仓库失败');
  }
}
