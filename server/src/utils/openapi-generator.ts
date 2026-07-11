/**
 * OpenAPI 3.0 contract generator.
 *
 * Converts the Zod schemas declared in `schemas*.ts` into JSON Schema
 * (components/schemas) and derives an OpenAPI document whose `paths` are
 * sourced from a curated registry of the Fastify route definitions
 * (method + path + body-schema reference). The same schemas back route-level
 * validation, so the generated spec is the single source of truth consumed by
 * the frontend type generator and contract tests (plan §5 — API 合同).
 *
 * Design notes:
 *  - Schemas are collected dynamically from the four schema modules so newly
 *    exported Zod schemas are picked up automatically.
 *  - Conversion uses Zod v4's native `z.toJSONSchema()`. The `zod-to-json-schema`
 *    dependency targets `zod/v3` internals and returns empty objects for Zod v4
 *    schemas, so the native serializer is required for a working pipeline.
 *  - YAML output is emitted only when a `yaml` package is resolvable at
 *    runtime; otherwise JSON alone is written ("if yaml available").
 */
import { promises as fsPromises } from 'fs';
import path from 'path';
import { z, type ZodTypeAny } from 'zod';

import * as schemasMain from './schemas';
import * as schemasBatch1 from './schemas-batch1';
import * as schemasBatch2 from './schemas-batch2';
import * as schemasBatch3 from './schemas-batch3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface RouteEntry {
  method: HttpMethod;
  /** Fastify-style path, e.g. "/auth/login" or "/assets/:id/comments" (without the /api prefix). */
  path: string;
  summary: string;
  tag: string;
  /** Name of a schema in components/schemas used as the JSON request body. */
  bodySchema?: string;
  requiresAuth?: boolean;
}

interface OpenAPIOperation {
  tags: string[];
  summary: string;
  parameters?: Array<{
    name: string;
    in: 'path' | 'query';
    required: boolean;
    schema: Record<string, unknown>;
  }>;
  requestBody?: {
    required: boolean;
    content: Record<string, { schema: Record<string, unknown> }>;
  };
  responses: Record<string, Record<string, unknown>>;
  security?: Array<Record<string, unknown[]>>;
}

export interface OpenAPIDocument {
  openapi: '3.0.3';
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, Partial<Record<HttpMethod, OpenAPIOperation>>>;
  components: {
    schemas: Record<string, Record<string, unknown>>;
    responses: Record<
      string,
      { description: string; content: Record<string, { schema: Record<string, unknown> }> }
    >;
    securitySchemes: Record<string, Record<string, unknown>>;
  };
  tags: Array<{ name: string; description: string }>;
}

// ---------------------------------------------------------------------------
// Schema collection
// ---------------------------------------------------------------------------

const isZodSchema = (value: unknown): value is ZodTypeAny =>
  typeof value === 'object' && value !== null && '_def' in value;

const collectSchemas = (...modules: Array<Record<string, unknown>>): Record<string, ZodTypeAny> => {
  const out: Record<string, ZodTypeAny> = {};
  for (const mod of modules) {
    for (const [name, value] of Object.entries(mod)) {
      if (isZodSchema(value)) {
        out[name] = value;
      }
    }
  }
  return out;
};

const SCHEMA_REGISTRY: Record<string, ZodTypeAny> = collectSchemas(
  schemasMain as unknown as Record<string, unknown>,
  schemasBatch1 as unknown as Record<string, unknown>,
  schemasBatch2 as unknown as Record<string, unknown>,
  schemasBatch3 as unknown as Record<string, unknown>,
);

/**
 * Convert a Zod schema to a JSON Schema object suitable for OpenAPI
 * components (strips the `$schema` keyword, which is invalid inside
 * OpenAPI 3.0 components/schemas).
 *
 * Uses Zod v4's native `z.toJSONSchema()`. Schemas that the serializer cannot
 * represent (e.g. some `z.any()` / transform compositions) fall back to a
 * permissive empty-object schema so generation never aborts.
 */
const toJsonSchema = (name: string, schema: ZodTypeAny): Record<string, unknown> => {
  let converted: Record<string, unknown>;
  try {
    converted = z.toJSONSchema(schema) as Record<string, unknown>;
  } catch {
    // Edge-case types (exotic transforms, z.any() pipelines) — emit a
    // permissive schema instead of aborting the whole generation.
    return { description: `Permissive fallback for ${name} (unrepresentable Zod type).` };
  }
  const clone: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(converted)) {
    if (key === '$schema') continue;
    clone[key] = value;
  }
  return clone;
};

// ---------------------------------------------------------------------------
// Route registry — derived from the Fastify route files in src/fastify/routes.
// Each entry mirrors a real route registration (method + path + body schema).
// ---------------------------------------------------------------------------

