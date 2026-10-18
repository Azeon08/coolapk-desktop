import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../../stores/auth';

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('../../../router', () => ({ router: { push: mocks.push } }));
import UpdatedFollowUsers from '../UpdatedFollowUsers.vue';

const now = Date.UTC(2026, 9, 18, 4);
const feed = (uid: number, age = 0) => ({ id: uid, uid, username: `酷友${uid}`, dateline: now / 1000 - age });
const mountCard = (feeds: any[]) => mount(UpdatedFollowUsers, {
  props: { feeds }, global: { stubs: { AppAvatar: true } },
});

describe('有更新的酷友卡片', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    mocks.push.mockClear();
    setActivePinia(createPinia());
    useAuthStore().isLoggedIn = true;
    useAuthStore().user = { uid: '100', username: '自己' } as any;
  });
  afterEach(() => { vi.useRealTimers(); });

  it('点击头像或昵称均进入主页，追加动态后更新列表', async () => {
    const wrapper = mountCard([feed(20)]);
    expect(wrapper.text()).toContain('最近 24 小时 · 根据已加载的关注动态汇总');
    await wrapper.get('app-avatar-stub').trigger('click');
    expect(mocks.push).toHaveBeenLastCalledWith('/user/20');
    await wrapper.setProps({ feeds: [feed(20), feed(30, 60)] });
    expect(wrapper.findAll('.updated-user')).toHaveLength(2);
    await wrapper.findAll('.updated-user-name')[1]!.trigger('click');
    expect(mocks.push).toHaveBeenLastCalledWith('/user/30');
    wrapper.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('超过预览人数时可展开全部并收起', async () => {
    const wrapper = mountCard(Array.from({ length: 12 }, (_, i) => feed(i + 1)));
    expect(wrapper.findAll('.updated-user')).toHaveLength(10);
    await wrapper.get('.updates-expand').trigger('click');
    expect(wrapper.findAll('.updated-user')).toHaveLength(12);
    expect(wrapper.get('.updates-expand').attributes('aria-expanded')).toBe('true');
    await wrapper.get('.updates-expand').trigger('click');
    expect(wrapper.findAll('.updated-user')).toHaveLength(10);
    wrapper.unmount();
  });

  it('无近期动态时隐藏，时间经过后自动移除过期酷友', async () => {
    const wrapper = mountCard([]);
    expect(wrapper.find('section').exists()).toBe(false);
    await wrapper.setProps({ feeds: [feed(20, 86370)] });
    expect(wrapper.find('section').exists()).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(wrapper.find('section').exists()).toBe(false);
    wrapper.unmount();
  });

  it('退出登录后隐藏名单', async () => {
    const wrapper = mountCard([feed(20)]);
    useAuthStore().isLoggedIn = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('section').exists()).toBe(false);
    wrapper.unmount();
  });
});
