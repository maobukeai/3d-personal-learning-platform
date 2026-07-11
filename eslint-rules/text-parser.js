/**
 * Minimal parser for non-JS files (currently .css).
 *
 * ESLint needs a parser to produce an AST before it can run rules. CSS files
 * are not valid JavaScript, so espree/vue-eslint-parser cannot parse them.
 * This parser returns a trivial empty AST — all style-scanning rules operate
 * on context.sourceCode.text directly and never traverse AST nodes, so an
 * empty Program is sufficient.
 *
 * The parser still supplies visitorKeys so ESLint doesn't warn about an
 * unknown node type during traversal.
 */

/** @returns {import('eslint').Linter.ESLintParseResult} */
function parseForESLint(text) {
  return {
    ast: {
      type: 'Program',
      body: [],
      sourceType: 'module',
      comments: [],
      tokens: [],
      loc: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
      },
      range: [0, 0],
    },
    services: { isTextParser: true },
    scopeManager: null,
    visitorKeys: {
      Program: [],
    },
  };
}

const textParser = {
  parseForESLint,
  parse(text) {
    return parseForESLint(text).ast;
  },
};

export default textParser;
