import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

// 加载官方体验页公开的滑块配置，只检查弹窗和样式，不完成验证或访问用户账号。
const captchaId = '5a0e2d04ffa44caba3f740e6a8b0fa84';
const policy = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')).app.security.csp;
const browser = process.env.LAYOUT_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
assert.ok(existsSync(browser), '请通过 LAYOUT_BROWSER 指定 Chromium 浏览器路径');
const artifacts = mkdtempSync(join(tmpdir(), 'coolapk-captcha-sdk-'));
const probe = `
window.probe = { violations: [], loaded: false, error: '' };
document.addEventListener('securitypolicyviolation', e => {
  window.probe.violations.push({ directive: e.effectiveDirective, origin: e.blockedURI.startsWith('http') ? new URL(e.blockedURI).origin : e.blockedURI });
});
const script = document.createElement('script');
script.src = 'https://cstaticdun.126.net/load.min.js';
script.onload = () => window.initNECaptcha({
  captchaId: '${captchaId}', element: document.getElementById('captcha'),
  mode: 'popup', apiVersion: 2, protocol: 'https', width: '320px', lang: 'zh-CN',
}, instance => { window.captcha = instance; instance.verify(); window.probe.loaded = true; },
  () => { window.probe.error = 'SDK 初始化失败'; });
script.onerror = () => { window.probe.error = 'SDK 脚本加载失败'; };
document.head.appendChild(script);
`;
const server = createServer((req, res) => {
  if (req.url === '/probe.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(probe); return; }
  // Tauri 在 release 的 style-src 追加 nonce/hash，浏览器会因此忽略其中的 unsafe-inline。
  // SDK 动态创建的 style 没有这个 nonce。单独用原始配置测试会漏掉这个差异。
  const releasePolicy = policy.replace(/style-src [^;]+/, "$& 'nonce-release-asset-probe'");
  const csp = req.url === '/baseline' ? releasePolicy.replace(/style-src-elem [^;]+;?\s*/g, '') : releasePolicy;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Content-Security-Policy', csp);
  res.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="captcha" style="position:fixed;inset:0;z-index:99999"></div><script src="/probe.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const root = `http://127.0.0.1:${server.address().port}`;
const child = spawn(browser, ['--headless', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--user-data-dir=' + join(artifacts, 'profile'), 'about:blank'],
{ windowsHide: true, stdio: 'ignore' });
let socket;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number(readFileSync(join(artifacts, 'profile', 'DevToolsActivePort'), 'utf8').split('\n')[0]); break; } catch { await delay(100); }
  }
  assert.ok(port, '浏览器调试端口未启动');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(t => t.type === 'page' && t.url === 'about:blank').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (!msg.id) return;
    const waiter = pending.get(msg.id);
    if (!waiter) return;
    clearTimeout(waiter.timeout);
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(JSON.stringify(msg.error))); else waiter.resolve(msg.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const commandId = ++id;
    const timeout = setTimeout(() => { pending.delete(commandId); reject(new Error(method + ' 超时')); }, 15000);
    pending.set(commandId, { resolve, reject, timeout }); socket.send(JSON.stringify({ id: commandId, method, params }));
  });
  const checks = [];
  for (const name of ['baseline', 'fixed']) {
    await send('Page.navigate', { url: root + '/' + name });
    let result;
    for (let i = 0; i < 150; i++) {
      await delay(200);
      const evaluation = await send('Runtime.evaluate', { returnByValue: true, expression: `(() => {
        if (!window.probe) return null;
        const popup = document.querySelector('.yidun_popup');
        const content = document.querySelector('.yidun_modal') || document.querySelector('.yidun_popup__content');
        return { ...window.probe,
          popupPosition: popup ? getComputedStyle(popup).position : null,
          popupWidth: popup ? Math.round(popup.getBoundingClientRect().width) : 0,
          contentWidth: content ? Math.round(content.getBoundingClientRect().width) : 0 };
      })()` });
      result = evaluation.result?.value;
      if (result?.error || (result?.loaded && result.popupWidth > 0)) { await delay(500); break; }
    }
    assert.ok(result, name + ' 没有检查结果');
    checks.push({ name, ...result });
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(artifacts, name + '.png'), Buffer.from(screenshot.data, 'base64'));
    await send('Runtime.evaluate', { expression: 'window.captcha?.destroy()' });
  }
  console.log(JSON.stringify({ checks, artifacts }, null, 2));
  const [baseline, fixed] = checks;
  assert.equal(baseline.error, '');
  assert.equal(fixed.error, '');
  assert.ok(baseline.violations.some(v => v.directive.startsWith('style')), '旧配置应复现样式被 CSP 阻止');
  assert.ok(!fixed.violations.some(v => v.directive.startsWith('style')), '修复后不应阻止易盾样式');
  assert.equal(baseline.popupPosition, 'static');
  assert.equal(fixed.popupPosition, 'absolute');
  assert.ok(fixed.contentWidth >= 300 && fixed.contentWidth <= 500, '弹窗应保持正常宽度');
} finally {
  socket?.close(); child.kill(); server.closeAllConnections(); server.close();
}
