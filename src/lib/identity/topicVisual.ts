/**
 * Map free-text interest/need lines to a Lucide icon for lightweight UI affordances.
 * Order matters: first matching rule wins.
 */
import type { Component } from 'svelte';
import {
  Briefcase,
  Camera,
  CircleDot,
  Code,
  Coffee as CoffeeIcon,
  Globe,
  Heart,
  LayoutGrid,
  LineChart,
  MapPin,
  Mic,
  Music,
  Palette,
  Plane,
  Sparkles,
  Users,
  Wallet,
} from '@lucide/svelte';
import { imageUrlForKeyword } from '$lib/identity/visualIdentity';

export type TopicIconComponent = Component;

const RULES: Array<{ re: RegExp; Icon: TopicIconComponent }> = [
  { re: /community|network|social|audience|tribe|creator(s)?/i, Icon: Users },
  { re: /founder|startup|career|professional|operator|venture|seed|invest/i, Icon: Briefcase },
  { re: /design|ux|ui|figma|product\s*design|visual|illustrat/i, Icon: Palette },
  { re: /code|engineering|developer|ai\s|prompt|software/i, Icon: Code },
  { re: /fintech|payment|wallet|revenue|monetiz|fund/i, Icon: Wallet },
  { re: /music|audio|spotify|classical|album|artist/i, Icon: Music },
  { re: /photo|camera|visual\s*story/i, Icon: Camera },
  { re: /podcast|speaking|panel|host|event|salon/i, Icon: Mic },
  { re: /travel|bangalore|mumbai|india|nyc|urban|geo|city/i, Icon: MapPin },
  { re: /food|dining|brunch|café|cafe|restaurant/i, Icon: CoffeeIcon },
  { re: /travel|trip|flight|abroad|diaspora/i, Icon: Plane },
  { re: /market|growth|momentum|metric|scale|traction/i, Icon: LineChart },
  { re: /system|grid|ops|notion|productivity|task/i, Icon: LayoutGrid },
  { re: /world|global|cross-?cultural|international/i, Icon: Globe },
  { re: /wellness|values|intentional|gratitude|human/i, Icon: Heart },
];

export function topicIconForLine(line: string): TopicIconComponent {
  const t = line.trim();
  if (!t) return Sparkles;
  for (const { re, Icon } of RULES) {
    if (re.test(t)) return Icon;
  }
  return CircleDot;
}

/** Subtle Picsum stripe URL derived from line text (deterministic). */
export function topicThumbKeywordUrl(line: string): string {
  const seed = line.replace(/\s+/g, ' ').trim().slice(0, 96) || 'topic';
  return imageUrlForKeyword(`focus ${seed}`, 'square');
}
