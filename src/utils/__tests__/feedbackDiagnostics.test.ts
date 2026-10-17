import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getImageDataUrl: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: mocks }));

import { getDiagnosticLink, normalizeDiagnosticImageUrl, readDiagnosticImageUrl } from '../feedbackDiagnostics';
import { packDiagnosticImage } from '../diagnosticImage';

describe('诊断日志附件读取', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it('只接受酷安图片域名下的原图 PNG 或 ZIP 链接', () => {
    expect(normalizeDiagnosticImageUrl('http://image.coolapk.com/feed/2026/test.png')).toBe('https://image.coolapk.com/feed/2026/test.png');
    expect(normalizeDiagnosticImageUrl('https://image.coolapk.com/feed/2026/test.zip')).toBe('https://image.coolapk.com/feed/2026/test.zip');
    for (const url of [
      'https://evil.com/feed/test.png',
      'https://image.coolapk.com.evil.com/feed/test.png',
      'https://user:pass@image.coolapk.com/feed/test.png',
      'https://image.coolapk.com/feed/test.png.m.jpg',
      'https://image.coolapk.com/feed/test.png?token=secret',
    ]) {
      expect(() => normalizeDiagnosticImageUrl(url)).toThrow();
    }
  });

  it('识别旧版私信中的诊断图片与 ZIP 附件链接', () => {
    expect(getDiagnosticLink('反馈\n- 诊断日志图片：http://image.coolapk.com/feed/test.png\n操作步骤')).toBe('https://image.coolapk.com/feed/test.png');
    expect(getDiagnosticLink('诊断日志附件：https://image.coolapk.com/feed/test.zip')).toBe('https://image.coolapk.com/feed/test.zip');
    expect(getDiagnosticLink('https://image.coolapk.com/feed/test.png')).toBe('');
    expect(getDiagnosticLink('诊断日志图片：<a href="https://image.coolapk.com/feed/test.png">https://image.coolapk.com/feed/test.png</a>')).toBe('https://image.coolapk.com/feed/test.png');
  });

  it('通过原生网络读取原图并校验诊断报告', async () => {
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='), c => c.charCodeAt(0));
    const packed = packDiagnosticImage(png, { version: '1.28.0', platform: 'Android', createdAt: '2026-10-01', log: 'test log' });
    mocks.getImageDataUrl.mockResolvedValue(`data:image/png;base64,${btoa(String.fromCharCode(...packed))}`);
    expect((await readDiagnosticImageUrl('http://image.coolapk.com/feed/test.png')).log).toBe('test log');
    expect(mocks.getImageDataUrl).toHaveBeenCalledWith('https://image.coolapk.com/feed/test.png');
  });

  it('拒绝不是 PNG/ZIP 数据或超过大小上限的下载结果', async () => {
    mocks.getImageDataUrl.mockResolvedValue('data:text/plain;base64,YWJj');
    await expect(readDiagnosticImageUrl('https://image.coolapk.com/feed/test.png')).rejects.toThrow('不是有效日志附件');

    mocks.getImageDataUrl.mockResolvedValue(`data:image/png;base64,${'A'.repeat(2_800_000)}`);
    await expect(readDiagnosticImageUrl('https://image.coolapk.com/feed/test.png')).rejects.toThrow('超过 2 MB');
  });
});
