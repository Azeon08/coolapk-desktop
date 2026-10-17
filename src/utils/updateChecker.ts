import { APP_VERSION } from '../constants/version';
import type { UpdateChannel } from '../types/settings';
import { getPlatformInfo, type PlatformInfo } from './platform';

export { APP_VERSION };
const UPDATE_REPOSITORY = 'coolapk-desktop/coolapk-desktop';
type ReleaseCandidate = { release: any; repository: string };

async function fetchReleaseJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/vnd.github.v3+json' }, signal: controller.signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export type UpdateInfo = {
  hasNew: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  publishedAt?: string;
  downloadUrl?: string;
  installerUrl?: string;
  installerName?: string;
  packageType?: UpdatePackageType;
};

export type UpdatePackageType = 'installer' | 'portable' | 'deb' | 'rpm' | 'unsupported';

export function isUpdatePackageType(value: unknown): value is UpdatePackageType {
  return typeof value === 'string' && ['installer', 'portable', 'deb', 'rpm', 'unsupported'].includes(value);
}

export type InstallerAsset = {
  name?: string;
  browser_download_url?: string;
};

export function isUpdateAssetCompatible(
  name: string,
  platform: PlatformInfo,
  packageType: UpdatePackageType
): boolean {
  if (platform.os === 'macos' || platform.os === 'linux') {
    if (!versionFromAssetName(name) || !/^coolapk-desktop[-_]/i.test(name)) return false;
    const archPattern = platform.arch === 'aarch64'
      ? /(?:^|[-_.])(?:arm64|aarch64)(?=[-_.]|$)/i
      : platform.arch === 'x86_64'
        ? /(?:^|[-_.])(?:x64|amd64|x86_64)(?=[-_.]|$)/i
        : null;
    if (!archPattern?.test(name)) return false;
    if (platform.os === 'macos') return packageType === 'installer' && /\.dmg$/i.test(name);
    if (packageType === 'portable') return /\.AppImage$/i.test(name);
    return (packageType === 'deb' && /\.deb$/i.test(name))
      || (packageType === 'rpm' && /\.rpm$/i.test(name));
  }
  if (platform.os === 'android') {
    return packageType === 'installer'
      && platform.arch === 'aarch64'
      && /^coolapk-v?.+-android-arm64(?:-\d+-\d+)?\.apk$/i.test(name)
      && Boolean(versionFromAssetName(name));
  }
  if (platform.os !== 'windows') return false;
  // 线性拆分名称，避免可重叠重复分组在长文件名上产生大量回溯。
  if (!name.toLowerCase().endsWith('.exe')) return false;
  const parts = name.slice(0, -4).toLowerCase().split(/[-_]/);
  const index = parts.lastIndexOf(packageType === 'portable' ? 'portable' : 'setup');
  if (index <= 0 || parts.slice(index + 1).some(part => part.includes('.')) || parts[parts.length - 1] === '') return false;
  const archPattern = platform.arch === 'aarch64'
    ? /(?:^|[-_])(?:arm64|aarch64)(?=[-_.]|$)/i
    : platform.arch === 'x86_64'
      ? /(?:^|[-_])(?:x64|amd64)(?=[-_.]|$)/i
      : null;
  return Boolean(archPattern?.test(name));
}

export function selectInstallerAsset(
  assets: InstallerAsset[],
  platform: PlatformInfo
): InstallerAsset | undefined {
  if (platform.os === 'macos' || platform.os === 'android') {
    return assets.find((asset) => asset.name && asset.browser_download_url
      && isUpdateAssetCompatible(asset.name, platform, 'installer'));
  }
  if (platform.os !== 'windows') return undefined;
  const candidates = assets.filter(
    (asset) => asset.name && /[-_]setup\.exe$/i.test(asset.name) && asset.browser_download_url
  );
  const archPattern = platform.arch === 'aarch64'
    ? /(?:^|[-_])(?:arm64|aarch64)(?=[-_.]|$)/i
    : platform.arch === 'x86_64'
      ? /(?:^|[-_])(?:x64|amd64)(?=[-_.]|$)/i
      : null;
  if (!archPattern) return undefined;
  const exact = candidates.find((asset) => archPattern.test(asset.name || ''));
  if (exact) return exact;
  const hasExplicitArch = candidates.some((asset) =>
    /(?:^|[-_])(?:x64|amd64|arm64|aarch64)(?=[-_.]|$)/i.test(asset.name || '')
  );
  return hasExplicitArch ? undefined : candidates[0];
}

