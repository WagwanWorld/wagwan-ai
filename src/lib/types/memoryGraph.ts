/** Serialized memory graph projection (behavioral + identity signals). */

export const MEMORY_GRAPH_SCHEMA_VERSION = 1 as const;

export type MemoryGraphNodeType =
  | 'user'
  | 'intent_mode'
  | 'platform'
  | 'theme'
  | 'signal'
  | 'prediction'
  | 'negative_pattern';

export interface MemoryGraphNode {
  id: string;
  type: MemoryGraphNodeType;
  label: string;
  /** 0–1 when applicable */
  weight?: number;
  meta?: Record<string, unknown>;
}

export type MemoryGraphEdgeType =
  | 'reinforces'
  | 'observed_on'
  | 'high_confidence_truth'
  | 'dampens'
  | 'derived_from';

export interface MemoryGraphEdge {
  id: string;
  from: string;
  to: string;
  type: MemoryGraphEdgeType;
  label?: string;
}

export interface MemoryGraphProjection {
  version: typeof MEMORY_GRAPH_SCHEMA_VERSION;
  generatedAt: string;
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
}
