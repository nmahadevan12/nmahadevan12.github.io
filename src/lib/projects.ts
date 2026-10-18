import { getCollection, type CollectionEntry } from 'astro:content';
import { formatMonth, formatMonthRange } from './dates';
import { AREA_KEYS, AREA_LABELS, type Area, type Status } from './taxonomy';

export type Project = CollectionEntry<'projects'>;

const STATUS_RANK: Record<Status, number> = { 'in-progress': 2, completed: 1, planned: 0 };

function lastActivity(project: Project): number {
  const { start, end } = project.data;
  return (end ?? start)?.getTime() ?? 0;
}

/** In-progress work first, then completed projects newest-first, then planned ideas. */
export function compareProjects(a: Project, b: Project): number {
  return (
    STATUS_RANK[b.data.status] - STATUS_RANK[a.data.status] ||
    lastActivity(b) - lastActivity(a) ||
    a.data.title.localeCompare(b.data.title)
  );
}

/** Drafts show up while running `npm run dev` but are left out of the published site. */
export async function getProjects(): Promise<Project[]> {
  const projects = await getCollection('projects', ({ data }) => import.meta.env.DEV || !data.draft);
  return projects.sort(compareProjects);
}

/** Featured projects first, keeping the usual order within each group. */
export function featuredFirst(projects: Project[]): Project[] {
  return [...projects.filter((p) => p.data.featured), ...projects.filter((p) => !p.data.featured)];
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
