/**
 * Curated Unsplash stills for suggestion UI when APIs don't return image_url.
 * (auto=format&fit=crop keeps payloads small.)
 */
function unsplash(path: string, w: number, h: number): string {
  const u = new URL(`https://images.unsplash.com/${path}`);
  u.searchParams.set('auto', 'format');
  u.searchParams.set('fit', 'crop');
  u.searchParams.set('w', String(w));
  u.searchParams.set('h', String(h));
  u.searchParams.set('q', '80');
  return u.toString();
}

const HERO: Record<string, string> = {
  music: 'photo-1470229722913-7c0e2dbbafd3',
  culture: 'photo-1511671782779-c97d3d27a1d4',
  food: 'photo-1414235077428-338989a2e8c0',
  nightlife: 'photo-1566417713940-fe7c737a9ef8',
  experience: 'photo-1492684223066-81342ee5ff30',
  fitness: 'photo-1534438327276-14e5300c3a48',
  wellness: 'photo-1544367567-0f2fcb009e0b',
  fashion: 'photo-1445205170230-053b83016050',
  travel: 'photo-1469854523086-cc02fe5d8804',
  tech: 'photo-1519389950473-47ba0277781c',
  deal: 'photo-1607082348824-0a96f2a4b9da',
  job: 'photo-1521737711867-e3b97375f902',
  product: 'photo-1607082349434-03a2c71bae9c',
  video: 'photo-1611162616475-46b635cb6868',
  other: 'photo-1506905925346-21bda4d32df4',
};

/** Hero crop for vertical cards (tall) or large tiles. */
export function suggestionHeroUrl(category: string, w = 480, h = 640): string {
  const key = (category || 'other').toLowerCase();
  const path = HERO[key] ?? HERO.other;
  return unsplash(path, w, h);
}

/** Small square for chips and avatars. */
export function suggestionThumbUrl(category: string, size = 96): string {
  return suggestionHeroUrl(category, size, size);
}

export const quickAskImage = {
  music: unsplash('photo-1514525253161-7a46d19cd819', 96, 96),
  tonight: unsplash('photo-1429961794451-b5330ef10751', 96, 96),
  food: unsplash('photo-1504674900247-0877df9cc836', 96, 96),
  trip: unsplash('photo-1469854523086-cc02fe5d8804', 96, 96),
  deal: unsplash('photo-1607082348824-0a96f2a4b9da', 96, 96),
} as const;

export const vibeOrbitImage = {
  music: unsplash('photo-1493225457124-a3eb161ffa5f', 80, 80),
  food: unsplash('photo-1540189549336-e6e99c3679fe', 80, 80),
  nights: unsplash('photo-1566737230200-bbbd1234ee89', 80, 80),
  fitness: unsplash('photo-1571019614242-c5c5dee9f50b', 80, 80),
} as const;

/** Things-you-should-know row — infer from topic text. */
export function newsRowImage(topic: string): string {
  const t = (topic || '').toLowerCase();
  if (/music|album|concert|artist|band/.test(t)) return suggestionThumbUrl('music', 64);
  if (/tech|ai|startup|apple|google/.test(t)) return suggestionThumbUrl('tech', 64);
  if (/food|restaurant|chef|dining/.test(t)) return suggestionThumbUrl('food', 64);
  if (/fashion|style|brand|luxury/.test(t)) return suggestionThumbUrl('fashion', 64);
  if (/sport|fitness|game/.test(t)) return suggestionThumbUrl('fitness', 64);
  if (/film|movie|tv|show/.test(t)) return suggestionThumbUrl('culture', 64);
  return unsplash('photo-1504711434969-e33886168f5c', 64, 64);
}

export const paSparkImage = unsplash('photo-1557683316-973673baf926', 56, 56);