export const ROUTE_REGISTRY: readonly RouteEntry[] = [
  // --- Auth (prefix /api) ---
  {
    method: 'post',
    path: '/auth/register',
    tag: 'Auth',
    summary: 'Register a new user account',
    bodySchema: 'registerSchema',
  },
  {
    method: 'post',
    path: '/auth/email/send-code-public',
    tag: 'Auth',
    summary: 'Send a public email verification code',
    bodySchema: 'sendCodePublicSchema',
  },
  {
    method: 'post',
    path: '/auth/email/verify-public',
    tag: 'Auth',
    summary: 'Verify a public email code',
    bodySchema: 'verifyPublicEmailSchema',
  },
  {
    method: 'post',
    path: '/auth/login',
    tag: 'Auth',
    summary: 'Login with email and password',
    bodySchema: 'loginSchema',
  },
  {
    method: 'post',
    path: '/auth/login/2fa',
    tag: 'Auth',
    summary: 'Complete login with a 2FA / recovery code',
    bodySchema: 'login2FASchema',
  },
  {
    method: 'post',
    path: '/auth/forgot-password/check',
    tag: 'Auth',
    summary: 'Check account before password reset',
    bodySchema: 'forgotPasswordCheckSchema',
  },
  {
    method: 'post',
    path: '/auth/forgot-password/reset-2fa',
    tag: 'Auth',
    summary: 'Reset password with email code (and 2FA if enabled)',
    bodySchema: 'resetPasswordWith2FASchema',
  },
  {
    method: 'put',
    path: '/auth/profile',
    tag: 'Auth',
    summary: 'Update the current user profile',
    bodySchema: 'profileSchema',
    requiresAuth: true,
  },
  {
    method: 'put',
    path: '/auth/change-password',
    tag: 'Auth',
    summary: 'Change the current user password',
    bodySchema: 'changePasswordSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/auth/email/verify',
    tag: 'Auth',
    summary: 'Verify the current user email',
    bodySchema: 'verifyEmailSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/auth/email/send-code-new',
    tag: 'Auth',
    summary: 'Send a verification code to a new email',
    bodySchema: 'sendCodeToNewEmailSchema',
    requiresAuth: true,
  },
  {
    method: 'put',
    path: '/auth/email/change',
    tag: 'Auth',
    summary: 'Change to a new email address',
    bodySchema: 'changeEmailSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/auth/2fa/enable',
    tag: 'Auth',
    summary: 'Enable two-factor authentication',
    bodySchema: 'enable2FASchema',
    requiresAuth: true,
  },
  {
    method: 'delete',
    path: '/auth/account',
    tag: 'Auth',
    summary: 'Delete the current user account',
    bodySchema: 'deleteAccountSchema',
    requiresAuth: true,
  },

  // --- Users (prefix /api) ---
  {
    method: 'get',
    path: '/auth/me',
    tag: 'Users',
    summary: 'Get the current authenticated user',
    requiresAuth: true,
  },
  {
    method: 'get',
    path: '/auth/users/public',
    tag: 'Users',
    summary: 'List public users',
    requiresAuth: true,
  },
  {
    method: 'get',
    path: '/auth/users/:id',
    tag: 'Users',
    summary: 'Get a public user profile by id',
    requiresAuth: true,
  },

  // --- Assets (prefix /api/assets) ---
  {
    method: 'get',
    path: '/assets',
    tag: 'Assets',
    summary: 'List assets (public browse, optional auth)',
  },
  { method: 'get', path: '/assets/:id', tag: 'Assets', summary: 'Get asset detail' },
  {
    method: 'post',
    path: '/assets/requests',
    tag: 'Assets',
    summary: 'Create an asset request',
    bodySchema: 'assetRequestSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/assets/:id/annotations',
    tag: 'Assets',
    summary: 'Create an asset annotation',
    bodySchema: 'assetAnnotationSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/assets/:id/share',
    tag: 'Assets',
    summary: 'Create or update an asset share link',
    bodySchema: 'assetShareSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/assets/:id/comments',
    tag: 'Assets',
    summary: 'Create an asset comment',
    bodySchema: 'assetCommentSchema',
    requiresAuth: true,
  },

  // --- Materials (prefix /api/materials) ---
  {
    method: 'get',
    path: '/materials',
    tag: 'Materials',
    summary: 'List materials (public browse, optional auth)',
  },
  { method: 'get', path: '/materials/:id', tag: 'Materials', summary: 'Get material detail' },
  {
    method: 'post',
    path: '/materials/requests',
    tag: 'Materials',
    summary: 'Create a material request',
    bodySchema: 'materialRequestSchema',
    requiresAuth: true,
  },
  {
    method: 'patch',
    path: '/materials/:id/status',
    tag: 'Materials',
    summary: 'Review (approve/reject) a material',
    bodySchema: 'materialReviewSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/materials/:id/share',
    tag: 'Materials',
    summary: 'Create or update a material share link',
    bodySchema: 'materialShareSchema',
    requiresAuth: true,
  },
  {
    method: 'post',
    path: '/materials/:id/comments',
    tag: 'Materials',
    summary: 'Create a material comment',
    bodySchema: 'materialCommentSchema',
    requiresAuth: true,
  },

  // --- Plugins (prefix /api/plugins) ---
  { method: 'get', path: '/plugins', tag: 'Plugins', summary: 'List plugins (optional auth)' },

  // --- Softwares (prefix /api/softwares) ---
  {
    method: 'get',
    path: '/softwares',
    tag: 'Softwares',
    summary: 'List softwares (auth)',
    requiresAuth: true,
  },

  // --- Tasks (prefix /api/tasks) ---
  { method: 'get', path: '/tasks', tag: 'Tasks', summary: 'List tasks', requiresAuth: true },
  {
    method: 'post',
    path: '/tasks',
    tag: 'Tasks',
    summary: 'Create a task',
    bodySchema: 'taskSchema',
    requiresAuth: true,
  },

  // --- Courses (prefix /api) ---
  {
    method: 'post',
    path: '/courses',
    tag: 'Courses',
    summary: 'Create a course',
    bodySchema: 'courseSchema',
    requiresAuth: true,
  },
  {
    method: 'put',
    path: '/courses/:id',
    tag: 'Courses',
    summary: 'Update a course',
    bodySchema: 'courseSchema',
    requiresAuth: true,
  },

  // --- Lessons (prefix /api) ---
  {
    method: 'post',
    path: '/lessons',
    tag: 'Lessons',
    summary: 'Create a lesson',
    bodySchema: 'lessonSchema',
    requiresAuth: true,
  },
  {
    method: 'put',
    path: '/lessons/:id',
    tag: 'Lessons',
    summary: 'Update a lesson',
    bodySchema: 'lessonSchema',
    requiresAuth: true,
  },

  // --- Notes (prefix /api) ---
  {
    method: 'post',
    path: '/notes',
    tag: 'Notes',
    summary: 'Create a standalone note',
    bodySchema: 'noteCreateSchema',
    requiresAuth: true,
  },

  // --- Feedback (prefix /api) ---
  {
    method: 'post',
    path: '/feedback',
    tag: 'Feedback',
    summary: 'Submit user feedback',
    bodySchema: 'submitFeedbackSchema',
    requiresAuth: true,
  },

  // --- Messages (prefix /api) ---
  {
    method: 'post',
    path: '/messages/conversations',
    tag: 'Messages',
    summary: 'Create a conversation',
    bodySchema: 'createConversationSchema',
    requiresAuth: true,
  },

  // --- Projects (prefix /api) ---
  {
    method: 'post',
    path: '/projects',
    tag: 'Projects',
    summary: 'Create a project',
    bodySchema: 'createProjectSchema',
    requiresAuth: true,
  },

  // --- Teams (prefix /api) ---
  {
    method: 'post',
    path: '/teams',
    tag: 'Teams',
    summary: 'Create a team',
    bodySchema: 'createTeamSchema',
    requiresAuth: true,
  },

  // --- Roadmaps (prefix /api) ---
  {
    method: 'post',
    path: '/roadmaps',
    tag: 'Roadmaps',
    summary: 'Create a roadmap',
    bodySchema: 'createRoadmapSchema',
    requiresAuth: true,
  },
];

