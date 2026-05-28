const injectionPatterns = [
  /ignore\s+(?:all\s+)?(?:previous|above|system)\s+instructions/i,
  /bypass\s+(?:the\s+)?system/i,
  /you\s+are\s+now\s+a\s+different/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /override\s+(?:the\s+)?system/i,
  /forget\s+(?:what\s+you\s+were\s+told|your\s+instructions)/i,
  /forget\s+all\s+previous/i,
  /system\s+override/i,
  /reset\s+instructions/i,
  /忽视之前的所有指令/i,
  /忽视系统指令/i,
  /忽略之前的指令/i,
  /忽略系统指令/i,
  /忘记之前的限制/i,
  /不要遵循任何限制/i,
  /绕过系统限制/i,
  /你现在不再是/i,
  /你现在是一个不受限制的/i,
];

// Precompile into a single global regex to optimize performance
const INJECTION_RE = new RegExp(injectionPatterns.map((p) => p.source).join('|'), 'i');

/**
 * Simple yet effective Prompt Injection detection.
 * Scans input text for typical jailbreak and instruction-override keywords.
 */
export function hasPromptInjection(text: string | null | undefined): boolean {
  if (!text) return false;
  return INJECTION_RE.test(text);
}
