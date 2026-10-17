import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkLatestRelease } from '../updateChecker';

vi.mock('../../constants/version', () => ({ APP_VERSION: '1.35.0-beta.4' }));

describe('已安装测试版的当前版本日志', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(['windows', 'android', 'ios'] as const)('%s 在稳定渠道读取已安装测试版日志和日期', async (os) => {
    const currentRelease = { tag_name: 'v1.35.0-beta.4', prerelease: true, body: '测试版更新日志', published_at: '2026-10-14T12:00:00Z', html_url: 'https://example.com/beta' };
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({ ok: true, json: async () => String(url).endsWith('/latest')
      ? { tag_name: 'v1.34.1', body: '旧版日志', published_at: '2026-10-13T12:00:00Z' } : currentRelease } as Response));

    const result = await checkLatestRelease('stable', { os, arch: 'aarch64' });
    expect(result.hasNew).toBe(false);
    expect(result.releaseNotes).toBe('测试版更新日志');
    expect(result.publishedAt).toMatch(/^2026-10-14 /);
    expect(result.downloadUrl).toBe(currentRelease.html_url);
    expect(fetch.mock.calls.filter(([url]) => String(url).includes('/tags/')).map(([url]) => url)).toEqual([
      'https://api.github.com/repos/coolapk-desktop/coolapk-desktop/releases/tags/v1.35.0-beta.4',
    ]);
  });

  it.each(['missing', 'error', 'wrong-version', 'draft'])('当前 Release 为 %s 时不展示旧版日志或日期', async (mode) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/latest')) return { ok: true, json: async () => ({ tag_name: 'v1.34.1', body: '旧版日志', published_at: '2026-10-13T12:00:00Z' }) } as Response;
      if (mode === 'error') throw new Error('网络不可用');
      return { ok: mode !== 'missing', json: async () => ({ tag_name: mode === 'wrong-version' ? 'v1.34.1' : 'v1.35.0-beta.4', draft: mode === 'draft', body: '不应展示' }) } as Response;
    });

    const result = await checkLatestRelease('stable', { os: 'android', arch: 'aarch64' });
    expect(result.hasNew).toBe(false);
    expect(result.releaseNotes).toBe('暂无当前版本的更新日志。');
    expect(result.publishedAt).toBeUndefined();
    expect(result.installerUrl).toBeUndefined();
  });
});
