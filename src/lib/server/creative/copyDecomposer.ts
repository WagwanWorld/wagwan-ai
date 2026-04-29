/**
 * Rule-based copy decomposition — no LLM call needed.
 * Parses raw copy text into structured hierarchy:
 * hook (attention line), body (supporting), cta, hashtags, legal.
 */

export interface DecomposedCopy {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
  legal: string;
}

const CTA_PATTERNS = [
  /^(shop now|buy now|order now|get started|sign up|subscribe|download|try free|start free|join now|book now|learn more|read more|see more|watch now|listen now|swipe up|tap to|click link|visit|check out|grab yours|claim|reserve|pre-order|apply now|register|enroll|save now|dm (?:us|me)|link in bio|link below|tap the link|hit the link|lien en bio)[\s.!→➡️🔗💫✨🔥]*$/i,
  /^(ready\??|let'?s go|do it|make it happen|start today|start now|don'?t wait|don'?t miss|act now|limited time|last chance|hurry|grab it|cop it|get it|run it)[\s.!→➡️🔗💫✨🔥]*$/i,
];

const LEGAL_PATTERNS = [
  /^[\*†‡§]/, // starts with asterisk or dagger
  /terms (?:and|&) conditions/i,
  /\bT&C\b/,
  /subject to/i,
  /\bwhile (?:stocks|supplies) last\b/i,
  /\bnot (?:a |an )?(?:guarantee|financial advice)\b/i,
  /\b(?:disclaimer|fine print)\b/i,
  /^(?:©|®|™)/,
];

/**
 * Decompose raw copy into structured hierarchy.
 * Pure regex + heuristics — zero API calls.
 */
export function decomposeCopy(rawCopy: string): DecomposedCopy {
  const lines = rawCopy
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length === 0) {
    return { hook: '', body: '', cta: '', hashtags: [], legal: '' };
  }

  // Extract hashtags (any line that's predominantly hashtags, or inline tags)
  const hashtagLines: string[] = [];
  const contentLines: string[] = [];

  for (const line of lines) {
    const hashCount = (line.match(/#\w+/g) || []).length;
    const wordCount = line.split(/\s+/).length;
    // If >50% of words are hashtags, it's a hashtag line
    if (hashCount > 0 && hashCount / wordCount > 0.5) {
      hashtagLines.push(line);
    } else {
      contentLines.push(line);
    }
  }

  const hashtags = hashtagLines
    .join(' ')
    .match(/#\w+/g)
    ?.map(h => h) || [];

  // Also extract inline hashtags from content lines
  for (const line of contentLines) {
    const inlineTags = line.match(/#\w+/g);
    if (inlineTags) {
      for (const tag of inlineTags) {
        if (!hashtags.includes(tag)) hashtags.push(tag);
      }
    }
  }

  // Remove hashtag-only lines from content
  const cleanContent = contentLines.filter(l => {
    const hashCount = (l.match(/#\w+/g) || []).length;
    const wordCount = l.split(/\s+/).length;
    return hashCount / wordCount < 0.5;
  });

  // Extract legal/fine print
  const legalLines: string[] = [];
  const nonLegalContent: string[] = [];

  for (const line of cleanContent) {
    if (LEGAL_PATTERNS.some(p => p.test(line))) {
      legalLines.push(line);
    } else {
      nonLegalContent.push(line);
    }
  }

  // Extract CTA (check last 1-2 lines)
  let cta = '';
  const remaining = [...nonLegalContent];

  for (let i = remaining.length - 1; i >= Math.max(0, remaining.length - 2); i--) {
    const line = remaining[i];
    // Strip emojis and trailing punctuation for matching
    const cleaned = line.replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}]/gu, '').trim();
    if (CTA_PATTERNS.some(p => p.test(cleaned))) {
      cta = remaining.splice(i, 1)[0];
      break;
    }
    // Also match short imperative lines ending with emoji/arrow
    if (cleaned.length < 40 && /[→➡️🔗💫✨🔥👇⬇️📲📱💬]/.test(line)) {
      cta = remaining.splice(i, 1)[0];
      break;
    }
  }

  // Hook = first line, body = rest
  const hook = remaining[0] || '';
  const body = remaining.slice(1).join('\n');

  return {
    hook,
    body,
    cta,
    hashtags,
    legal: legalLines.join('\n'),
  };
}
