import { htmlToPlainText } from './htmlText';
import { CoolapkTauriAPI } from '../api/coolapk';
import { MAX_DIAGNOSTIC_IMAGE_BYTES, unpackDiagnosticImage } from './diagnosticImage';

export function normalizeDiagnosticImageUrl(value: string): string {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.hostname !== 'image.coolapk.com'
    || url.username || url.password || !/^\/feed\/.*\.(?:png|zip)$/i.test(url.pathname) || url.search || url.hash) {
    throw new Error('请填写酷安诊断日志的 PNG 原图或 ZIP 附件地址');
  }
  url.protocol = 'https:';
  return url.href;
}

export function getDiagnosticLink(text: string): string {
  const value = htmlToPlainText(text).match(/诊断日志(?:图片|附件)：\s*(https?:\/\/[^\s<>"']+)/)?.[1];
  if (!value) return '';
  try { return normalizeDiagnosticImageUrl(value); } catch { return ''; }
}

async function downloadDiagnosticImage(value: string): Promise<Uint8Array> {
  const url = normalizeDiagnosticImageUrl(value);
  const dataUrl = await CoolapkTauriAPI.getImageDataUrl(url);
  const match = dataUrl.match(/^data:(?:image\/png|application\/(?:zip|x-zip-compressed|octet-stream));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || match[1]!.length > Math.ceil(MAX_DIAGNOSTIC_IMAGE_BYTES / 3) * 4) throw new Error('下载内容不是有效日志附件，或超过 2 MB');
  return Uint8Array.from(atob(match[1]!), character => character.charCodeAt(0));
}

export async function readDiagnosticImageUrl(value: string) {
  return unpackDiagnosticImage(await downloadDiagnosticImage(value));
}
