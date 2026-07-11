import request from 'supertest';

// Mock asset-processor to avoid gltf-transform ESM issues
jest.mock('../src/utils/asset-processor', () => ({
  optimize3DAsset: jest.fn(),
  executeAssetAnalysis: jest.fn(),
  executeAssetProcessing: jest.fn(),
  process3DAsset: jest.fn(),
}));

import app from '../src/app';

/**
 * HTTP 响应延迟基准测试（铁律六·2）。
 *
 * 测试 5 个核心 GET 接口的响应时间，断言 p99 < 200ms（测试环境宽松阈值）。
 * 注意：`/api/health` 在 Express 主进程中不存在（仅在 Fastify 进程），
 * 这里用根路由 `/` 作为等价的健康检查端点。
 */
describe('API Latency Baseline Tests', () => {
  // 每个接口采样次数，用于计算 p99
  const SAMPLE_SIZE = 20;
  // 测试环境宽松阈值（生产目标 p99 < 50ms，测试环境考虑波动用 200ms）
  const LATENCY_THRESHOLD_MS = 200;

  const measureLatency = async (path: string): Promise<number[]> => {
    const latencies: number[] = [];
    // Warm up the route and DB connection pool to avoid cold-start spikes in results
    await request(app).get(path);
    for (let i = 0; i < SAMPLE_SIZE; i++) {
      const start = Date.now();
      await request(app).get(path);
      latencies.push(Date.now() - start);
    }
    return latencies;
  };

  const calculateP99 = (latencies: number[]): number => {
    const sorted = [...latencies].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * 0.99) - 1;
    return sorted[idx] ?? sorted[sorted.length - 1] ?? 0;
  };

  test('GET / (health-equivalent) should respond within latency threshold', async () => {
    const latencies = await measureLatency('/');
    const p99 = calculateP99(latencies);
    // eslint-disable-next-line no-console
    console.log(`GET / p99 latency: ${p99}ms (samples: ${latencies.length})`);
    expect(p99).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  test('GET /api/assets/public should respond within latency threshold', async () => {
    const latencies = await measureLatency('/api/assets/public');
    const p99 = calculateP99(latencies);
    // eslint-disable-next-line no-console
    console.log(`GET /api/assets/public p99 latency: ${p99}ms (samples: ${latencies.length})`);
    expect(p99).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  test('GET /api/courses should respond within latency threshold', async () => {
    const latencies = await measureLatency('/api/courses');
    const p99 = calculateP99(latencies);
    // eslint-disable-next-line no-console
    console.log(`GET /api/courses p99 latency: ${p99}ms (samples: ${latencies.length})`);
    expect(p99).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  test('GET /api/teams/public should respond within latency threshold', async () => {
    const latencies = await measureLatency('/api/teams/public');
    const p99 = calculateP99(latencies);
    // eslint-disable-next-line no-console
    console.log(`GET /api/teams/public p99 latency: ${p99}ms (samples: ${latencies.length})`);
    expect(p99).toBeLessThan(LATENCY_THRESHOLD_MS);
  });

  test('GET /api/notes/share/test-share-id should respond within latency threshold', async () => {
    // 该接口是公开端点，test-share-id 不存在故返回 404，但仍可测量响应延迟
    const latencies = await measureLatency('/api/notes/share/test-share-id');
    const p99 = calculateP99(latencies);
    // eslint-disable-next-line no-console
    console.log(
      `GET /api/notes/share/test-share-id p99 latency: ${p99}ms (samples: ${latencies.length})`,
    );
    expect(p99).toBeLessThan(LATENCY_THRESHOLD_MS);
  });
});