const API_PREFIX = '/api';

/** Convert a Fastify-style path ("/assets/:id/comments") to OpenAPI style ("/assets/{id}/comments"). */
const toOpenAPIPath = (routePath: string): string => {
  const stripped = routePath.startsWith(API_PREFIX)
    ? routePath.slice(API_PREFIX.length)
    : routePath;
  return `${API_PREFIX}${stripped.replace(/:(\w+)/g, (_match, name: string) => `{${name}}`)}`;
};

/** Extract path parameter names from a Fastify-style path. */
const extractPathParams = (routePath: string): string[] => {
  const matches = routePath.match(/:(\w+)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1));
};

// ---------------------------------------------------------------------------
// Spec construction
// ---------------------------------------------------------------------------

const buildComponents = (): OpenAPIDocument['components'] => {
  const schemas: Record<string, Record<string, unknown>> = {};
  for (const [name, schema] of Object.entries(SCHEMA_REGISTRY)) {
    schemas[name] = toJsonSchema(name, schema);
  }

  const errorSchemaRef = (code: string, description: string) => ({
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['status', 'code', 'message'],
          properties: {
            status: { type: 'string', enum: ['error'] },
            success: { type: 'boolean', enum: [false] },
            code: { type: 'string', example: code },
            message: { type: 'string' },
            error: { type: 'string' },
            requestId: { type: 'string' },
            details: { type: 'array', items: {} },
          },
        },
      },
    },
  });

  return {
    schemas,
    responses: {
      BadRequest: errorSchemaRef('VALIDATION_ERROR', 'Request failed schema validation.'),
      Unauthorized: errorSchemaRef('UNAUTHORIZED', 'Authentication is required for this endpoint.'),
    },
    securitySchemes: {
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'accessToken',
      },
    },
  };
};

