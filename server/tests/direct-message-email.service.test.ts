process.env.MESSAGE_EMAIL_COOLDOWN_MS = '300000';
process.env.MESSAGE_EMAIL_RETRY_MS = '60000';
process.env.MESSAGE_EMAIL_SWEEP_MS = '60000';

const mockDirectMessageEmailBatch = {
  findUnique: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
  updateMany: jest.fn(),
  findMany: jest.fn(),
};

const mockIsUserInConversation = jest.fn();
const mockSendNotificationEmail = jest.fn();

jest.mock('../src/services/prisma', () => ({
  __esModule: true,
  default: {
    directMessageEmailBatch: mockDirectMessageEmailBatch,
  },
}));

jest.mock('../src/services/socket.service', () => ({
  isUserInConversation: mockIsUserInConversation,
}));

jest.mock('../src/utils/notification', () => ({
  sendNotificationEmail: mockSendNotificationEmail,
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

type DirectMessageEmailService = typeof import('../src/services/direct-message-email.service');

const service = require('../src/services/direct-message-email.service') as DirectMessageEmailService;

const fixedNow = new Date('2026-06-09T00:05:00.000Z');

const makeBatch = (overrides: Record<string, unknown> = {}) => ({
  id: 'batch-1',
  userId: 'recipient-1',
  conversationId: 'conversation-1',
  pendingCount: 1,
  previewItems: JSON.stringify([
    { senderName: 'Alice', preview: '第一条', at: fixedNow.toISOString() },
  ]),
  lastSenderName: 'Alice',
  conversationName: null,
  isGroup: false,
  firstQueuedAt: fixedNow,
  lastQueuedAt: fixedNow,
  scheduledFor: fixedNow,
  processingAt: null,
  lastSentAt: null,
  lastError: null,
  createdAt: fixedNow,
  updatedAt: fixedNow,
  ...overrides,
});

describe('direct-message-email.service', () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.setSystemTime(fixedNow);
    jest.clearAllMocks();
    mockIsUserInConversation.mockReturnValue(false);
  });

  afterEach(() => {
    service.stopDirectMessageEmailScheduler();
    jest.clearAllTimers();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('queues the first offline direct-message reminder for immediate sending', async () => {
    const createdBatch = makeBatch();
    mockDirectMessageEmailBatch.findUnique.mockResolvedValue(null);
    mockDirectMessageEmailBatch.create.mockResolvedValue(createdBatch);

    const result = await service.queueDirectMessageEmail({
      recipientId: 'recipient-1',
      conversationId: 'conversation-1',
      senderName: 'Alice',
      isGroup: false,
      content: '你好，看看这个模型',
      messageType: 'TEXT',
    });

    expect(result).toMatchObject({ queued: true, batchId: 'batch-1' });
    expect(mockDirectMessageEmailBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'recipient-1',
        conversationId: 'conversation-1',
        pendingCount: 1,
        lastSenderName: 'Alice',
        scheduledFor: fixedNow,
      }),
    });
  });

  it('merges messages received during cooldown into the existing batch', async () => {
    const lastSentAt = new Date('2026-06-09T00:03:00.000Z');
    const expectedScheduledFor = new Date('2026-06-09T00:08:00.000Z');
    const existingBatch = makeBatch({
      pendingCount: 0,
      previewItems: '[]',
      scheduledFor: null,
      lastSentAt,
    });
    mockDirectMessageEmailBatch.findUnique.mockResolvedValue(existingBatch);
    mockDirectMessageEmailBatch.update.mockResolvedValue(
      makeBatch({ pendingCount: 1, scheduledFor: expectedScheduledFor, lastSentAt }),
    );

    await service.queueDirectMessageEmail({
      recipientId: 'recipient-1',
      conversationId: 'conversation-1',
      senderName: 'Alice',
      isGroup: false,
      content: '第二条',
      messageType: 'TEXT',
    });

    expect(mockDirectMessageEmailBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        pendingCount: { increment: 1 },
        firstQueuedAt: fixedNow,
        lastQueuedAt: fixedNow,
        scheduledFor: expectedScheduledFor,
      }),
    });
  });

  it('sends a merged reminder through DIRECT_MESSAGE email preferences and clears the batch', async () => {
    const batch = makeBatch({
      pendingCount: 2,
      previewItems: JSON.stringify([
        { senderName: 'Alice', preview: '第一条', at: fixedNow.toISOString() },
        { senderName: 'Alice', preview: '第二条', at: fixedNow.toISOString() },
      ]),
    });
    mockDirectMessageEmailBatch.findUnique.mockResolvedValueOnce(batch).mockResolvedValueOnce(batch);
    mockDirectMessageEmailBatch.updateMany.mockResolvedValue({ count: 1 });
    mockSendNotificationEmail.mockResolvedValue(true);
    mockDirectMessageEmailBatch.update.mockResolvedValue(makeBatch({ pendingCount: 0 }));

    await service.flushDirectMessageEmailBatch('batch-1');

    expect(mockSendNotificationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'recipient-1',
        category: 'DIRECT_MESSAGE',
        subject: '你有 2 条新私信',
        title: '收到 2 条新私信',
        preview: expect.stringContaining('Alice: 第一条'),
        throwOnFailure: true,
      }),
    );
    expect(mockDirectMessageEmailBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        pendingCount: 0,
        previewItems: '[]',
        scheduledFor: null,
        processingAt: null,
        lastSentAt: expect.any(Date),
      }),
    });
  });

  it('does not queue email while the recipient is viewing the conversation', async () => {
    mockIsUserInConversation.mockReturnValue(true);

    const result = await service.queueDirectMessageEmail({
      recipientId: 'recipient-1',
      conversationId: 'conversation-1',
      senderName: 'Alice',
      isGroup: false,
      content: '在线就不发邮件',
      messageType: 'TEXT',
    });

    expect(result).toEqual({ queued: false, reason: 'conversation_open' });
    expect(mockDirectMessageEmailBatch.findUnique).not.toHaveBeenCalled();
  });

  it('keeps a failed batch pending and schedules a retry', async () => {
    const batch = makeBatch({ pendingCount: 1 });
    mockDirectMessageEmailBatch.findUnique.mockResolvedValueOnce(batch).mockResolvedValueOnce(batch);
    mockDirectMessageEmailBatch.updateMany.mockResolvedValue({ count: 1 });
    mockSendNotificationEmail.mockRejectedValue(new Error('SMTP unavailable'));
    mockDirectMessageEmailBatch.update.mockResolvedValue(
      makeBatch({
        scheduledFor: new Date('2026-06-09T00:06:00.000Z'),
        lastError: 'SMTP unavailable',
      }),
    );

    await service.flushDirectMessageEmailBatch('batch-1');

    expect(mockDirectMessageEmailBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: expect.objectContaining({
        scheduledFor: new Date('2026-06-09T00:06:00.000Z'),
        processingAt: null,
        lastError: 'SMTP unavailable',
      }),
    });
  });
});
