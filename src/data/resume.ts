export const education = {
  school: 'University of Georgia',
  location: 'Athens, GA',
  degrees: [
    'B.S. Electrical and Electronics Engineering',
    'B.S. Computer Systems Engineering',
  ],
  start: '2024-08',
  end: '2028-05',
  gpa: '3.93',
  coursework: [],
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
      'Developing CubeSat flight software in C++ and NASA F Prime, with Zephyr drivers in C on STM32, for a ~15-person software team',
      'Reimplemented the legacy 7-state flight state machine with voltage debounce, request prioritization, and safe-shutdown sequencing',
      'Refactored the legacy file-recycler into thread-safe C++ with path abstractions and safer symlink handling',
      'Writing unit tests for the state machine and file recycler to catch bugs before system integration',
      'Reviewing teammates\' flight software changes and building UART/RS-485 Zephyr drivers, validated in Renode',
    ],
    tags: ['C', 'C++', 'NASA F Prime', 'Zephyr RTOS', 'STM32', 'UART', 'RS-485'],
  },
  {
    id: 'vip',
    role: 'Embedded Systems Research Intern',
    org: 'University of Georgia',
    channel: 'Embedded research',
    orgShort: 'UGA VIPR',
    start: '2026-08',
    points: [
      'Writing C++ drivers (I2C, SPI) to read IMU, temperature, and humidity sensors on an ATmega328P canine health monitor',
      'Streaming structured multi-sensor packets to a host application in real time over HC-05 Bluetooth via hardware UART',
    ],
    tags: ['C++', 'ATmega328P', 'I2C', 'SPI', 'UART', 'Bluetooth'],
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
    items: ['C', 'C++', 'Python', 'ARM Assembly', 'MATLAB', 'Java'],
  },
  {
    group: 'Embedded Systems',
    items: [
      'ARM Cortex-M4 (STM32)',
      'ARM Cortex-A53 (BCM2837, Raspberry Pi)',
      'ATmega328P',
      'ESP32',
    ],
  },
  {
    group: 'Firmware & Protocols',
    items: ['Zephyr RTOS', 'NASA F Prime', 'UART', 'SPI', 'I2C', 'PWM'],
  },
  {
    group: 'Hardware & Tools',
    items: [
      'KiCad',
      'Altium Designer',
      'SPICE',
      'Fusion 360',
      'Oscilloscopes',
      'Logic Analyzers',
      'Multimeters',
      'Soldering',
      'Renode',
      'Git'
    ],
  },
];