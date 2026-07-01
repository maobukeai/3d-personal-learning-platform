import { logger } from '../utils/logger';
import { Response } from 'express';
import prisma from '../services/prisma';
import { AuthRequest } from '../middlewares/auth.middleware';
import { sanitizeHtml } from '../utils/sanitize';
import axios from 'axios';

interface GitHubTreeItem {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size?: number;
  url: string;
}

function parseObsidianNote(rawText: string, defaultTitle: string) {
  let title = defaultTitle;
  let tags: string[] = [];
  let summary: string | null = null;
  let category: string | null = null;
  let content = rawText;

  // 1. Parse YAML Front Matter
  const yamlRegex = /^---\r?\n([\s\S]*?)\r?\n---/;
  const match = rawText.match(yamlRegex);
  if (match) {
    const yamlBlock = match[1] || '';
    content = rawText.replace(yamlRegex, '').trim();

    // Parse simple key-values from YAML
    const lines = yamlBlock.split('\n');
    let currentKey: string | null = null;
    const yamlObj: Record<string, any> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
      if (kvMatch) {
        const key = (kvMatch[1] || '').trim();
        const value = (kvMatch[2] || '').trim();
        currentKey = key;

        if (value.startsWith('[') && value.endsWith(']')) {
          try {
            yamlObj[key] = value
              .slice(1, -1)
              .split(',')
              .map((v) => v.trim().replace(/^['"]|['"]$/g, ''));
          } catch {
            yamlObj[key] = value;
          }
        } else if (value) {
          yamlObj[key] = value.replace(/^['"]|['"]$/g, '');
        } else {
          yamlObj[key] = [];
        }
      } else if (line.startsWith(' ') || line.startsWith('-') || trimmed.startsWith('-')) {
        if (currentKey && Array.isArray(yamlObj[currentKey])) {
          const val = trimmed
            .replace(/^-\s*/, '')
            .replace(/^['"]|['"]$/g, '')
            .trim();
          if (val) {
            yamlObj[currentKey].push(val);
          }
        }
      }
    }

    if (yamlObj.title) title = String(yamlObj.title).trim();
    if (yamlObj.summary || yamlObj.description) {
      summary = String(yamlObj.summary || yamlObj.description).trim();
    }
    if (yamlObj.category) category = String(yamlObj.category).trim();

    if (yamlObj.tags) {
      if (Array.isArray(yamlObj.tags)) {
        tags = yamlObj.tags
          .map(String)
          .map((t) => t.trim())
          .filter(Boolean);
      } else if (typeof yamlObj.tags === 'string') {
        tags = yamlObj.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
    }
  }

  // 2. Parse Title from first "# Title" if title is still the default (filename)
  if (title === defaultTitle) {
    const headingMatch = content.match(/^#\s+(.*)/m);
    if (headingMatch) {
      title = (headingMatch[1] || '').trim();
    }
  }

  // 3. Extract Summary from first paragraph if not in yaml - No longer automatically extracting to avoid polluting database summary field with non-AI summaries.

  return {
    title,
    content,
    summary,
    tags: tags.length > 0 ? JSON.stringify(tags) : null,
    category,
  };
}

export const importNotesFromGithub = async (req: AuthRequest, res: Response) => {
  const {
    repoUrl,
    token,
    branch = 'main',
    folderPath,
    category,
    visibility = 'PRIVATE',
  } = req.body;

  if (!repoUrl || !repoUrl.trim()) {
    return res.status(400).json({ error: 'GitHub 仓库地址不能为空' });
  }

  // 1. Parse repository details
  let cleanPath = repoUrl.trim();
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    cleanPath = cleanPath.replace(/^https?:\/\/github\.com\//i, '');
  }
  cleanPath = cleanPath.replace(/\.git$/i, '');
  const parts = cleanPath.split('/');
  if (parts.length < 2) {
    return res.status(400).json({ error: '无效的 GitHub 仓库地址，应类似于 owner/repo' });
  }
  const owner = parts[0];
  const repo = parts[1];

  const headers: Record<string, string> = {
    'User-Agent': '3D-Personal-Learning-Platform',
    Accept: 'application/vnd.github.v3+json',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `Bearer ${token.trim()}`;
  }

  try {
    // 2. Fetch repo file tree
    let treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`;
    let treeResponse;
    try {
      treeResponse = await axios.get(treeUrl, { headers });
    } catch (err: unknown) {
      const isAxiosError = axios.isAxiosError(err);
      // If 'main' branch fails with 404, try 'master' branch as fallback
      if (branch === 'main' && isAxiosError && err.response?.status === 404) {
        logger.info(`Branch main not found for ${owner}/${repo}, trying master fallback...`);
        treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
        treeResponse = await axios.get(treeUrl, { headers });
      } else {
        throw err;
      }
    }

    const tree: GitHubTreeItem[] = treeResponse.data.tree;
    if (!Array.isArray(tree)) {
      return res.status(400).json({ error: '未能成功获取仓库文件树' });
    }

    // 3. Filter markdown files
    const cleanFolder = folderPath ? folderPath.trim().replace(/^\/+|\/+$/g, '') : '';
    const mdFiles = tree.filter((f) => {
      if (f.type !== 'blob' || !f.path.endsWith('.md') || f.path.startsWith('.')) {
        return false;
      }
      if (cleanFolder) {
        return f.path.startsWith(cleanFolder + '/');
      }
      return true;
    });

    if (mdFiles.length === 0) {
      return res.status(200).json({ message: '仓库中未找到符合条件的 Markdown 笔记', count: 0 });
    }

    // Capped at 100 notes per request
    const filesToImport = mdFiles.slice(0, 100);
    let createdCount = 0;
    let updatedCount = 0;
    let failCount = 0;

    // 4. Download and parse each note file
    for (const f of filesToImport) {
      try {
        const contentRes = await axios.get(f.url, { headers });
        if (contentRes.data.encoding !== 'base64') {
          failCount++;
          continue;
        }

        const rawText = Buffer.from(contentRes.data.content, 'base64').toString('utf8');

        // Extract default title from file name
        const pathParts = f.path.split('/');
        const fileName = pathParts[pathParts.length - 1] || '';
        const defaultTitle = fileName.replace(/\.md$/i, '');

        const parsed = parseObsidianNote(rawText, defaultTitle);

        // Determine category: YAML category -> parent folder name -> user dialog fallback category
        let noteCategory = parsed.category;
        if (!noteCategory) {
          if (pathParts.length > 1) {
            noteCategory = pathParts[pathParts.length - 2] || null;
          } else {
            noteCategory = category?.trim() || null;
          }
        }

        // 5. Check if note already exists for this user (sync instead of duplicate)
        // Try finding by githubRepo and githubPath first
        let existingNote = await prisma.note.findFirst({
          where: {
            userId: req.userId as string,
            githubRepo: `${owner}/${repo}`,
            githubPath: f.path,
          },
        });

        // Fallback: match by title to migrate older notes imported without githubPath
        if (!existingNote) {
          existingNote = await prisma.note.findFirst({
            where: {
              userId: req.userId as string,
              title: sanitizeHtml(parsed.title),
              githubPath: null,
            },
          });
        }

        if (existingNote) {
          await prisma.note.update({
            where: { id: existingNote.id },
            data: {
              title: sanitizeHtml(parsed.title),
              content: sanitizeHtml(parsed.content),
              summary: parsed.summary ? sanitizeHtml(parsed.summary) : null,
              visibility: visibility || 'PRIVATE',
              tags: parsed.tags,
              category: noteCategory ? sanitizeHtml(noteCategory) : null,
              isGithub: true,
              githubRepo: `${owner}/${repo}`,
              githubBranch: branch,
              githubPath: f.path,
            },
          });
          updatedCount++;
        } else {
          await prisma.note.create({
            data: {
              title: sanitizeHtml(parsed.title),
              content: sanitizeHtml(parsed.content),
              summary: parsed.summary ? sanitizeHtml(parsed.summary) : null,
              visibility: visibility || 'PRIVATE',
              tags: parsed.tags,
              category: noteCategory ? sanitizeHtml(noteCategory) : null,
              userId: req.userId as string,
              isGithub: true,
              githubRepo: `${owner}/${repo}`,
              githubBranch: branch,
              githubPath: f.path,
            },
          });
          createdCount++;
        }
      } catch (fileErr) {
        logger.error(`Failed to import file ${f.path}:`, fileErr);
        failCount++;
      }
    }

    // 6. Delete notes that were removed on GitHub
    let deletedCount = 0;
    try {
      const githubFilePaths = mdFiles.map((f) => f.path);
      const existingDbNotes = await prisma.note.findMany({
        where: {
          userId: req.userId as string,
          githubRepo: `${owner}/${repo}`,
          isGithub: true,
        },
        select: {
          id: true,
          githubPath: true,
        },
      });

      const notesToDelete = existingDbNotes.filter((n) => {
        if (!n.githubPath) return false;
        if (cleanFolder && !n.githubPath.startsWith(cleanFolder + '/')) {
          return false;
        }
        return !githubFilePaths.includes(n.githubPath);
      });

      if (notesToDelete.length > 0) {
        const deleteIds = notesToDelete.map((n) => n.id);
        await prisma.note.deleteMany({
          where: {
            id: { in: deleteIds },
          },
        });
        deletedCount = notesToDelete.length;
        logger.info(
          `Deleted ${deletedCount} GitHub-synced notes for user ${req.userId} that were removed on GitHub.`,
        );
      }
    } catch (delErr) {
      logger.error('Failed to clean up deleted GitHub notes:', delErr);
    }

    res.status(200).json({
      message: `同步完成。成功同步 ${createdCount + updatedCount} 篇笔记（其中新建 ${createdCount} 篇，更新 ${updatedCount} 篇），清除已删除笔记 ${deletedCount} 篇，失败 ${failCount} 篇。`,
      count: createdCount + updatedCount,
      deletedCount,
      failed: failCount,
    });
  } catch (error: unknown) {
    logger.error('GitHub notes import error:', error);
    const isAxiosError = axios.isAxiosError(error);
    const status = isAxiosError ? error.response?.status || 500 : 500;
    const errorMsg =
      (isAxiosError && error.response?.data?.message) ||
      '连接 GitHub 失败，请检查仓库地址、分支名及密钥是否正确。';
    res.status(status).json({ error: errorMsg });
  }
};
