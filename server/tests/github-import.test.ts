import { GithubImportService } from '../src/services/githubImport.service';
import axios from 'axios';
import prisma from '../src/services/prisma';

jest.mock('axios');
jest.mock('../src/services/prisma', () => ({
  __esModule: true,
  default: {
    note: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe('GithubImportService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should parse and import obsidian note successfully', async () => {
    // mock axios for tree and file content
    const mockTree = {
      data: {
        tree: [
          {
            path: 'test-note.md',
            type: 'blob',
            url: 'https://api.github.com/repos/owner/repo/git/blobs/sha',
          },
        ],
      },
    };
    const mockFileContent = {
      data: {
        encoding: 'base64',
        content: Buffer.from(
          `---
title: My Custom Title
category: Tech
tags: [js, node]
---
# Some Header
This is content.`,
          'utf8',
        ).toString('base64'),
      },
    };

    (axios.get as jest.Mock).mockResolvedValueOnce(mockTree).mockResolvedValueOnce(mockFileContent);

    // mock prisma
    (prisma.note.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.note.create as jest.Mock).mockResolvedValue({ id: '1' });
    (prisma.note.findMany as jest.Mock).mockResolvedValue([]);

    const result = await GithubImportService.importNotes({
      userId: 'user-1',
      repoUrl: 'https://github.com/owner/repo',
      branch: 'main',
      visibility: 'PRIVATE',
    });

    expect(result.count).toBe(1);
    expect(prisma.note.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: 'My Custom Title',
        content: '# Some Header\nThis is content.',
        category: 'Tech',
        tags: '["js","node"]',
        userId: 'user-1',
        isGithub: true,
        githubRepo: 'owner/repo',
        githubPath: 'test-note.md',
      }),
    });
  });
});
