import { describe, expect, it } from 'vitest';
import { devCacheNames, isStaleDevCache } from './devCaches';

describe('dev service worker caches', () => {
  it('names image, font and html caches after the core version', () => {
    expect(devCacheNames('1.2.3')).toEqual({
      images: 'shellui-dev-images-1.2.3',
      fonts: 'shellui-dev-fonts-1.2.3',
      html: 'shellui-dev-html-1.2.3',
    });
  });

  it('has no cache for scripts or styles', () => {
    expect(Object.keys(devCacheNames('1.2.3'))).not.toContain('static-resources');
  });

  it('drops unversioned caches and caches from another version', () => {
    for (const name of ['images', 'html-cache', 'static-resources', 'fonts']) {
      expect(isStaleDevCache(name, '1.2.3')).toBe(true);
    }
    expect(isStaleDevCache('shellui-dev-images-1.2.2', '1.2.3')).toBe(true);
    expect(isStaleDevCache('shellui-dev-static-1.2.3', '1.2.3')).toBe(true);
  });

  it('keeps current caches and caches it does not own', () => {
    for (const name of Object.values(devCacheNames('1.2.3'))) {
      expect(isStaleDevCache(name, '1.2.3')).toBe(false);
    }
    expect(isStaleDevCache('workbox-precache-v2-http://localhost/', '1.2.3')).toBe(false);
    expect(isStaleDevCache('api-cache', '1.2.3')).toBe(false);
  });
});
