// jest.mock 必须在 import 之前声明，jest 会自动将其提升到文件顶部。
jest.mock('../../services/redis.service', () => {
  // mockLock.release 在每个测试的 beforeEach 中重置，这里给出初始实现
  const mockLock = {
    resources: ['lock:test:resource'],
    value: 'mock-lock-value',
    expiration: Date.now() + 30_000,
    release: jest.fn().mockResolvedValue({ attempts: [] as ReadonlyArray<Promise<unknown>> }),
  };

  return {
    redisService: {
      // acquireRedlock 返回与 redlock Lock 兼容的 mock 对象
      acquireRedlock: jest.fn().mockResolvedValue(mockLock),
      __mockLock: mockLock,
    },
  };
});

import { redisService } from '../../services/redis.service';
import { withRedlock } from '../withRedlock';

interface MockedRedisService {
  acquireRedlock: jest.Mock;
  __mockLock: {
    resources: string[];
    value: string;
    expiration: number;
    release: jest.Mock;
  };
}

// 将 mock 对象断言为带测试专用字段的类型，便于访问 __mockLock
const mockRedis = redisService as unknown as MockedRedisService;
const mockLock = mockRedis.__mockLock;

beforeEach(() => {
  jest.clearAllMocks();
  // 重置 release 为干净的 resolved mock，便于断言调用次数
  mockLock.release.mockResolvedValue({ attempts: [] });
  mockRedis.acquireRedlock.mockResolvedValue(mockLock);
});

describe('withRedlock', () => {
  it('应在获取锁后执行函数并释放锁', async () => {
    const mockFn = jest.fn().mockResolvedValue('result');

    const result = await withRedlock('test:resource', mockFn);

    expect(result).toBe('result');
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockRedis.acquireRedlock).toHaveBeenCalledWith('test:resource', 30_000);
    expect(mockLock.release).toHaveBeenCalledTimes(1);
  });

  it('应支持自定义 ttl 并传递给 acquireRedlock', async () => {
    const mockFn = jest.fn().mockResolvedValue('ok');

    await withRedlock('test:resource', mockFn, 5_000);

    expect(mockRedis.acquireRedlock).toHaveBeenCalledWith('test:resource', 5_000);
    expect(mockLock.release).toHaveBeenCalledTimes(1);
  });

  it('应在函数抛错时也释放锁并向上抛出原错误', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(withRedlock('test:resource', mockFn)).rejects.toThrow('fail');

    expect(mockFn).toHaveBeenCalledTimes(1);
    // 即使临界区抛错，finally 块仍必须释放锁
    expect(mockLock.release).toHaveBeenCalledTimes(1);
  });

  it('当 acquireRedlock 失败时不应执行 fn 且不应调用 release', async () => {
    const acquireError = new Error('lock busy');
    mockRedis.acquireRedlock.mockRejectedValue(acquireError);

    const mockFn = jest.fn().mockResolvedValue('should-not-run');

    await expect(withRedlock('test:resource', mockFn)).rejects.toThrow('lock busy');

    expect(mockFn).not.toHaveBeenCalled();
    expect(mockLock.release).not.toHaveBeenCalled();
  });
});
