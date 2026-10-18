import { education, experience } from '../data/resume';
import { formatMonth, formatMonthRange, parseMonth, toMonthString } from './dates';
import { ANALYZER_COLORS, CHANNEL_COLORS } from './palette';
import { formatDateRange, type Project } from './projects';

export type ChannelKind = keyof typeof ANALYZER_COLORS;

/** Everything the browser needs to draw one channel. */
export interface ChannelSignal {
  id: string;
  kind: ChannelKind;
  title: string;
  /** `YYYY-MM`. `end` is inclusive; leave it out (or in the future) for ongoing work. */
  start: string;
  end?: string;
  /** Decoded payload: one analyzer frame per entry. */
  frames: string[];
  color: string;
  analyzer: string;
}

export interface CaptureChannel extends ChannelSignal {
  index: number;
  name: string;
  sub: string;
  org?: string;
  dates: string;
  startLabel: string;
  endLabel: string;
  summary?: string;
  points: string[];
  href?: string;
  hrefLabel?: string;
}

type Entry = Omit<CaptureChannel, 'index' | 'color' | 'analyzer'>;

/** Project slugs in the same order they appear on the résumé. Anything else is appended after. */
const RESUME_PROJECTS = [
  'edge-ai-wake-word',
  'light-tracker',
  'multifunction-instrumentation-system',
];

function projectEntry(project: Project): Entry | null {
  const { data } = project;
  if (!data.start || data.status === 'planned') return null;
  const end = data.end ?? (data.status === 'completed' ? data.start : undefined);
  return {
    id: project.id,
    kind: 'project',
    title: data.title,
    name: data.channel ?? data.title,
    sub: data.course ? `Project · ${data.course}` : 'Personal project',
    start: toMonthString(data.start),
    end: end && toMonthString(end),
    dates: formatDateRange(data),
    startLabel: formatMonth(data.start),
    endLabel: end ? formatMonth(end) : 'In progress',
    summary: data.summary,
    frames: data.tags,
    points: [],
    href: `/projects/${project.id}/`,
    hrefLabel: 'Open project',
  };
}

/** One channel per résumé section, in résumé order: education, roles, then projects. */
export function buildCaptureChannels(projects: Project[], now = new Date()): CaptureChannel[] {
  const entries: Entry[] = [];

  const schoolEnd = parseMonth(education.end);
  entries.push({
    id: 'uga',
    kind: 'education',
    title: education.school,
    name: education.school,
    sub: 'B.S. EE + CompE',
    org: education.degrees.join(' · '),
    start: education.start,
    end: education.end,
    dates: formatMonthRange(parseMonth(education.start), schoolEnd),
    startLabel: formatMonth(parseMonth(education.start)),
    endLabel: schoolEnd > now ? `${formatMonth(schoolEnd)} (expected)` : formatMonth(schoolEnd),
    summary: `GPA ${education.gpa}. Coursework includes ${education.coursework.join(', ')}.`,
    frames: [...education.degrees, `GPA ${education.gpa.split(' ')[0]}`, ...education.honors.slice(0, 2)],
    points: [],
    href: '#education',
    hrefLabel: 'Education details',
  });

  for (const job of experience) {
    const start = parseMonth(job.start);
    const end = job.end ? parseMonth(job.end) : undefined;
    entries.push({
      id: job.id,
      kind: 'role',
      title: job.role,
      name: job.channel,
      sub: job.orgShort,
      org: job.org,
      start: job.start,
      end: job.end,
      dates: formatMonthRange(start, end),
      startLabel: formatMonth(start),
      endLabel: end ? formatMonth(end) : 'Present',
      frames: job.tags,
      points: job.points,
    });
  }

  const seen = new Set<string>();
  for (const id of RESUME_PROJECTS) {
    const project = projects.find((entry) => entry.id === id);
    const channel = project && projectEntry(project);
    if (!channel) continue;
    seen.add(channel.id);
    entries.push(channel);
  }
  for (const project of projects) {
    if (seen.has(project.id)) continue;
    const channel = projectEntry(project);
    if (channel) entries.push(channel);
  }

  return entries.map((entry, index) => ({
    ...entry,
    index,
    color: CHANNEL_COLORS[index % CHANNEL_COLORS.length],
    analyzer: ANALYZER_COLORS[entry.kind],
  }));
}

export function toSignal({ id, kind, title, start, end, frames, color, analyzer }: CaptureChannel): ChannelSignal {
  return { id, kind, title, start, end, frames, color, analyzer };
}
