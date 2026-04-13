/**
 * Gmail metadata + snippet fetch and rule-based commerce / booking signals.
 */

export interface GmailMessageMeta {
  id: string;
  subject: string;
  from: string;
  snippet: string;
}

export interface GmailPurchaseSignal {
  category: 'food_delivery' | 'travel' | 'shopping' | 'other';
  brand: string;
  subject_line: string;
}

export interface GmailBookingSignal {
  kind: 'reservation' | 'ticket' | 'confirmation' | 'other';
  hint: string;
}

export interface GmailBrandCount {
  name: string;
  count: number;
}

export interface GmailSignals {
  purchases: GmailPurchaseSignal[];
  bookings: GmailBookingSignal[];
  brands: GmailBrandCount[];
  spending: {
    purchase_count_30d: number;
    category_counts: Record<string, number>;
    band: 'low' | 'mid' | 'high';
  };
}

const FOOD = [
  { re: /\bzomato\b/i, brand: 'Zomato' },
  { re: /\bswiggy\b/i, brand: 'Swiggy' },
  { re: /\buber\s*eats\b/i, brand: 'Uber Eats' },
  { re: /\bdoordash\b/i, brand: 'DoorDash' },
  { re: /\bgrubhub\b/i, brand: 'Grubhub' },
];

const TRAVEL = [
  { re: /\bindigo\b/i, brand: 'IndiGo' },
  { re: /\bairbnb\b/i, brand: 'Airbnb' },
  { re: /\bbooking\.com\b/i, brand: 'Booking.com' },
  { re: /\bexpedia\b/i, brand: 'Expedia' },
  { re: /\bmake\s*my\s*trip\b/i, brand: 'MakeMyTrip' },
  { re: /\bgoibibo\b/i, brand: 'Goibibo' },
  { re: /\buber\b/i, brand: 'Uber' },
  { re: /\blyft\b/i, brand: 'Lyft' },
];

const SHOP = [
  { re: /\bamazon\b/i, brand: 'Amazon' },
  { re: /\bflipkart\b/i, brand: 'Flipkart' },
  { re: /\bmyntra\b/i, brand: 'Myntra' },
  { re: /\bnykaa\b/i, brand: 'Nykaa' },
];

const BOOKING_HINT = /\b(confirmed|confirmation|reservation|booking|itinerary|e-?ticket|boarding pass|check-?in)\b/i;

function extractDomainFromFrom(from: string): string {
  const m = from.match(/<([^>]+)>/);
  const email = (m?.[1] ?? from).trim().toLowerCase();
  const at = email.split('@')[1];
  return at?.replace(/^www\./, '') ?? '';
}

export async function fetchGmailMessagesForSignals(
  token: string,
  opts?: { days?: number; maxList?: number },
): Promise<GmailMessageMeta[]> {
  const h = { Authorization: `Bearer ${token}` };
  const days = opts?.days ?? 28;
  const maxList = opts?.maxList ?? 45;
  const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
  const q = `after:${since}`;

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?labelIds=INBOX&maxResults=${maxList}&q=${encodeURIComponent(q)}`,
    { headers: h },
  );
  if (!listRes.ok) return [];
  const listData = await listRes.json();
  const ids: string[] = (listData.messages ?? []).map((m: { id: string }) => m.id).slice(0, maxList);
  if (!ids.length) return [];

  const results = await Promise.allSettled(
    ids.map(id =>
      fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
        { headers: h },
      ).then(r => (r.ok ? r.json() : null)),
    ),
  );

  const out: GmailMessageMeta[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled' || !r.value?.id) continue;
    const headers: { name: string; value: string }[] = r.value.payload?.headers ?? [];
    const subject = headers.find(x => x.name === 'Subject')?.value?.slice(0, 120) ?? '';
    const fromRaw = headers.find(x => x.name === 'From')?.value ?? '';
    const from = fromRaw.replace(/<.*?>/, '').trim().replace(/"/g, '').split(',')[0]?.trim() ?? '';
    const snippet = ((r.value.snippet as string) ?? '').slice(0, 200);
    out.push({ id: r.value.id, subject, from, snippet });
  }

  return out;
}

export function extractGmailSignals(messages: GmailMessageMeta[]): GmailSignals {
  const purchases: GmailPurchaseSignal[] = [];
  const bookings: GmailBookingSignal[] = [];
  const brandMap = new Map<string, number>();
  const categoryCounts: Record<string, number> = {};

  for (const m of messages) {
    const blob = `${m.subject} ${m.snippet} ${m.from}`.toLowerCase();
    const domain = extractDomainFromFrom(m.from);

    let matched = false;
    for (const { re, brand } of FOOD) {
      if (re.test(blob) || re.test(domain)) {
        purchases.push({ category: 'food_delivery', brand, subject_line: m.subject.slice(0, 80) });
        brandMap.set(brand, (brandMap.get(brand) ?? 0) + 1);
        categoryCounts.food_delivery = (categoryCounts.food_delivery ?? 0) + 1;
        matched = true;
        break;
      }
    }
    if (!matched) {
      for (const { re, brand } of TRAVEL) {
        if (re.test(blob) || re.test(domain)) {
          purchases.push({ category: 'travel', brand, subject_line: m.subject.slice(0, 80) });
          brandMap.set(brand, (brandMap.get(brand) ?? 0) + 1);
          categoryCounts.travel = (categoryCounts.travel ?? 0) + 1;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      for (const { re, brand } of SHOP) {
        if (re.test(blob) || re.test(domain)) {
          purchases.push({ category: 'shopping', brand, subject_line: m.subject.slice(0, 80) });
          brandMap.set(brand, (brandMap.get(brand) ?? 0) + 1);
          categoryCounts.shopping = (categoryCounts.shopping ?? 0) + 1;
          matched = true;
          break;
        }
      }
    }

    if (BOOKING_HINT.test(m.subject) || BOOKING_HINT.test(m.snippet)) {
      const kind: GmailBookingSignal['kind'] = /ticket|boarding|e-?ticket/i.test(m.subject + m.snippet)
        ? 'ticket'
        : /reservation|booking/i.test(m.subject + m.snippet)
          ? 'reservation'
          : 'confirmation';
      bookings.push({ kind, hint: m.subject.slice(0, 60) || m.snippet.slice(0, 60) });
    }

    if (
      !matched &&
      domain.length > 3 &&
      !/^(gmail|googlemail|outlook|hotmail|yahoo|icloud|proton)\./i.test(domain) &&
      /\b(order|receipt|invoice|shipped|delivered|purchase)\b/i.test(blob)
    ) {
      const label = domain.split('.')[0] ?? domain;
      if (label.length > 2 && label.length < 40) {
        brandMap.set(label, (brandMap.get(label) ?? 0) + 1);
      }
    }
  }

  const purchaseCount = purchases.length;
  let band: 'low' | 'mid' | 'high' = 'low';
  if (purchaseCount >= 10) band = 'high';
  else if (purchaseCount >= 4) band = 'mid';

  const brands: GmailBrandCount[] = [...brandMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  return {
    purchases: purchases.slice(0, 25),
    bookings: bookings.slice(0, 15),
    brands,
    spending: {
      purchase_count_30d: purchaseCount,
      category_counts: categoryCounts,
      band,
    },
  };
}
