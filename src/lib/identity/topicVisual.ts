/**
 * Map free-text interest/need lines to a Lucide icon for lightweight UI affordances.
 * Order matters: first matching rule wins.
 */
import type { Component } from 'svelte';
import Briefcase from 'phosphor-svelte/lib/Briefcase';
import Camera from 'phosphor-svelte/lib/Camera';
import CircleDashed from 'phosphor-svelte/lib/CircleDashed';
import Code from 'phosphor-svelte/lib/Code';
import Coffee from 'phosphor-svelte/lib/Coffee';
import Globe from 'phosphor-svelte/lib/Globe';
import Heart from 'phosphor-svelte/lib/Heart';
import GridFour from 'phosphor-svelte/lib/GridFour';
import ChartLine from 'phosphor-svelte/lib/ChartLine';
import MapPin from 'phosphor-svelte/lib/MapPin';
import Microphone from 'phosphor-svelte/lib/Microphone';
import MusicNote from 'phosphor-svelte/lib/MusicNote';
import Palette from 'phosphor-svelte/lib/Palette';
import Airplane from 'phosphor-svelte/lib/Airplane';
import Sparkle from 'phosphor-svelte/lib/Sparkle';
import UsersThree from 'phosphor-svelte/lib/UsersThree';
import Wallet from 'phosphor-svelte/lib/Wallet';
import { imageUrlForKeyword } from '$lib/identity/visualIdentity';

export type TopicIconComponent = Component;

const RULES: Array<{ re: RegExp; Icon: TopicIconComponent }> = [
  { re: /community|network|social|audience|tribe|creator(s)?/i, Icon: UsersThree },
  { re: /founder|startup|career|professional|operator|venture|seed|invest/i, Icon: Briefcase },
  { re: /design|ux|ui|figma|product\s*design|visual|illustrat/i, Icon: Palette },
  { re: /code|engineering|developer|ai\s|prompt|software/i, Icon: Code },
  { re: /fintech|payment|wallet|revenue|monetiz|fund/i, Icon: Wallet },
  { re: /music|audio|spotify|classical|album|artist/i, Icon: MusicNote },
  { re: /photo|camera|visual\s*story/i, Icon: Camera },
  { re: /podcast|speaking|panel|host|event|salon/i, Icon: Microphone },
  { re: /travel|bangalore|mumbai|india|nyc|urban|geo|city/i, Icon: MapPin },
  { re: /food|dining|brunch|café|cafe|restaurant/i, Icon: Coffee },
  { re: /travel|trip|flight|abroad|diaspora/i, Icon: Airplane },
  { re: /market|growth|momentum|metric|scale|traction/i, Icon: ChartLine },
  { re: /system|grid|ops|notion|productivity|task/i, Icon: GridFour },
  { re: /world|global|cross-?cultural|international/i, Icon: Globe },
  { re: /wellness|values|intentional|gratitude|human/i, Icon: Heart },
];

export function topicIconForLine(line: string): TopicIconComponent {
  const t = line.trim();
  if (!t) return Sparkle;
  for (const { re, Icon } of RULES) {
    if (re.test(t)) return Icon;
  }
  return CircleDashed;
}

/** Subtle Picsum stripe URL derived from line text (deterministic). */
export function topicThumbKeywordUrl(line: string): string {
  const seed = line.replace(/\s+/g, ' ').trim().slice(0, 96) || 'topic';
  return imageUrlForKeyword(`focus ${seed}`, 'square');
}
