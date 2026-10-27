export const site = {
  name: 'Nikhil Mahadevan',
  title: 'Nikhil Mahadevan · Electrical & Electronics + Computer Systems Engineering',
  description:
    'Nikhil Mahadevan — EEE + CSE at UGA. Embedded firmware, analog hardware, and flight software. Open to Summer 2027 internships; graduating May 2028.',
  /** Primary hero line (first row). */
  intro: 'EEE + CSE at UGA · embedded firmware and hardware',
  /** Primary hero line (second row — keep GPA with its number). */
  introMeta: 'GPA\u00A03.93 · graduating May 2028',
  /** Secondary hero line — role + ask. */
  introDetail:
    'Flight software at UGA’s Small Satellite Research Lab. Open to Summer 2027 internships in embedded systems, hardware, and computer architecture.',
  /** Shorter blurb for the footer. */
  blurb: 'EEE + CSE at UGA — embedded firmware, analog hardware, and flight software.',
  currently: 'Flight Software Engineer at UGA’s Small Satellite Research Lab',
  availability:
    'I’m open to Summer 2027 internships in embedded systems, hardware design, and computer architecture.',
  location: 'Athens, GA',
  email: 'Nikhil.Mahadevan@uga.edu',
  /** Filename bumps when the PDF changes so browsers don’t keep an old cached copy. */
  resume: '/Nikhil_Mahadevan_Resume_Oct27.pdf',
  github: 'https://github.com/nmahadevan12',
  linkedin: 'https://www.linkedin.com/in/nmahadevan12',
  /** Absolute path under `public/` for link previews. */
  ogImage: '/hero/hero-1.jpg',
};

export const nav = [
  { label: 'Projects', href: '/projects/' },
  { label: 'Experience', href: '/#experience' },
  { label: 'Résumé', href: site.resume, external: true },
  { label: 'Contact', href: '/#contact' },
];
