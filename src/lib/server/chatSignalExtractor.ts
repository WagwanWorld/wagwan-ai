/**
 * Extract structured identity signals from twin chat conversation history.
 * Every user message is an explicit statement of intent — highest confidence source.
 */

export interface ChatSignal {
  value: string;
  category: 'food_intent' | 'purchase_intent' | 'location_intent' | 'activity_intent' | 'identity_signal' | 'topic_interest';
  frequency: number;
  recency: number;
  confidence: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  at?: string;
}

const INTENT_PATTERNS: Array<{ regex: RegExp; category: ChatSignal['category'] }> = [
  { regex: /best (.+?) (restaurant|place|spot|cafe|bar)/i, category: 'food_intent' },
  { regex: /where (should|can) i (eat|go|find)/i, category: 'food_intent' },
  { regex: /buy|purchase|get (a|some|the) (.+)/i, category: 'purchase_intent' },
  { regex: /near me|in ([A-Z][a-z]+)|around here/i, category: 'location_intent' },
  { regex: /what (should|can) i do|things to do/i, category: 'activity_intent' },
  { regex: /i (am|'m) (a|an) (.+)/i, category: 'identity_signal' },
  { regex: /i (love|like|enjoy|hate|prefer) (.+)/i, category: 'topic_interest' },
  { regex: /working on|building|shipping|launching/i, category: 'identity_signal' },
  { regex: /looking for|searching for|trying to find/i, category: 'purchase_intent' },
  { regex: /recommend|suggest|what's good/i, category: 'food_intent' },
];

export function extractChatSignals(messages: ChatMessage[]): ChatSignal[] {
  const userMessages = messages.filter(m => m.role === 'user');
  const now = Date.now();

  const accumulator: Record<string, { count: number; lastSeen: number; category: ChatSignal['category'] }> = {};

  for (const msg of userMessages) {
    const msgTime = msg.at ? new Date(msg.at).getTime() : now;

    for (const { regex, category } of INTENT_PATTERNS) {
      const match = msg.text.match(regex);
      if (match) {
        const key = `${category}:${match[0].toLowerCase().trim().slice(0, 60)}`;
        if (!accumulator[key]) accumulator[key] = { count: 0, lastSeen: msgTime, category };
        accumulator[key].count++;
        accumulator[key].lastSeen = Math.max(accumulator[key].lastSeen, msgTime);
      }
    }
  }

  return Object.entries(accumulator).map(([key, data]) => {
    const ageHours = (now - data.lastSeen) / 3_600_000;
    const recency = ageHours <= 24 ? 1.0 : ageHours <= 168 ? 0.7 : 0.4;
    return {
      value: key.split(':').slice(1).join(':'),
      category: data.category,
      frequency: Math.min(data.count / 5, 1.0),
      recency,
      confidence: 0.95,
    };
  }).filter(s => s.frequency > 0);
}
