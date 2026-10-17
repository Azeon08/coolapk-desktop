import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

// 易盾 SDK 使用 new Function 编译模板；jsdom 不执行 CSP，需在真实浏览器中回归。
const csp = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
const baseline = csp.replace(/\s+'unsafe-eval'/g, '');
assert.notEqual(csp, baseline, '易盾模板编译需要 script-src 的 unsafe-eval');
const browser = process.env.LAYOUT_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
assert.ok(existsSync(browser), '请通过 LAYOUT_BROWSER 指定 Chromium 浏览器路径');
const artifacts = mkdtempSync(join(tmpdir(), 'coolapk-captcha-csp-'));
writeFileSync(join(artifacts, 'probe.js'), `
const violations = [];
document.addEventListener('securitypolicyviolation', event => violations.push(event.blockedURI));
let templateResult = null;
try {
  templateResult = new Function('obj', "with(obj){return '验证码：'+label;}")({ label: '可用' });
} catch { /* 基线应被 CSP 拦截 */ }
const inline = document.createElement('script');
inline.textContent = 'window.untrustedInlineExecuted = true';
document.head.appendChild(inline);
const external = document.createElement('script');
external.src = 'https://captcha-csp-test.invalid/blocked.js';
document.head.appendChild(external);
setTimeout(() => {
  document.body.dataset.result = encodeURIComponent(JSON.stringify({
    templateResult, violations, inlineExecuted: window.untrustedInlineExecuted === true,
  }));
}, 100);
`);
const checks = [];
for (const [name, policy] of [['baseline', baseline], ['fixed', csp]]) {
  const fixture = join(artifacts, name + '.html');
  writeFileSync(fixture, '<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'
    + policy.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    + '"></head><body><script src="probe.js"></script></body></html>');
  const result = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--user-data-dir=' + join(artifacts, name + '-profile'), '--virtual-time-budget=1500', '--dump-dom',
    pathToFileURL(fixture).href], { windowsHide: true, encoding: 'utf8', timeout: 25_000, maxBuffer: 2 * 1024 * 1024 });
  if (result.error) throw result.error;
  const encoded = result.stdout.match(/data-result="([^"]+)"/)?.[1];
  assert.ok(encoded, name + ' 未返回浏览器检查结果：' + result.stderr.slice(-400));
  const check = { name, ...JSON.parse(decodeURIComponent(encoded)) };
  assert.equal(check.inlineExecuted, false, '不得允许任意内联脚本');
  assert.ok(check.violations.includes('inline'), '内联脚本仍应受 CSP 限制');
  assert.ok(check.violations.some(uri => uri.startsWith('https://captcha-csp-test.invalid')), '脚本来源仍应受 CSP 限制');
  assert.equal(check.templateResult, name === 'fixed' ? '验证码：可用' : null);
  assert.equal(check.violations.includes('eval'), name === 'baseline');
  checks.push(check);
}
console.log(JSON.stringify({ checks, artifacts }, null, 2));
