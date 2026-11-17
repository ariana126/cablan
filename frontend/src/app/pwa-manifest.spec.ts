/// <reference types="node" />
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// The app is installable on a phone from a manifest alone — there is no service worker, so
// nothing can serve a stale build. These specs read the real files `angular.json`'s `public`
// glob copies to the build root; `npm test` runs from the project root.
const projectFile = (...segments: string[]): string => join(process.cwd(), ...segments);

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose: string;
}

const manifest = JSON.parse(readFileSync(projectFile('public', 'manifest.webmanifest'), 'utf8'));

describe('the web app manifest', () => {
  it('names the app «کابلان» in Persian, right to left', () => {
    expect(manifest.name).toBe('کابلان');
    expect(manifest.short_name).toBe('کابلان');
    expect(manifest.lang).toBe('fa');
    expect(manifest.dir).toBe('rtl');
  });

  it('opens the whole site in a standalone window', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('takes its colours from the light surface token', () => {
    expect(manifest.theme_color).toBe('#fcf9f4');
    expect(manifest.background_color).toBe('#fcf9f4');
  });

  it.each<ManifestIcon>([
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    {
      src: 'icons/icon-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',
    },
  ])('declares $src for purpose $purpose', (icon) => {
    expect(manifest.icons).toContainEqual(icon);
  });

  it('points every icon at a PNG of exactly the size it declares', () => {
    for (const icon of manifest.icons as ManifestIcon[]) {
      const path = projectFile('public', icon.src);
      expect(existsSync(path), `${icon.src} exists`).toBe(true);

      // A PNG's IHDR chunk holds width and height as two big-endian uint32s at bytes 16–23.
      const header = readFileSync(path);
      const size = `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`;
      expect(size, `${icon.src} size`).toBe(icon.sizes);
    }
  });
});

describe('index.html', () => {
  const page = new DOMParser().parseFromString(
    readFileSync(projectFile('src', 'index.html'), 'utf8'),
    'text/html',
  );

  it('links the manifest with credentials, so it reaches staging behind the login gateway', () => {
    const link = page.querySelector('link[rel=manifest]');
    expect(link?.getAttribute('href')).toBe('manifest.webmanifest');
    expect(link?.getAttribute('crossorigin')).toBe('use-credentials');
  });

  it('colours the browser chrome per colour scheme', () => {
    const colours = [...page.querySelectorAll('meta[name=theme-color]')].map((meta) => [
      meta.getAttribute('media'),
      meta.getAttribute('content'),
    ]);
    expect(colours).toEqual([
      ['(prefers-color-scheme: light)', '#fcf9f4'],
      ['(prefers-color-scheme: dark)', '#15130f'],
    ]);
  });

  it('gives iOS an icon, a standalone mode and a name', () => {
    expect(page.querySelector('link[rel=apple-touch-icon]')?.getAttribute('href')).toBe(
      'icons/apple-touch-icon.png',
    );
    expect(page.querySelector('meta[name=mobile-web-app-capable]')?.getAttribute('content')).toBe(
      'yes',
    );
    expect(
      page.querySelector('meta[name=apple-mobile-web-app-capable]')?.getAttribute('content'),
    ).toBe('yes');
    expect(
      page.querySelector('meta[name=apple-mobile-web-app-title]')?.getAttribute('content'),
    ).toBe('کابلان');
  });
});
