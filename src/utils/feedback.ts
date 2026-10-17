import { APP_VERSION } from '../constants/version';

export const GITHUB_ISSUES_URL = 'https://github.com/coolapk-desktop/coolapk-desktop/issues';

export function createFeedbackIssueUrl(): string {
  const url = new URL(`${GITHUB_ISSUES_URL}/new`);
  url.searchParams.set('title', `酷安客户端问题反馈 v${APP_VERSION}`);
  url.searchParams.set('body', getFeedbackTemplate());
  return url.toString();
}

export function getFeedbackTemplate(): string {
  let osName = 'Windows';
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent;
    // Android UA 同时包含 Linux，必须先识别 Android。
    if (/android/i.test(ua)) {
      osName = 'Android';
    } else if (/iphone|ipad|ipod/i.test(ua)
      || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) {
      // iOS UA 包含 Mac OS；iPad 桌面模式会使用 Macintosh UA。
      osName = 'iOS';
    } else if (ua.includes('Macintosh') || ua.includes('Mac OS')) {
      osName = 'macOS';
    } else if (ua.includes('Linux')) {
      osName = 'Linux';
    } else if (ua.includes('Windows')) {
      osName = 'Windows';
    }
  }

  return `【酷安客户端问题反馈】
- 客户端版本：v${APP_VERSION}
- 操作系统：${osName}
- 问题描述：
- 复现步骤：`;
}
