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
  ],
  honors: ['Eagle Scout', 'UGA Dean’s List'],
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
      'Developing CubeSat flight software integrating C++ active components in NASA F´ with low-level C device drivers under Zephyr RTOS on an STM32 MCU',
      'Implemented an on-board computer 7-state mode controller in C++ featuring 10-tick voltage debounce, request priority arbitration, and fault-tolerant safe shutdown sequencing',
      'Refactored the legacy file-recycler service — replaced raw strings with path abstractions, resolved symlink traversal issues, and enforced thread-safe mutex synchronization so the change builds cleanly',
      'Implementing UART and RS-485 serial drivers in C via the Zephyr device driver model for multi-node telemetry routing, validating integration in Renode',
    ],
    tags: ['C', 'C++', 'F´', 'Zephyr RTOS', 'STM32', 'UART', 'RS-485'],
  },
  {
    id: 'vip',
    role: 'Embedded Systems Research Intern',
    org: 'UGA Vertically Integrated Projects for Research',
    channel: 'Embedded research',
    orgShort: 'UGA VIPR',
    start: '2026-08',
    points: [
      'Developing C++ drivers across I²C and SPI to acquire real-time IMU, ambient temperature, and relative humidity telemetry on an ATmega328P-based canine health monitor',
      'Implementing serial communication via an HC-05 Bluetooth module using hardware UART to stream structured multi-sensor data packets to a host application in real time',
    ],
    tags: ['C++', 'ATmega328P', 'I²C', 'SPI', 'UART', 'Bluetooth'],
  },
  {
    id: 'ece-lab',
    role: 'Electronics Lab Assistant',
    org: 'UGA School of Electrical & Computer Engineering',
    channel: 'Lab assistant',
    orgShort: 'UGA ECE',
    start: '2026-08',
    points: [
      'Instructing 100+ students across two labs on analog filters, oscillators, transformers, and BJT amplifiers with SPICE verification',
      'Guiding students through TTL circuit builds and benchtop debugging with oscilloscopes, logic analyzers, and multimeters',
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
    items: ['C', 'C++', 'ARM Assembly', 'Python', 'Java', 'MATLAB'],
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
