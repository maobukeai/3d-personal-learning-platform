import {
  generateOpenAPISpec,
  ROUTE_REGISTRY,
  type OpenAPIDocument,
} from '../../src/utils/openapi-generator';

/**
 * Contract tests for the generated OpenAPI document itself.
 *
 * Ensures the spec (the single source of truth shared with the frontend type
 * generator) is structurally valid and that every route in the registry
 * references a schema component that actually exists. This test does NOT boot
 * the Fastify app, so it runs without a database or redis.
 */
describe('OpenAPI spec contract', () => {
  const spec: OpenAPIDocument = generateOpenAPISpec();

  it('declares OpenAPI 3.0.3 with basic info', () => {
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBeTruthy();
    expect(spec.info.version).toBeTruthy();
    expect(spec.info.description).toBeTruthy();
  });

  it('exposes the API root server', () => {
    expect(spec.servers.length).toBeGreaterThan(0);
    expect(spec.servers[0]?.url).toBe('/api');
  });

  it('includes the key paths derived from the route registry', () => {
    const pathKeys = Object.keys(spec.paths);
    expect(pathKeys).toContain('/api/auth/login');
    expect(pathKeys).toContain('/api/auth/register');
    expect(pathKeys).toContain('/api/assets/{id}/comments');
    expect(pathKeys).toContain('/api/materials/{id}/comments');
    expect(pathKeys).toContain('/api/tasks');
    expect(pathKeys).toContain('/api/materials');

    const loginOp = spec.paths['/api/auth/login']?.post;
    expect(loginOp).toBeDefined();
    expect(loginOp?.requestBody?.content['application/json']?.schema).toEqual({
      $ref: '#/components/schemas/loginSchema',
    });
  });

  it('converts Fastify :param paths to OpenAPI {param} paths', () => {
    const pathKeys = Object.keys(spec.paths);
    expect(pathKeys.some((p) => p.includes(':'))).toBe(false);
    expect(pathKeys).toContain('/api/assets/{id}/comments');
    expect(pathKeys).toContain('/api/auth/users/{id}');
  });

  it('includes Zod-derived component schemas', () => {
    const schemas = spec.components.schemas;
    expect(Object.keys(schemas).length).toBeGreaterThan(20);
    expect(schemas.loginSchema).toBeDefined();
    expect(schemas.registerSchema).toBeDefined();
    expect(schemas.assetCommentSchema).toBeDefined();
    expect(schemas.materialCommentSchema).toBeDefined();
    expect(schemas.taskSchema).toBeDefined();
    expect(schemas.courseSchema).toBeDefined();
  });

  it('strips the $schema keyword from component schemas (invalid in OpenAPI 3.0)', () => {
    for (const schema of Object.values(spec.components.schemas)) {
      expect(schema.$schema).toBeUndefined();
    }
  });

  it('references an existing schema for every route with a body', () => {
    const schemaNames = new Set(Object.keys(spec.components.schemas));
    for (const entry of ROUTE_REGISTRY) {
      if (!entry.bodySchema) continue;
      expect(schemaNames.has(entry.bodySchema)).toBe(true);
    }
  });

  it('marks authenticated routes with a 401 response and cookie security', () => {
    const createTask = spec.paths['/api/tasks']?.post;
    expect(createTask).toBeDefined();
    expect(createTask?.responses['401']).toEqual({
      $ref: '#/components/responses/Unauthorized',
    });
    expect(createTask?.security).toEqual([{ cookieAuth: [] }]);
  });

  it('includes shared error responses for validation and auth failures', () => {
    expect(spec.components.responses.BadRequest).toBeDefined();
    expect(spec.components.responses.Unauthorized).toBeDefined();
    expect(spec.components.securitySchemes.cookieAuth).toBeDefined();
  });
});
