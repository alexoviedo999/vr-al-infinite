import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..');
const TRACK_DIR = resolve(REPO_ROOT, 'assets', 'demo-tracks');

const TRACKS = [
  { name: 'adonis-enter-one.aiff', size: 84495290, source: 'Adonis FR - Enter One (Original Mix).aiff' },
  { name: 'dj-deep-stressed.aiff', size: 51590850, source: 'DJ Deep - Stressed (Original Mix).aiff' },
] as const;

/**
 * Static-asset loading test for #3. Verifies the demo tracks are
 * correctly staged in `assets/demo-tracks/` — the symlinks resolve,
 * the targets are valid AIFF files, and the on-disk sizes match what
 * `assets/demo-tracks/README.md` advertises. The "reachable from the
 * built bundle" half of the acceptance is covered by `npm run build`
 * + `npm run preview` (Vite copies public/ into dist/ at build time).
 */
describe('assets/demo-tracks', () => {
  for (const track of TRACKS) {
    describe(track.name, () => {
      const path = resolve(TRACK_DIR, track.name);

      it('symlink resolves', () => {
        const stats = statSync(path);
        expect(stats.isFile()).toBe(true);
        expect(stats.size).toBe(track.size);
      });

      it('is a valid AIFF file', () => {
        const fd = readFileSync(path, { flag: 'r' });
        // AIFF container magic: 'FORM' (big-endian 4-byte chunk header)
        expect(fd.subarray(0, 4).toString('ascii')).toBe('FORM');
      });
    });
  }

  it('README documents the tracks', () => {
    const readme = readFileSync(resolve(TRACK_DIR, 'README.md'), 'utf8');
    for (const track of TRACKS) {
      expect(readme).toContain(track.name);
      expect(readme).toContain(track.source);
    }
  });

  it('public/demo-tracks symlink exposes them to Vite', () => {
    // vite.config.ts relies on `public/demo-tracks` resolving so the
    // built bundle copies the AIFFs into dist/demo-tracks/.
    const pub = resolve(REPO_ROOT, 'public', 'demo-tracks');
    expect(() => statSync(pub).isDirectory()).not.toThrow();
  });
});
