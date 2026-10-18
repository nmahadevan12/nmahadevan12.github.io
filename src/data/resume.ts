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
  honors: ['Zell Miller Scholar', 'UGA Dean’s List', 'UGA IEEE MicroMouse', 'Eagle Scout (2022)', 'UGA Outdoor Club'],
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
      'Developing flight software in C under Zephyr RTOS on an STM32 MCU for CubeSat communications and command handling',
      'Implementing serial drivers and communication protocols (UART, RS-485) between onboard satellite subsystems',
      'Validating multi-subsystem firmware and bus protocols with Renode hardware emulation before bench testing',
    ],
    tags: ['C', 'Zephyr RTOS', 'STM32', 'UART', 'RS-485', 'Renode'],
  },
  {
    id: 'vip',
    role: 'Embedded Systems Research Intern',
    org: 'UGA Vertically Integrated Projects for Research',
    channel: 'Embedded research',
    orgShort: 'UGA VIPR',
    start: '2026-08',
    points: [
      'Writing C++ drivers (I²C, SPI) for IMU, temperature, and humidity sensors on an ATmega328P-based wearable heat-stress tracker for canines',
      'Implementing Bluetooth communication to stream sensor data to a host application in real time',
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
      'Instructing 100+ students across two labs on analog filters, oscillators, transformers, and BJT amplifiers with SPICE verification',
      'Guiding TTL circuit builds and benchtop debugging with oscilloscopes, logic analyzers, and multimeters',
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
    points: ['Tutored 35+ students, mainly in Logic Design (CSEE 2220) and Circuit Analysis (ECSE 2170)'],
    tags: ['Logic design', 'Circuit analysis'],
  },
];

export const skills = [
  {
    group: 'Languages',
    items: ['C', 'C++', 'ARM Assembly', 'Python', 'Java', 'MATLAB'],
  },
  {
    group: 'Architectures & interfaces',
    items: ['ARM Cortex-M (STM32)', 'AVR (ATmega)', 'ESP32', 'Raspberry Pi', 'SPI', 'I²C', 'UART', 'PWM'],
  },
  {
    group: 'Firmware & toolchains',
    items: ['Bare-metal C', 'Zephyr RTOS', 'Renode', 'arm-none-eabi-gcc', 'OpenOCD', 'Make / CMake', 'Git'],
  },
  {
    group: 'Hardware & equipment',
    items: [
      'KiCad',
      'Altium Designer',
      'Autodesk Fusion',
      'SPICE',
      'Oscilloscopes',
      'Logic analyzers',
      'Multimeters',
      'Soldering',
    ],
  },
];
