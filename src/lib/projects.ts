import { getCollection, type CollectionEntry } from 'astro:content';
import { formatMonth, formatMonthRange } from './dates';
import { AREA_KEYS, AREA_LABELS, type Area, type Status } from './taxonomy';

export type Project = CollectionEntry<'projects'>;

/** Listing / capture / footer: completed work ranks above WIP. */
const LIST_STATUS_RANK: Record<Status, number> = { completed: 2, 'in-progress': 1, planned: 0 };

/** Projects index: still surface active WIP near the top. */
const INDEX_STATUS_RANK: Record<Status, number> = { 'in-progress': 2, completed: 1, planned: 0 };

function lastActivity(project: Project): number {
  const { start, end } = project.data;
  return (end ?? start)?.getTime() ?? 0;
}

function compareByRank(rank: Record<Status, number>, a: Project, b: Project): number {
  return (
    rank[b.data.status] - rank[a.data.status] ||
    lastActivity(b) - lastActivity(a) ||
    a.data.title.localeCompare(b.data.title)
  );
}

/** In-progress first — for the /projects index. */
export function compareProjects(a: Project, b: Project): number {
  return compareByRank(INDEX_STATUS_RANK, a, b);
}

/** Completed first — for homepage featured cards. */
export function compareFeatured(a: Project, b: Project): number {
  return compareByRank(LIST_STATUS_RANK, a, b);
}

/** Published projects only (never drafts), newest / in-progress first. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', ({ data }) => !data.draft);
  return projects.sort(compareProjects);
}

/**
 * Drafts are editable via direct URL in content, but omitted from listings.
 * In DEV, `getDraftProjects` can still preview them on /projects if needed.
 */
export async function getAllProjectsIncludingDrafts(): Promise<Project[]> {
  const projects = await getCollection('projects');
  return projects.sort(compareProjects);
}

/** Featured projects first (completed before WIP), then the rest. */
export function featuredFirst(projects: Project[]): Project[] {
  const featured = projects.filter((p) => p.data.featured).sort(compareFeatured);
  const rest = projects.filter((p) => !p.data.featured);
  return [...featured, ...rest];
}

export function areasInUse(projects: Project[]): { key: Area; label: string; count: number }[] {
  return AREA_KEYS.map((key) => ({
    key,
    label: AREA_LABELS[key],
    count: projects.filter((p) => p.data.areas.includes(key)).length,
  })).filter((area) => area.count > 0);
}

export function formatDateRange({ start, end, status }: Project['data']): string {
  if (!start) return status === 'planned' ? 'Planned' : '';
  if (!end) return status === 'in-progress' ? formatMonthRange(start) : formatMonth(start);
  return formatMonthRange(start, end);
}