export function selectPortableAsset(
  assets: InstallerAsset[],
  platform: PlatformInfo
): InstallerAsset | undefined {
  if (platform.os === 'linux') {
    return assets.find((asset) => asset.name && asset.browser_download_url
      && isUpdateAssetCompatible(asset.name, platform, 'portable'));
  }
  if (platform.os !== 'windows') return undefined;
  const candidates = assets.filter(
    (asset) => asset.name && /[-_]portable\.exe$/i.test(asset.name) && asset.browser_download_url
  );
  const archPattern = platform.arch === 'aarch64'
    ? /(?:^|[-_])(?:arm64|aarch64)(?=[-_.]|$)/i
    : platform.arch === 'x86_64'
      ? /(?:^|[-_])(?:x64|amd64)(?=[-_.]|$)/i
      : null;
  if (!archPattern) return undefined;
  return candidates.find((asset) => archPattern.test(asset.name || ''));
}

export function isNewerVersion(latest: string, current = APP_VERSION) {
  const latestVersion = parseVersion(latest);
  const currentVersion = parseVersion(current);
  return Boolean(latestVersion && currentVersion && compareVersions(latestVersion, currentVersion) > 0);
}

export function shouldReplaceDownloadedUpdate(
  downloadedVersion: string,
  latestVersion: string,
  hasCompatibleAsset: boolean
): boolean {
  return hasCompatibleAsset && isNewerVersion(latestVersion, downloadedVersion);
}

type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
};

