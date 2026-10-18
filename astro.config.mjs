// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Your public URL. With a GitHub repo named `nmahadevan12.github.io`, no `base` is needed.
  site: 'https://nmahadevan12.github.io',
  // Keep normal HTML whitespace rules so inline text and links don't run together.
  compressHTML: true,
});
