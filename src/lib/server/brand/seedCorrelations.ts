import { getServiceSupabase } from '$lib/server/supabase';
import type { CorrelationInsert } from './types';

type SeedRow = CorrelationInsert & { source: string };

export const SEED_CORRELATIONS: SeedRow[] = [
  // Music → Streetwear
  { signal_a: 'Justin Bieber', signal_a_cat: 'music genre cluster', signal_b: 'streetwear', signal_b_cat: 'instagram descriptor', correlation_r: 0.45, support_count: 100, lift: 2.4, confidence: 0.65, domain_distance: 3, source: 'seed_cultural' },
  { signal_a: 'streetwear', signal_a_cat: 'instagram descriptor', signal_b: 'Justin Bieber', signal_b_cat: 'music genre cluster', correlation_r: 0.45, support_count: 100, lift: 1.8, confidence: 0.55, domain_distance: 3, source: 'seed_cultural' },
  // AP Dhillon → Luxury fashion
  { signal_a: 'AP Dhillon', signal_a_cat: 'music genre cluster', signal_b: 'luxury fashion', signal_b_cat: 'brand vibe', correlation_r: 0.42, support_count: 80, lift: 2.1, confidence: 0.60, domain_distance: 3, source: 'seed_cultural' },
  { signal_a: 'luxury fashion', signal_a_cat: 'brand vibe', signal_b: 'AP Dhillon', signal_b_cat: 'music genre cluster', correlation_r: 0.42, support_count: 80, lift: 1.6, confidence: 0.48, domain_distance: 3, source: 'seed_cultural' },
  // Indie → Film photography
  { signal_a: 'indie', signal_a_cat: 'music genre', signal_b: 'film photography', signal_b_cat: 'instagram interest', correlation_r: 0.58, support_count: 120, lift: 3.1, confidence: 0.72, domain_distance: 2, source: 'seed_cultural' },
  { signal_a: 'film photography', signal_a_cat: 'instagram interest', signal_b: 'indie', signal_b_cat: 'music genre', correlation_r: 0.58, support_count: 120, lift: 2.4, confidence: 0.65, domain_distance: 2, source: 'seed_cultural' },
  // Ghazal → Fine dining
  { signal_a: 'ghazal', signal_a_cat: 'music genre', signal_b: 'fine dining', signal_b_cat: 'lifestyle signal', correlation_r: 0.38, support_count: 60, lift: 1.9, confidence: 0.55, domain_distance: 3, source: 'seed_cultural' },
  // Raj Shamani → SaaS tools
  { signal_a: 'Raj Shamani', signal_a_cat: 'music genre cluster', signal_b: 'SaaS tools', signal_b_cat: 'profile interest', correlation_r: 0.52, support_count: 90, lift: 2.8, confidence: 0.70, domain_distance: 3, source: 'seed_cultural' },
  // Design school → Film aesthetic
  { signal_a: 'design school', signal_a_cat: 'profile interest', signal_b: 'film aesthetic', signal_b_cat: 'instagram descriptor', correlation_r: 0.50, support_count: 85, lift: 2.6, confidence: 0.68, domain_distance: 2, source: 'seed_cultural' },
  // Zach Bryan → Outdoor gear
  { signal_a: 'Zach Bryan', signal_a_cat: 'music genre cluster', signal_b: 'outdoor gear', signal_b_cat: 'profile interest', correlation_r: 0.44, support_count: 75, lift: 2.2, confidence: 0.61, domain_distance: 3, source: 'seed_cultural' },
  // Morning worker → Protein supplement
  { signal_a: 'morning worker', signal_a_cat: 'calendar pattern', signal_b: 'protein supplement', signal_b_cat: 'lifestyle signal', correlation_r: 0.40, support_count: 70, lift: 2.0, confidence: 0.58, domain_distance: 2, source: 'seed_cultural' },
  // Founder → Premium productivity
  { signal_a: 'founder', signal_a_cat: 'professional identity', signal_b: 'premium productivity', signal_b_cat: 'brand vibe', correlation_r: 0.60, support_count: 150, lift: 3.4, confidence: 0.78, domain_distance: 2, source: 'seed_cultural' },
  { signal_a: 'premium productivity', signal_a_cat: 'brand vibe', signal_b: 'founder', signal_b_cat: 'professional identity', correlation_r: 0.60, support_count: 150, lift: 2.8, confidence: 0.70, domain_distance: 2, source: 'seed_cultural' },
  // Travel planner → Audio gear
  { signal_a: 'travel planner', signal_a_cat: 'calendar pattern', signal_b: 'audio gear', signal_b_cat: 'brand vibe', correlation_r: 0.36, support_count: 65, lift: 1.8, confidence: 0.53, domain_distance: 2, source: 'seed_cultural' },
  // High engagement → Brand collaboration
  { signal_a: 'high engagement', signal_a_cat: 'instagram pattern', signal_b: 'brand collaboration', signal_b_cat: 'lifestyle signal', correlation_r: 0.54, support_count: 110, lift: 2.9, confidence: 0.71, domain_distance: 1, source: 'seed_cultural' },
];

export async function seedCorrelationIndex(): Promise<void> {
  const supabase = getServiceSupabase();
  const { error } = await supabase
    .from('correlation_index')
    .upsert(SEED_CORRELATIONS, { onConflict: 'signal_a,signal_b' });
  if (error) {
    console.error('[seedCorrelationIndex] Error seeding:', error.message);
  } else {
    console.log(`[seedCorrelationIndex] Seeded ${SEED_CORRELATIONS.length} cultural correlations`);
  }
}