function parseVersion(value: unknown): ParsedVersion | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/i);
  if (!match) return null;
  const parts = [match[1], match[2], match[3]].map(Number);
  if (parts.some((part) => !Number.isSafeInteger(part))) return null;
  return {
    major: parts[0],
    minor: parts[1],
    patch: parts[2],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (left[key] !== right[key]) return left[key] > right[key] ? 1 : -1;
  }
  if (left.prerelease.length === 0 && right.prerelease.length > 0) return 1;
  if (left.prerelease.length > 0 && right.prerelease.length === 0) return -1;
  for (let index = 0; index < Math.max(left.prerelease.length, right.prerelease.length); index += 1) {
    const leftPart = left.prerelease[index];
    const rightPart = right.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber > rightNumber ? 1 : -1;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export function normalizeVersion(value: string): string | null {
  const parsed = parseVersion(value);
  if (!parsed) return null;
  const suffix = parsed.prerelease.length ? `-${parsed.prerelease.join('.')}` : '';
  return `${parsed.major}.${parsed.minor}.${parsed.patch}${suffix}`;
}

export function isVersionAllowedInChannel(version: string, channel: UpdateChannel): boolean {
  const parsed = parseVersion(version);
  return Boolean(parsed && (channel === 'beta' || parsed.prerelease.length === 0));
}

async function pickRelease(channel: UpdateChannel, platform: PlatformInfo, packageType: UpdatePackageType): Promise<ReleaseCandidate> {
  const base = `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases`;
  const requests = channel === 'beta' ? [`${base}?per_page=100`, `${base}/latest`] : [`${base}/latest`];
  const responses = await Promise.allSettled(requests.map(fetchReleaseJson));
  const releases: any[] = [];
  responses.forEach((response, index) => {
    if (response.status !== 'fulfilled' || !response.value) return;
    if (channel === 'beta' && index === 0) {
      if (Array.isArray(response.value)) releases.push(...response.value);
    } else releases.push(response.value);
  });
  const candidates = releases.map((release) => ({ release, repository: UPDATE_REPOSITORY }))
    .filter(({ release }) => release && !release.draft && normalizeVersion(release.tag_name)
      && (channel === 'stable' ? !release.prerelease && isVersionAllowedInChannel(release.tag_name, 'stable')
        : !release.prerelease || /^v?\d+\.\d+\.\d+-beta\.[1-9]\d*$/.test(release.tag_name)));
  candidates.sort((a, b) => isNewerVersion(a.release.tag_name, b.release.tag_name) ? -1
    : isNewerVersion(b.release.tag_name, a.release.tag_name) ? 1 : 0);
  if (!candidates.length) throw new Error('未从 GitHub 获取到可用的发布版本');
  // 优先可安装的新版本；没有兼容更新包时仍显示最新发布的信息。
  return candidates.find(({ release }) => (channel === 'beta' || isNewerVersion(release.tag_name))
    && selectReleaseAsset(release, platform, packageType)) || candidates[0];
}

export function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$/.test(dateStr)) return dateStr;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d} ${hh}:${mm}`;
  } catch {
    return dateStr;
  }
}

export function getCurrentVersionChangelog(version = APP_VERSION, remoteBody?: string): string {
  const cleanRemote = (remoteBody || '').trim();
  if (cleanRemote) {
    return cleanRemote;
  }
  return '暂无当前版本的更新日志。';
}

function selectReleaseAsset(release: any, currentPlatform: PlatformInfo, packageType: UpdatePackageType): InstallerAsset | undefined {
  const tagName = release.tag_name || '';
  // 按平台、发行方式、架构和 release 版本选择更新包。
  const assets: InstallerAsset[] = release.assets || [];
  const candidates = assets.filter((asset) => {
    if (!asset.name || !asset.browser_download_url) return false;
    if (currentPlatform.os === 'macos' || currentPlatform.os === 'linux') {
      return isUpdateAssetCompatible(asset.name, currentPlatform, packageType);
    }
    if (currentPlatform.os === 'android') {
      return packageType === 'installer' && /-android-arm64\.apk$/i.test(asset.name);
    }
    return packageType === 'portable'
      ? /[-_]portable\.exe$/i.test(asset.name)
      : /[-_]setup\.exe$/i.test(asset.name);
  });
  const tagVersion = normalizeVersion(tagName);
  const versionedCandidates = candidates.filter((asset) => Boolean(asset.name && versionFromAssetName(asset.name)));
  const versionMatched = candidates.filter(
    (asset) => Boolean(asset.name && tagVersion && versionFromAssetName(asset.name) === tagVersion)
  );
  // 如果资源名明确带版本号但与 release 不一致，禁止误下载旧安装包；
  // 只有资源名完全不含版本号时才允许兼容旧发布格式。
  const validCandidates = versionMatched.length > 0
    ? versionMatched
    : versionedCandidates.length > 0
      ? []
      : candidates;

  const selectedAsset = (packageType === 'deb' || packageType === 'rpm'
    ? validCandidates[0]
    : packageType === 'portable'
    ? selectPortableAsset(validCandidates, currentPlatform)
    : selectInstallerAsset(validCandidates, currentPlatform));
  return selectedAsset;

}

export async function checkLatestRelease(
  channel: UpdateChannel = 'stable',
  platform?: PlatformInfo,
  packageType: UpdatePackageType = 'installer'
): Promise<UpdateInfo> {
  const currentPlatform = platform ?? await getPlatformInfo();
  const { release, repository } = await pickRelease(channel, currentPlatform, packageType);
  const tagName = release.tag_name || '';
  const hasNew = Boolean(normalizeVersion(tagName)) && isNewerVersion(tagName);

  const selectedAsset = selectReleaseAsset(release, currentPlatform, packageType);
  const installerUrl = selectedAsset?.browser_download_url;

  // 渠道最新版本可能比已安装版本旧，此时日志、日期和链接必须读取当前安装版本。
  let notesRelease = release;
  let notesRepository = repository;
  if (!hasNew && normalizeVersion(tagName) !== normalizeVersion(APP_VERSION)) {
    notesRelease = null;
    const currentRelease = await fetchReleaseJson(
      `https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/tags/v${encodeURIComponent(APP_VERSION)}`,
    ).catch(() => null);
    if (currentRelease && !currentRelease.draft && normalizeVersion(currentRelease.tag_name) === normalizeVersion(APP_VERSION)) {
      notesRelease = currentRelease;
      notesRepository = UPDATE_REPOSITORY;
    }
  }
  const releaseNotes = hasNew
    ? (release.body ? release.body.trim() : '暂无特别更新说明')
    : getCurrentVersionChangelog(APP_VERSION, notesRelease?.body);

  const publishedAt = notesRelease?.published_at ? formatReleaseDate(notesRelease.published_at) : undefined;

  return {
    hasNew,
    latestVersion: tagName || '最新发布',
    releaseNotes,
    publishedAt,
    downloadUrl: notesRelease?.html_url || `https://github.com/${notesRepository}/releases`,
    installerUrl,
    installerName: selectedAsset?.name,
    packageType,
  };
}

export function versionFromAssetName(name: string) {
  const desktopMatch = name.match(/^coolapk-desktop[_-](v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:_(?:x64|amd64|x86_64|arm64|aarch64)|-\d+\.(?:x86_64|aarch64))/i);
  if (desktopMatch) return normalizeVersion(desktopMatch[1]) || undefined;
  const androidMatch = name.match(/^coolapk-(v?.+)-android-(?:arm64|aarch64)(?:-\d+-\d+)?\.apk$/i);
  if (androidMatch) return normalizeVersion(androidMatch[1]) || undefined;
  const match = name.match(/(?:^|[-_])v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?=[-_]|$)/i);
  return match ? normalizeVersion(match[1]) : undefined;
}
