// Draft state shown while editing, so block changes render before publishing.
import { useSyncExternalStore } from 'react';
import type { CmsContent } from './content.ts';
import type { Layout } from './blocks.ts';

export type CmsPreview = { page: string; content: CmsContent; layout: Layout | null } | null;
let state: CmsPreview = null;
const subs = new Set<() => void>();
export function setCmsPreview(p: CmsPreview) { state = p; subs.forEach(f => f()); }
export const getCmsPreview = () => state;
export function useCmsPreview() {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state, () => null);
}
