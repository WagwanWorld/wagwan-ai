/**
 * Lightweight markdown renderer for chat bubbles.
 * Supports: **bold**, [links](url), bullet points (• / -), numbered lists, line breaks.
 */
export function renderChatMd(raw: string): string {
  if (!raw) return '';
  let s = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Markdown links
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  // Bare URLs (skip if already inside a tag — simple heuristic: no preceding quote+angle)
  s = s.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/gm, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  // Bullet points
  s = s.replace(/^[•\-]\s+/gm, '<span class="chat-bullet">•</span> ');
  // Numbered lists
  s = s.replace(/^(\d+)\.\s+/gm, '<span class="chat-num">$1.</span> ');
  // Line breaks
  s = s.replace(/\n/g, '<br/>');
  return s;
}
