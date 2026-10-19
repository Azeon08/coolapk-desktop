import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../../../stores/auth';
const mocks = vi.hoisted(() => ({ push: vi.fn(), openUrl: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push, resolve: (route: string) => ({ matched: /^\/user\/[^/]+$|^\/page\?/.test(route) ? [{}] : [] }) }) }));
vi.mock('../../../router', () => ({ router: { push: mocks.push } }));
vi.mock('../../../api/coolapk', () => ({ CoolapkTauriAPI: { openUrl: mocks.openUrl } }));
import UpdatedFollowUsers from '../UpdatedFollowUsers.vue';

const user = (uid: number) => ({ entityType: 'user', uid, username: `酷友${uid}`, userAvatar: 'avatar', url: `/u/${uid}` });
const card = (count: number) => ({ entityTemplate: 'iconScrollCard', url: '/user/recentUpdateList', entities: Array.from({ length: count }, (_, i) => user(i + 1)) });
const mountCard = (feeds: any[]) => mount(UpdatedFollowUsers, { props: { feeds }, global: { stubs: { AppAvatar: true, AppImage: true } } });

describe('官方最近更新横向列表', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); setActivePinia(createPinia()); useAuthStore().isLoggedIn = true; });
  it('显示入口和服务端用户，点击用户使用官方地址', async () => {
    const wrapper = mountCard([card(1)]);
    expect(wrapper.text()).toBe('最近更新酷友1');
    expect(wrapper.find('.updates-more').exists()).toBe(false);
    await wrapper.get('app-avatar-stub').trigger('click');
    expect(mocks.push).toHaveBeenLastCalledWith('/user/1');
    wrapper.unmount();
  });
  it('六项起显示查看更多，两个入口都打开服务端列表而不展开本地名单', async () => {
    const wrapper = mountCard([card(6)]);
    expect(wrapper.findAll('.updated-user')).toHaveLength(8);
    await wrapper.get('.updates-more').trigger('click');
    expect(mocks.push).toHaveBeenLastCalledWith({ path: '/page', query: { url: '/user/recentUpdateList', title: '有更新的酷友', renderer: 'discovery' } });
    await wrapper.get('.updated-user').trigger('click');
    expect(mocks.push).toHaveBeenCalledTimes(2);
    wrapper.unmount();
  });
  it('保留非用户实体及其跳转，不截断服务端条目', async () => {
    const data = card(12);
    data.entities.push({ entityType: 'link', title: '官方入口', pic: 'icon', url: '/page?url=OFFICIAL' } as any);
    const wrapper = mountCard([data]);
    expect(wrapper.findAll('.updated-user')).toHaveLength(15);
    await wrapper.findAll('.updated-user')[13]!.trigger('click');
    expect(mocks.push).toHaveBeenLastCalledWith({ path: '/page', query: { url: 'OFFICIAL', title: '官方入口', renderer: 'discovery' } });
    wrapper.unmount();
  });
  it('收起后完全移除占位，记住选择并允许分类栏恢复', async () => {
    const wrapper = mountCard([card(6)]);
    await wrapper.get('.updates-toggle').trigger('click');
    expect(wrapper.find('section').exists()).toBe(false);
    expect(wrapper.vm.collapsed).toBe(true);
    expect(mocks.push).not.toHaveBeenCalled();
    wrapper.unmount();
    const restored = mountCard([card(6)]);
    expect(restored.find('section').exists()).toBe(false);
    restored.vm.expand();
    await restored.vm.$nextTick();
    expect(restored.findAll('.updated-user')).toHaveLength(8);
    restored.unmount();
    const expanded = mountCard([card(1)]);
    expect(expanded.find('.updates-list').exists()).toBe(true);
    expanded.unmount();
  });

  it('无卡片和退出登录时隐藏，后续响应可更新卡片', async () => {
    const wrapper = mountCard([{ id: 1, uid: '20', dateline: Date.now() }]);
    expect(wrapper.find('section').exists()).toBe(false);
    await wrapper.setProps({ feeds: [card(1)] });
    expect(wrapper.find('section').exists()).toBe(true);
    useAuthStore().isLoggedIn = false;
    await wrapper.vm.$nextTick();
    expect(wrapper.find('section').exists()).toBe(false);
    wrapper.unmount();
  });
});
