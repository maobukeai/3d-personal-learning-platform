import request from 'supertest';

jest.mock('../../src/utils/asset-processor', () => ({
  processGltf: jest.fn(),
  getGltfMetadata: jest.fn(),
}));

import app from '../../src/app';
import prisma from '../../src/services/prisma';
import { AI_BOT_MESSAGE_STATUS, AI_BOT_RESPONSE_MODE } from '../../src/services/ai-bot.service';

describe('AI bot callback boundaries', () => {
  const suffix = Date.now();
  const email = `ai-bot-owner-${suffix}@example.com`;
  const publicToken = `ai-bot-callback-${suffix}`;

  let userId = '';
  let integrationId = '';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });

    const user = await prisma.user.create({
      data: {
        email,
        password: 'not-used',
        name: 'AI Bot Owner',
        role: 'USER',
      },
    });
    userId = user.id;

    const integration = await prisma.aiBotIntegration.create({
      data: {
        userId,
        name: 'Keyword protected bot',
        platform: 'WEWORK',
        status: 'ACTIVE',
        publicToken,
        triggerKeywords: JSON.stringify(['@AI']),
        responseMode: AI_BOT_RESPONSE_MODE.BACKGROUND_WEBHOOK,
      },
    });
    integrationId = integration.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it('records non-matching callback messages as ignored before checking AI quota', async () => {
    const res = await request(app)
      .post(`/api/ai-bots/callback/${publicToken}`)
      .send({ text: '普通群消息，不需要触发机器人' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, ignored: true });

    const message = await prisma.aiBotMessage.findFirst({
      where: { userId, integrationId },
      orderBy: { createdAt: 'desc' },
    });
    expect(message?.status).toBe(AI_BOT_MESSAGE_STATUS.IGNORED);
    expect(message?.inboundText).toBe('普通群消息，不需要触发机器人');
  });
});
