export const AREA_KEYS = ['embedded', 'hardware', 'architecture', 'signal', 'software'] as const;
export type Area = (typeof AREA_KEYS)[number];

export const AREA_LABELS: Record<Area, string> = {
  embedded: 'Embedded Systems',
  hardware: 'Circuits & PCB',
  architecture: 'Computer Architecture',
  signal: 'Signal Processing & ML',
  software: 'Software',
};

export const STATUS_KEYS = ['in-progress', 'completed', 'planned'] as const;
export type Status = (typeof STATUS_KEYS)[number];

export const STATUS_LABELS: Record<Status, string> = {
  'in-progress': 'In progress',
  completed: 'Completed',
  planned: 'Planned',
};
