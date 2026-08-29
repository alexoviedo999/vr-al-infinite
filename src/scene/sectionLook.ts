import type { SectionName } from '../rail/musicMap';

/** Fog / clear color per section — cold intro, saturated drop, dim breakdown. */
export const SECTION_FOG: Record<SectionName, string> = {
  intro: '#00080e',
  build: '#00141c',
  drop: '#001c28',
  breakdown: '#00060a',
  outro: '#000005',
};

/** Neon wireframe hue per section. */
export const SECTION_NEON: Record<SectionName, string> = {
  intro: '#4aa0c8',
  build: '#5fd0ff',
  drop: '#8af4ff',
  breakdown: '#3a7088',
  outro: '#2a5060',
};
