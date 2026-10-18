// Usage: npm run new -- "Project Title"
// Creates src/content/projects/<slug>/index.md as a draft you can fill in.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: npm run new -- "Project Title"');
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const dir = join('src', 'content', 'projects', slug);
if (existsSync(dir)) {
  console.error(`A project already exists at ${dir}`);
  process.exit(1);
}

const month = new Date().toISOString().slice(0, 7);

const template = `---
title: ${JSON.stringify(title)}
# channel: Short name for the home page capture
summary: One or two sentences on what you built and why it's interesting.
status: in-progress # in-progress | completed | planned
areas: [embedded] # any of: embedded, hardware, architecture, signal, software
start: ${month}
# end: ${month}
# course: ECSE 0000
# role: Solo project
# platform: STM32F103C8 (ARM Cortex-M3)
tags: []
highlights: []
featured: false
draft: true # visible in \`npm run dev\` only; set to false to publish
# cover: ./cover.jpg
# coverAlt: What the cover image shows
# coverCaption: Shown under the cover on the project page
# coverFit: contain # keeps plots and screenshots uncropped on cards
# gallery:
#   - src: ./photo.jpg
#     caption: What this photo shows
# repo: https://github.com/nmahadevan12/your-repo
# video: https://youtu.be/your-video
---

## Overview

What problem does this solve, and what did you build?

## How it works

## Results

## Next steps
`;

await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'index.md'), template);
console.log(`Created ${join(dir, 'index.md')}`);
console.log('Drop images into the same folder and reference them as ./image.jpg');
