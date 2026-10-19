import type { ObjectDirective } from 'vue';
import { isMobileLayout } from '../composables/useOfficialMobileFeedDetail';
import { useSettingsStore } from '../stores/settings';
import { isTouchMobilePlatform } from '../utils/platform';

export interface PullRefreshOptions {
  refresh: () => unknown | Promise<unknown>;
  disabled?: boolean;
}

/** 对齐 APK SwipeRefreshLayout：40dp 圆盘、64dp 阈值、0.5 拖动系数与弹性超程。 */
export function pullRefreshOffset(distance: number) {
  const progress = Math.min(1, distance / 64);
  const extra = Math.max(0, Math.min(distance - 64, 128) / 64) / 4;
  return 64 * progress + (extra - extra * extra) * 256;
}

/** 同一滚动分支只允许最内层的刷新宿主接管，避免嵌套栏目重复刷新。 */
const roots = new WeakSet<HTMLElement>();
export function bindPullRefresh(root: HTMLElement, options: () => PullRefreshOptions, enabled: () => boolean, onError: (error: unknown) => void = console.warn) {
  roots.add(root);
  const originalPosition = root.style.position;
  if (getComputedStyle(root).position === 'static' || !getComputedStyle(root).position) root.style.position = 'relative';
  let indicator: HTMLDivElement | undefined;
  let gesture: { x: number; y: number; id: number; direction: 'pending' | 'vertical'; distance: number; top: number; left: number } | undefined;
  let suppressClickUntil = 0;
  let refreshing = false, disposed = false, settling: ReturnType<typeof setTimeout> | undefined;
  const excluded = 'nav, .feed-tabs-wrapper, .header-tabs, .app-tabs, input, textarea, select, [contenteditable="true"], [role="slider"], video, .feed-video-card, .dialog-wrapper, .image-viewer, [inert], [aria-hidden="true"]';

  function hide() { if (indicator) { indicator.hidden = true; indicator.classList.remove('is-refreshing', 'is-settling'); } }
  function reset() { gesture = undefined; if (!refreshing) hide(); }
  function settle() {
    if (!indicator) return;
    indicator.classList.remove('is-refreshing');
    indicator.classList.add('is-settling');
    indicator.style.transform = 'translate(-50%, -40px)';
    indicator.style.opacity = '0';
    clearTimeout(settling);
    settling = setTimeout(hide, 200);
  }
  function show(distance: number, top: number, left: number) {
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'pull-refresh-indicator';
      indicator.setAttribute('role', 'status');
      indicator.setAttribute('aria-live', 'polite');
      // 图形仅使用固定 SVG，不接收服务端或用户输入。
      indicator.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /></svg><span class="pull-refresh-label"></span>';
    }
    if (indicator.parentElement !== root) root.append(indicator);
    clearTimeout(settling);
    indicator.hidden = false;
    indicator.classList.remove('is-settling');
    indicator.style.top = `${top}px`;
    indicator.style.left = `${left}px`;
    indicator.style.transform = `translate(-50%, ${pullRefreshOffset(distance) - 40}px)`;
    indicator.style.opacity = String(distance > 64 ? 1 : Math.max(.3, distance / 64));
    const svg = indicator.firstElementChild as SVGElement;
    svg.style.transform = `rotate(${distance * 3}deg)`;
    const label = indicator.lastElementChild!;
    const text = refreshing ? '正在刷新' : distance > 64 ? '松开刷新' : '下拉刷新';
    if (label.textContent !== text) label.textContent = text;
  }
  function start(event: TouchEvent) {
    reset();
    if (refreshing || disposed || !enabled() || options().disabled || event.touches.length !== 1 || !(event.target instanceof Element)) return;
    const target = event.target;
    if (target.closest(excluded) || root.closest('[inert], [aria-hidden="true"]')) return;
    let scroller = root;
    for (let current: Element | null = target; current; current = current.parentElement) {
      if (!(current instanceof HTMLElement)) continue;
      if (current !== root && roots.has(current)) return;
      if (current.scrollTop > 1) return;
      if (scroller === root && current !== root && /auto|scroll/.test(getComputedStyle(current).overflowY)) scroller = current;
      if (current === root) break;
    }
    // 内嵌列表之外的页面仍未到顶时，不劫持页面继续向上滚动。
    for (let parent = root.parentElement; parent; parent = parent.parentElement) {
      if (parent.scrollTop > 1) return;
      if (parent.classList.contains('app-page-content')) break;
    }
    const point = event.touches[0]!;
    // 保留系统边缘返回手势，避免与 iOS 返回及安卓侧滑返回竞争。
    if (point.clientX < 24 || point.clientX > window.innerWidth - 24) return;
    const rect = scroller.getBoundingClientRect(), rootRect = root.getBoundingClientRect();
    // CSS 自定义属性可能含 env()/max()，通过实际布局读取，兼容安卓原生安全区与 iOS 刘海。
    const safeArea = document.createElement('span');
    safeArea.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;width:0;height:var(--app-safe-area-top, 0px)';
    root.append(safeArea);
    let top = Math.max(rect.top, safeArea.getBoundingClientRect().height);
    safeArea.remove();
    // 指示器避开玻璃主栏目和详情吸顶作者栏，不能进入系统状态栏。
    for (const header of Array.from(root.closest('.app-shell')?.querySelectorAll<HTMLElement>('.mobile-reading-topbar, .home-toolbar, .topic-sticky-controls, .official-detail-author, .profile-toolbar') || [])) {
      if (header.closest('[aria-hidden="true"], [inert]')) continue;
      const bounds = header.getBoundingClientRect();
      if (bounds.height && bounds.top <= top + 1 && bounds.bottom > top && bounds.left < rect.right && bounds.right > rect.left) top = bounds.bottom;
    }
    gesture = { x: point.clientX, y: point.clientY, id: point.identifier, direction: 'pending', distance: 0, top: top - rootRect.top + root.scrollTop, left: rect.left - rootRect.left + rect.width / 2 + root.scrollLeft };
  }
  function move(event: TouchEvent) {
    if (!gesture) return;
    if (!enabled() || options().disabled || event.touches.length !== 1) { reset(); return; }
    const point = event.touches[0]!;
    if (point.identifier !== gesture.id) { reset(); return; }
    const dx = point.clientX - gesture.x, dy = point.clientY - gesture.y;
    if (gesture.direction === 'pending') {
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= 8) return;
      if (dy <= 0 || Math.abs(dy) <= Math.abs(dx) * 1.2) { reset(); return; }
      gesture.direction = 'vertical';
    }
    if (!event.cancelable) { reset(); return; }
    suppressClickUntil = performance.now() + 500;
    event.preventDefault();
    event.stopPropagation();
    gesture.distance = Math.max(0, dy - 8) * .5;
    show(gesture.distance, gesture.top, gesture.left);
  }
  async function end(event: TouchEvent) {
    const current = gesture;
    gesture = undefined;
    if (!current || current.distance <= 64 || event.type === 'touchcancel' || options().disabled || !enabled()) { if (!refreshing) settle(); return; }
    refreshing = true;
    root.setAttribute('aria-busy', 'true');
    show(64, current.top, current.left);
    indicator?.classList.add('is-refreshing');
    try { await options().refresh(); } catch (error) { if (!disposed) onError(error); }
    finally {
      refreshing = false;
      root.removeAttribute('aria-busy');
      if (!disposed) settle();
    }
  }
  function cancel() { reset(); }
  function suppressClick(event: MouseEvent) {
    if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); }
  }
  root.addEventListener('click', suppressClick, true);
  root.addEventListener('touchstart', start, { passive: true });
  root.addEventListener('touchmove', move, { passive: false });
  root.addEventListener('touchend', end);
  root.addEventListener('touchcancel', end);
  window.addEventListener('pagehide', cancel);
  return () => {
    disposed = true;
    roots.delete(root);
    clearTimeout(settling);
    root.removeEventListener('click', suppressClick, true);
    root.removeEventListener('touchstart', start);
    root.removeEventListener('touchmove', move);
    root.removeEventListener('touchend', end);
    root.removeEventListener('touchcancel', end);
    window.removeEventListener('pagehide', cancel);
    indicator?.remove();
    root.removeAttribute('aria-busy');
    if (root.style.position === 'relative') root.style.position = originalPosition;
  };
}

const bindings = new WeakMap<HTMLElement, { value: PullRefreshOptions; dispose: () => void }>();
export const vPullRefresh: ObjectDirective<HTMLElement, PullRefreshOptions> = {
  mounted(root, binding) {
    const state = { value: binding.value, dispose: () => {} };
    state.dispose = bindPullRefresh(root, () => state.value, () => isMobileLayout(window.innerWidth, isTouchMobilePlatform(), useSettingsStore().settings.disableAutoMobileMode));
    bindings.set(root, state);
  },
  updated(root, binding) { const state = bindings.get(root); if (state) state.value = binding.value; },
  beforeUnmount(root) { bindings.get(root)?.dispose(); bindings.delete(root); },
};
