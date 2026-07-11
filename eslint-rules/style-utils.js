/**
 * Shared utilities for style-scanning ESLint rules.
 *
 * These helpers normalise file-path checks, extract <style> blocks from .vue
 * source text, and convert character offsets to ESLint-compatible locations
 * so that text-based rules (which don't rely on a CSS AST) can report
 * violations with accurate line/column information on both .vue and .css files.
 */

/** Normalise Windows backslashes to forward slashes for consistent matching. */
export function normalizePath(filename) {
  return (filename || '').replace(/\\/g, '/');
}

/** True for files that define design tokens and are always exempt from style rules. */
export function isTokenFile(filename) {
  const p = normalizePath(filename);
  return p.endsWith('src/styles/tokens.css') || p.endsWith('src/styles/themes.css');
}

/** True for .vue single-file components. */
export function isVueFile(filename) {
  return normalizePath(filename).endsWith('.vue');
}

/** True for plain .css files. */
export function isCssFile(filename) {
  return normalizePath(filename).endsWith('.css');
}

/**
 * Extract every <style>...</style> block from a .vue file's raw text.
 *
 * Returns an array of { content, startIndex } where:
 *   - content  = the raw text between the opening and closing style tags
 *   - startIndex = the character offset of `content` within the full source
 *
 * The offsets are preserved (no stripping) so callers can map regex matches
 * back to absolute source positions for accurate line/column reporting.
 */
export function extractStyleBlocks(text) {
  const blocks = [];
  const styleTagRegex = /<style\b[^>]*>/gi;
  let match;
  while ((match = styleTagRegex.exec(text)) !== null) {
    const startTagEnd = match.index + match[0].length;
    const closeIndex = text.indexOf('</style>', startTagEnd);
    if (closeIndex === -1) continue;
    const content = text.slice(startTagEnd, closeIndex);
    blocks.push({ content, startIndex: startTagEnd });
  }
  return blocks;
}

/**
 * Strip CSS block-comments and HTML comments from text while
 * preserving newlines so that line numbers stay aligned with the source.
 *
 * Callers that want comment-aware scanning should run their regexes against
 * the stripped text but compute locations against the original text — since
 * only non-newline characters are blanked, character offsets remain valid.
 */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ''));
}

/**
 * Check whether the source text contains the `immersive-surface` marker comment,
 * which opts a component into being allowed to use backdrop-filter.
 */
export function hasImmersiveMarker(text) {
  return /\/\*\s*immersive-surface\s*\*\//.test(text);
}

/**
 * Find the [start, end) character ranges of all color-mix( ... ) calls in
 * `text`, correctly handling nested parentheses.
 *
 * Used by no-hardcoded-colors to skip hardcoded colors that appear inside a
 * color-mix() expression (which the spec explicitly allows).
 */
export function findColorMixRanges(text) {
  const ranges = [];
  const opener = /color-mix\s*\(/gi;
  let m;
  while ((m = opener.exec(text)) !== null) {
    let depth = 1;
    let i = m.index + m[0].length;
    while (i < text.length && depth > 0) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
      i++;
    }
    ranges.push([m.index, i]);
  }
  return ranges;
}

/** True when `index` falls inside any of the [start, end) ranges. */
export function isInsideRanges(index, ranges) {
  for (const [s, e] of ranges) {
    if (index >= s && index < e) return true;
  }
  return false;
}

/**
 * Collect the text regions a style rule should scan for a given file.
 *
 * For .vue files: returns each <style> block's (stripped-of-comments) text
 *   together with its absolute start offset in the source.
 * For .css files: returns the whole file (stripped of comments) with offset 0.
 * For other files: returns [] (the rule should no-op).
 */
export function collectStyleRegions(filename, sourceText) {
  if (isVueFile(filename)) {
    const blocks = extractStyleBlocks(sourceText);
    return blocks.map((b) => ({
      text: stripComments(b.content),
      startIndex: b.startIndex,
      rawText: b.content,
    }));
  }
  if (isCssFile(filename)) {
    return [{ text: stripComments(sourceText), startIndex: 0, rawText: sourceText }];
  }
  return [];
}
