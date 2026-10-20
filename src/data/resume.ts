export const education = {
  school: 'University of Georgia',
  location: 'Athens, GA',
  degrees: ['B.S. Electrical Engineering', 'B.S. Computer Engineering'],
  start: '2024-08',
  end: '2028-05',
  gpa: '3.93 / 4.0',
  coursework: [
    'Logic Design',
    'Electronics',
    'Sensors & Transducers',
    'Linear Systems',
    'Embedded Systems',
    'Informatics',
  ],
  honors: ['Zell Miller Scholar', 'UGA Dean’s List', 'Eagle Scout (2022)'],
  memberships: ['UGA IEEE MicroMouse', 'UGA Outdoor Club'],
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
    org: 'UGA Small Satellite Research Laboratory',
    channel: 'Flight software',
    orgShort: 'UGA SSRL',
    start: '2026-09',
    points: [
      'Rewrote the F´ FileRecycler for MEMESat image/message storage after the prior version failed in F´ — scheduled and ground-commanded deletes by time or count; change builds and links clean, with hardware-in-the-loop testing still ahead',
      'Got the flight STM32 flashing reliably after correcting pin mux / placement issues that blocked bring-up',
      'Building Zephyr RTOS flight software in C on STM32 for CubeSat command handling and UART / RS-485 subsystem links, with Renode used to validate bus behavior before full bench hardware',
    ],
    tags: ['C', 'F´', 'Zephyr RTOS', 'STM32', 'UART', 'RS-485', 'Renode'],
  },
  {
    id: 'vip',
    role: 'Embedded Systems Research Intern',
    org: 'UGA Vertically Integrated Projects for Research',
    channel: 'Embedded research',
    orgShort: 'UGA VIPR',
    start: '2026-08',
    points: [
      'Writing C++ I²C and SPI drivers for IMU, temperature, and humidity sensors on an ATmega328P canine heat-stress wearable',
      'Implementing Bluetooth streaming of those sensors to a host app for real-time monitoring',
    ],
    tags: ['C++', 'ATmega328P', 'I²C', 'SPI', 'Bluetooth'],
  },
  {
    id: 'ece-lab',
    role: 'Electronics Lab Assistant',
    org: 'UGA School of Electrical & Computer Engineering',
    channel: 'Lab assistant',
    orgShort: 'UGA ECE',
    start: '2026-08',
    points: [
      'Teaching 100+ students across two labs through analog filters, oscillators, transformers, and BJT amplifiers with SPICE checks',
      'Coaching TTL builds and benchtop debug with oscilloscopes, logic analyzers, and multimeters until circuits meet lab specs',
      'Analyzed Lab 1 student AI-interaction writeups (n = 42) for the course — use cases, tool disclosure gaps, and design recommendations for ELEE 3270',
    ],
    tags: ['SPICE', 'Analog circuits', 'Lab instruments', 'Course design'],
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
      'Tutored 35+ students in Logic Design (CSEE 2220) and Circuit Analysis (ECSE 2170), focusing on exam-ready problem sets',
    ],
    tags: ['Logic design', 'Circuit analysis'],
  },
];

export const skills = [
  {
    group: 'Languages',
    items: ['C', 'C++', 'Python'],
  },
  {
    group: 'Architectures & interfaces',
    items: ['ARM Cortex-M (STM32)', 'AVR (ATmega)', 'Raspberry Pi', 'SPI', 'I²C', 'UART', 'PWM'],
  },
  {
    group: 'Firmware & toolchains',
    items: ['Bare-metal C', 'F´', 'Zephyr RTOS', 'Renode', 'arm-none-eabi-gcc', 'OpenOCD', 'Make / CMake', 'Git'],
  },
  {
    group: 'Hardware & equipment',
    items: [
      'KiCad',
      'Autodesk Fusion',
      'SPICE',
      'Oscilloscopes',
      'Logic analyzers',
      'Multimeters',
      'Soldering',
    ],
  },
];
