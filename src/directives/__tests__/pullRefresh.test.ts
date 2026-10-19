import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bindPullRefresh, pullRefreshOffset, type PullRefreshOptions } from '../pullRefresh';

let cleanups: Array<() => void> = [];
function touch(target: HTMLElement, type: string, x: number, y: number, count = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const points = Array.from({ length: count }, (_, identifier) => ({ identifier, clientX: x, clientY: y }));
  Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : points }, changedTouches: { value: points } });
  target.dispatchEvent(event);
  return event;
}
function surface(refresh = vi.fn(), enabled = () => true) {
  const root = document.createElement('div');
  root.innerHTML = '<div class="content">内容</div><textarea></textarea>';
  document.body.append(root);
  const options: PullRefreshOptions = { refresh };
  cleanups.push(bindPullRefresh(root, () => options, enabled));
  return { root, content: root.firstElementChild as HTMLElement, options, refresh };
}
function pull(target: HTMLElement, distance = 150) {
  touch(target, 'touchstart', 100, 100);
  touch(target, 'touchmove', 101, 100 + distance);
  touch(target, 'touchend', 101, 100 + distance);
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanups.forEach(dispose => dispose()); cleanups = []; document.body.innerHTML = ''; vi.useRealTimers(); });

describe('官方样式下拉刷新手势', () => {
  it('顶部单指超过阈值后松手刷新，等待实际请求结束才回收', async () => {
    let finish!: () => void;
    const refresh = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const { root, content } = surface(refresh);
    touch(content, 'touchstart', 100, 100);
    expect(touch(content, 'touchmove', 100, 250).defaultPrevented).toBe(true);
    expect(refresh).not.toHaveBeenCalled();
    expect(root.textContent).toContain('松开刷新');
    touch(content, 'touchend', 100, 250);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(root.querySelector('.is-refreshing')).not.toBeNull();
    pull(content);
    expect(refresh).toHaveBeenCalledTimes(1);
    finish(); await vi.runAllTimersAsync();
    expect(root.hasAttribute('aria-busy')).toBe(false);
    expect((root.querySelector('.pull-refresh-indicator') as HTMLElement).hidden).toBe(true);
  });
  it.each(['not-top', 'horizontal', 'upward', 'short', 'cancel', 'multi', 'input', 'edge', 'disabled', 'desktop'])('%s 时不刷新', mode => {
    const { root, content, refresh, options } = surface(undefined, () => mode !== 'desktop');
    if (mode === 'not-top') root.scrollTop = 10;
    if (mode === 'disabled') options.disabled = true;
    const target = mode === 'input' ? root.querySelector('textarea')! : content;
    const x = mode === 'edge' ? 10 : 100;
    touch(target, 'touchstart', x, 100, mode === 'multi' ? 2 : 1);
    const event = touch(target, 'touchmove', mode === 'horizontal' ? 300 : x, mode === 'upward' ? 0 : mode === 'short' ? 180 : 260, mode === 'multi' ? 2 : 1);
    touch(target, mode === 'cancel' ? 'touchcancel' : 'touchend', x, 260);
    expect(refresh).not.toHaveBeenCalled();
    if (!['short', 'cancel'].includes(mode)) expect(event.defaultPrevented).toBe(false);
  });
  it('滚动途中到达顶部的同一手势不触发刷新', () => {
    const { root, content, refresh } = surface();
    root.scrollTop = 20;
    touch(content, 'touchstart', 100, 100);
    root.scrollTop = 0;
    touch(content, 'touchmove', 100, 300);
    touch(content, 'touchend', 100, 300);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('嵌套刷新区域只刷新最内层，子滚动区域尚未到顶时不接管', () => {
    const outer = surface(), inner = surface();
    outer.root.append(inner.root);
    pull(inner.content);
    expect(inner.refresh).toHaveBeenCalledTimes(1);
    expect(outer.refresh).not.toHaveBeenCalled();
    const another = surface();
    another.content.scrollTop = 12;
    pull(another.content);
    expect(another.refresh).not.toHaveBeenCalled();
  });
  it('请求失败也结束刷新，保留页面并允许再次尝试', async () => {
    const root = document.createElement('div'); document.body.append(root);
    const refresh = vi.fn().mockRejectedValue(new Error('离线'));
    const error = vi.fn();
    cleanups.push(bindPullRefresh(root, () => ({ refresh }), () => true, error));
    pull(root); await vi.runAllTimersAsync();
    expect(error).toHaveBeenCalledOnce();
    expect(root.hasAttribute('aria-busy')).toBe(false);
    pull(root); await vi.runAllTimersAsync();
    expect(refresh).toHaveBeenCalledTimes(2);
  });
  it('拖动后取消原点击，销毁宿主后移除指示器和监听', () => {
    const { root, content } = surface();
    pull(content);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    content.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    cleanups.pop()!();
    expect(root.querySelector('.pull-refresh-indicator')).toBeNull();
    expect(root.style.position).toBe('');
  });
  it('使用官方弹性公式，阈值后继续下拉的位移有上限', () => {
    expect(pullRefreshOffset(0)).toBe(0);
    expect(pullRefreshOffset(64)).toBe(64);
    expect(pullRefreshOffset(128)).toBeGreaterThan(64);
    expect(pullRefreshOffset(1000)).toBe(pullRefreshOffset(2000));
  });
  it('外层页面未到顶时不接管，图标起手也能刷新', () => {
    const { root, refresh } = surface();
    const parent = document.createElement('div'); parent.className = 'app-page-content';
    document.body.append(parent); parent.append(root);
    root.innerHTML = '<svg><path /></svg>';
    const icon = root.querySelector('path')! as unknown as HTMLElement;
    parent.scrollTop = 12; pull(icon);
    expect(refresh).not.toHaveBeenCalled();
    parent.scrollTop = 0; pull(icon);
    expect(refresh).toHaveBeenCalledOnce();
  });
  it('指示器锚点避开可见的吸顶栏', () => {
    const { root, content } = surface();
    const shell = document.createElement('div'); shell.className = 'app-shell';
    const header = document.createElement('header'); header.className = 'mobile-reading-topbar';
    document.body.append(shell); shell.append(header, root);
    header.getBoundingClientRect = () => ({ top: 0, bottom: 80, height: 80, left: 0, right: 390, width: 390, x: 0, y: 0, toJSON() {} });
    root.getBoundingClientRect = () => ({ top: 0, bottom: 800, height: 800, left: 0, right: 390, width: 390, x: 0, y: 0, toJSON() {} });
    pull(content);
    expect((root.querySelector('.pull-refresh-indicator') as HTMLElement).style.top).toBe('80px');
  });
});
