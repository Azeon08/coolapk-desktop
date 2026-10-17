import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse, compileStyle } from '@vue/compiler-sfc';

// 真实浏览器校验私信输入区的空间分配和 CSP；单元测试环境无法判断裁切或图片解码。
const source = path => readFileSync(path, 'utf8');
const descriptor = parse(source('src/pages/MessagesPage.vue')).descriptor;
const css = readFileSync('src/styles/tokens.css', 'utf8') + descriptor.styles.map(style => compileStyle({ source: style.content, filename: 'MessagesPage.vue', id: 'composer', scoped: false }).code).join('\n');
const imagePolicy = JSON.parse(source('src-tauri/tauri.conf.json')).app.security.csp.split(';').find(rule => rule.trim().startsWith('img-src')).trim();
const browser = process.env.LAYOUT_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
if (!existsSync(browser)) throw new Error('请通过 LAYOUT_BROWSER 指定 Chromium 浏览器路径');
const artifacts = mkdtempSync(join(tmpdir(), 'coolapk-message-composer-'));
const cases = [
  { width: 390, height: 600, images: 1, fullscreen: false, inputHeight: 160 },
  { width: 1280, height: 600, images: 4, fullscreen: false, inputHeight: 160 },
  { width: 390, height: 600, images: 1, fullscreen: true, inputHeight: 160 },
  { width: 1280, height: 600, images: 1, fullscreen: true, inputHeight: 160 },
  { width: 390, height: 400, images: 0, fullscreen: false, inputHeight: 160 },
  { width: 1280, height: 600, images: 1, fullscreen: false, inputHeight: 400 },
];
const frames = cases.map((test, index) => {
  const imageClass = test.images && descriptor.template.content.includes('has-pending-images') ? ' has-pending-images' : '';
  const html = `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${imagePolicy}"><style>${css}
    html,body{margin:0;height:100%;} .messages-page{border-radius:0;} .chat-area{min-height:0;opacity:1;}
    .messages-main{display:flex!important;} .input-actions button{height:32px;width:64px;}
    </style></head><body><div class="messages-page"><div class="messages-main"><div class="chat-area">聊天记录</div>
    <div class="input-area${imageClass}${test.fullscreen ? ' is-fullscreen' : ''}" style="height:${test.inputHeight}px">
    <div class="input-toolbar"><span>表情 图片</span><button>全屏</button></div>
    ${test.images ? '<div class="pending-images-bar">' + Array.from({ length: test.images }, () => '<div class="pending-image-card"><img class="pending-image-thumb" alt="待发送图片"></div>').join('') + '</div>' : ''}
    <div class="message-rich-editor" contenteditable="true">${'输入内容<br>'.repeat(30)}</div>
    <div class="input-bottom-bar"><div class="draft-status-placeholder"></div><div class="input-actions"><button>发送</button></div></div>
    </div></div></div><script>
    (async()=>{
      const images=[...document.querySelectorAll('img')];
      const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aT1sAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'}));
      await Promise.all(images.map(img=>new Promise(resolve=>{img.onload=img.onerror=resolve;img.src=url;})));
      requestAnimationFrame(()=>{
        const area=document.querySelector('.input-area').getBoundingClientRect();
        const send=document.querySelector('.input-actions button').getBoundingClientRect();
        const editor=document.querySelector('.message-rich-editor').getBoundingClientRect();
        const result={index:${index},imagesLoaded:images.every(img=>img.naturalWidth>0),sendVisible:send.top>=area.top&&send.bottom<=Math.min(area.bottom,innerHeight)+1,editorVisible:editor.height>=20,areaHeight:area.height};
        parent.postMessage(result,'*');URL.revokeObjectURL(url);
      });
    })();</script></body></html>`;
  return `<iframe style="width:${test.width}px;height:${test.height}px;border:0" srcdoc="${html.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></iframe>`;
});
const fixture = join(artifacts, 'composer.html');
writeFileSync(fixture, `<html><body><script>const results=[];addEventListener('message',event=>{results.push(event.data);document.body.dataset.results=encodeURIComponent(JSON.stringify(results));});</script>${frames.join('')}</body></html>`);
const result = spawnSync(browser, ['--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${join(artifacts, 'profile')}`, '--window-size=1440,1000', '--virtual-time-budget=3000', '--dump-dom', pathToFileURL(fixture).href], { windowsHide: true, encoding: 'utf8', timeout: 25000, maxBuffer: 10 * 1024 * 1024 });
if (result.error) throw result.error;
const encoded = result.stdout.match(/data-results="([^"]+)"/)?.[1];
if (!encoded) throw new Error(`浏览器未返回结果：${result.stderr.slice(-600)}`);
const checks = JSON.parse(decodeURIComponent(encoded)).sort((a, b) => a.index - b.index);
console.log(JSON.stringify({ checks, artifacts }, null, 2));
const passed = checks.length === cases.length && checks.every(check => check.imagesLoaded && check.sendVisible && check.editorVisible);
if (!passed) throw new Error('私信图片预览或输入区布局验证失败');
