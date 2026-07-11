/**
 * Standalone runner — generates the OpenAPI contract from Zod schemas and
 * writes `openapi.json` (and `openapi.yaml` when a YAML package is installed)
 * into the server root.
 *
 * Usage: `npm run generate:openapi` (from the server/ directory).
 */
import path from 'path';

import { generateOpenAPISpec, writeOpenAPISpec } from '../src/utils/openapi-generator';

const run = async (): Promise<void> => {
  const serverRoot = path.resolve(__dirname, '..');
  const spec = generateOpenAPISpec();
  const pathCount = Object.keys(spec.paths).length;
  const schemaCount = Object.keys(spec.components.schemas).length;

  const result = await writeOpenAPISpec(serverRoot);

  // eslint-disable-next-line no-console
  console.log('OpenAPI contract generated:');
  // eslint-disable-next-line no-console
  console.log(`  JSON: ${result.jsonPath} (${pathCount} paths, ${schemaCount} schemas)`);
  if (result.yamlPath) {
    // eslint-disable-next-line no-console
    console.log(`  YAML: ${result.yamlPath}`);
  } else {
    // eslint-disable-next-line no-console
    console.log("  YAML: skipped (no 'yaml' package installed)");
  }
};

run().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
