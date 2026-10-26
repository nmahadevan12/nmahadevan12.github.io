export const education = {
  school: 'University of Georgia',
  location: 'Athens, GA',
  degrees: ['B.S. Electrical Engineering', 'B.S. Computer Engineering'],
  start: '2024-08',
  end: '2028-05',
  gpa: '3.93 / 4.0',
  coursework: [
    'Embedded Systems',
    'Sensors & Transducers',
    'Linear Systems',
    'Electronics',
    'Logic Design',
    'Discrete Math',
    'Thermodynamics',
  ],
  honors: ['Eagle Scout', 'UGA Dean’s List'],
  memberships: [] as string[],
};

export interface Job {
  /** Anchor id on the home page and channel id in the capture. */
  id: string;
  role: string;
  org: string;
  /** Short names for the capture's channel list. */
  channel: string;
  orgShort: string;
  /** `YYYY-MM`. Leave `end` out while the job is ongoing. */
  start: string;
  end?: string;
  points: string[];
  tags: string[];
}

export const experience: Job[] = [
  {
    id: 'ssrl',
    role: 'Flight Software Engineer',
    org: 'University of Georgia Small Satellite Research Laboratory',
    channel: 'Flight software',
    orgShort: 'UGA SSRL',
    start: '2026-09',
    points: [
      'Developing CubeSat flight software in C++ and NASA F´ with C Zephyr drivers on STM32 for a ~15-person software team',
      'Reimplemented the legacy 7-state flight state machine with voltage debounce, request prioritization, and safe-shutdown sequencing',
      'Refactored the legacy file-recycler into thread-safe C++ with path abstractions, safer symlink handling, and documented interfaces',
      'Review teammates’ flight software changes; building UART/RS-485 Zephyr drivers and validating them in Renode',
    ],
    tags: ['C', 'C++', 'F´', 'Zephyr RTOS', 'STM32', 'UART', 'RS-485'],
  },
  {
    id: 'vip',
    role: 'Embedded Systems Research Intern',
    org: 'University of Georgia Vertically Integrated Projects for Research',
    channel: 'Embedded research',
    orgShort: 'UGA VIPR',
    start: '2026-08',
    points: [
      'Developing C++ drivers across I²C and SPI to acquire real-time IMU, temperature, and humidity telemetry on an ATmega328P-based canine health monitor',
      'Streaming structured multi-sensor packets to a host application in real time over HC-05 Bluetooth via hardware UART',
    ],
    tags: ['C++', 'ATmega328P', 'I²C', 'SPI', 'UART', 'Bluetooth'],
  },
  {
    id: 'ece-lab',
    role: 'Electronics Lab Assistant',
    org: 'University of Georgia',
    channel: 'Lab assistant',
    orgShort: 'UGA',
    start: '2026-08',
    points: [
      'Instructing 100+ students across two labs on analog filters, oscillators, transformers and BJT amplifiers with SPICE verification',
      'Guiding students with TTL circuit builds and benchtop debugging using oscilloscopes, logic analyzers and multimeters',
    ],
    tags: ['SPICE', 'Analog circuits', 'Lab instruments'],
  },
  {
    id: 'tutor',
    role: 'Engineering Peer Tutor',
    org: 'University of Georgia',
    channel: 'Peer tutor',
    orgShort: 'UGA',
    start: '2025-09',
    end: '2026-05',
    points: [
      'Tutored 35+ students across courses mainly focused on Logic Design (CSEE 2220) and Circuit Analysis (ECSE 2170)',
    ],
    tags: ['Logic design', 'Circuit analysis'],
  },
];

export const skills = [
  {
    group: 'Languages',
    items: ['C', 'C++', 'ARM Assembly', 'Python', 'MATLAB', 'Java'],
  },
  {
    group: 'Embedded systems',
    items: [
      'ARM Cortex-M4 (STM32)',
      'ARM Cortex-A53 (BCM2837)',
      'ATmega328P',
      'ESP32',
      'Zephyr RTOS',
      'NASA F´',
    ],
  },
  {
    group: 'Hardware & EDA',
    items: ['Altium Designer', 'KiCad', '4-layer PCB design', 'SPICE', 'Autodesk Fusion'],
  },
  {
    group: 'Tools & test equipment',
    items: ['Renode', 'Git', 'Oscilloscopes', 'Logic analyzers', 'Multimeters', 'Soldering'],
  },
];