const buildOperation = (entry: RouteEntry): OpenAPIOperation => {
  const parameters: OpenAPIOperation['parameters'] = extractPathParams(entry.path).map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));

  const operation: OpenAPIOperation = {
    tags: [entry.tag],
    summary: entry.summary,
    responses: {
      '200': { description: 'Successful response.' },
      '400': { $ref: '#/components/responses/BadRequest' },
    },
  };

  if (parameters && parameters.length > 0) {
    operation.parameters = parameters;
  }

  if (entry.bodySchema) {
    operation.requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${entry.bodySchema}` },
        },
      },
    };
  }

  if (entry.requiresAuth) {
    operation.responses['401'] = { $ref: '#/components/responses/Unauthorized' };
    operation.security = [{ cookieAuth: [] }];
  }

  return operation;
};

const buildPaths = (): OpenAPIDocument['paths'] => {
  const paths: OpenAPIDocument['paths'] = {};
  for (const entry of ROUTE_REGISTRY) {
    const openApiPath = toOpenAPIPath(entry.path);
    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }
    const pathItem = paths[openApiPath];
    if (pathItem) {
      pathItem[entry.method] = buildOperation(entry);
    }
  }
  return paths;
};

const TAG_DESCRIPTIONS: Record<string, string> = {
  Auth: 'Authentication, registration, 2FA, and account management.',
  Users: 'User profiles and public user listings.',
  Assets: '3D asset library — browse, share, annotate, comment.',
  Materials: 'Material library — browse, share, review, comment.',
  Plugins: 'Plugin marketplace listings.',
  Softwares: 'Software resource listings.',
  Tasks: 'Personal and project task management.',
  Courses: 'Course authoring and management.',
  Lessons: 'Lesson authoring and management.',
  Notes: 'Standalone note authoring.',
  Feedback: 'User feedback submission.',
  Messages: 'Conversations and direct messaging.',
  Projects: 'Project creation and management.',
  Teams: 'Team creation and management.',
  Roadmaps: 'Learning roadmap creation.',
};

/**
 * Build the complete OpenAPI 3.0 document from the Zod schema registry and
 * the Fastify route registry.
 */
export const generateOpenAPISpec = (): OpenAPIDocument => {
  const tags = Object.keys(TAG_DESCRIPTIONS).map((name) => ({
    name,
    description: TAG_DESCRIPTIONS[name] ?? '',
  }));

  return {
    openapi: '3.0.3',
    info: {
      title: '3D Personal Learning Platform API',
      version: '1.0.0',
      description:
        'OpenAPI contract auto-generated from Zod schemas and Fastify route definitions. ' +
        'The same Zod schemas drive route-level validation, the frontend client types, and contract tests.',
    },
    servers: [{ url: '/api', description: 'API root (mounted under /api)' }],
    paths: buildPaths(),
    components: buildComponents(),
    tags,
  };
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const tryRequireYamlStringify = (): ((obj: unknown) => string) | null => {
  try {
    // `require` is available because the server compiles to CommonJS.
    // Resolving 'yaml' at runtime lets us emit YAML only when the package
    // is installed; the project does not depend on it by default.

    const yaml = require('yaml') as { stringify: (obj: unknown) => string };
    if (typeof yaml?.stringify === 'function') {
      return yaml.stringify.bind(yaml);
    }
    return null;
  } catch {
    return null;
  }
};

export interface WriteResult {
  jsonPath: string;
  yamlPath?: string;
}

/**
 * Generate the spec and write it to disk as `openapi.json` (and
 * `openapi.yaml` when a YAML serializer is available).
 *
 * @param outputDir Absolute directory to write into. Defaults to the server root.
 */
export const writeOpenAPISpec = async (outputDir?: string): Promise<WriteResult> => {
  const spec = generateOpenAPISpec();
  const dir = outputDir ?? path.resolve(__dirname, '..', '..');
  const jsonPath = path.join(dir, 'openapi.json');
  await fsPromises.writeFile(jsonPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');

  const result: WriteResult = { jsonPath };

  const yamlStringify = tryRequireYamlStringify();
  if (yamlStringify) {
    const yamlPath = path.join(dir, 'openapi.yaml');
    await fsPromises.writeFile(yamlPath, yamlStringify(spec), 'utf8');
    result.yamlPath = yamlPath;
  }

  return result;
};
