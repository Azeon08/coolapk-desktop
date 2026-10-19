/** 测试用单指下拉：位移跨过官方 64px 触发阈值，保持内容区内部起手。 */
export function mobilePull(target: HTMLElement) {
  for (const [type, y] of [['touchstart', 100], ['touchmove', 260], ['touchend', 260]] as const) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    const point = { identifier: 0, clientX: 100, clientY: y };
    Object.defineProperties(event, { touches: { value: type === 'touchend' ? [] : [point] }, changedTouches: { value: [point] } });
    target.dispatchEvent(event);
  }
}
