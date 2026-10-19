import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  getFollowUserList: vi.fn(),
  getFansList: vi.fn(),
  getFollowingFeeds: vi.fn(),
  getUserFeeds: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../router', () => ({ router: { push: mocks.push } }));

vi.mock('../../api/coolapk', () => ({
  CoolapkTauriAPI: {
    getFollowUserList: mocks.getFollowUserList,
    getFansList: mocks.getFansList,
    getFollowingFeeds: mocks.getFollowingFeeds,
    getUserFeeds: mocks.getUserFeeds,
  },
}));

import FollowingPage from '../FollowingPage.vue';
import { useAuthStore } from '../../stores/auth';

function mountFollowingPage() {
  return mount(FollowingPage, {
    global: {
      stubs: {
        AppAvatar: true,
        AppButton: true,
        EmptyState: true,
        FeedCard: true,
        LoadingState: true,
        MoreDataPage: true,
      },
    },
  });
}

describe('关注页账号 UID', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    const authStore = useAuthStore();
    authStore.isLoggedIn = true;
    authStore.user = { username: '尚未同步 UID 的账号' } as any;
    mocks.getFollowUserList.mockResolvedValue({ data: [] });
    mocks.getFansList.mockResolvedValue({ data: [] });
    mocks.getFollowingFeeds.mockResolvedValue({ data: [] });
    mocks.getUserFeeds.mockResolvedValue({ data: [] });
  });

  it('当前账户没有 UID 时不使用其他人的固定 UID 请求关注或粉丝列表', async () => {
    const wrapper = mount(FollowingPage, {
      global: {
        stubs: {
          AppAvatar: true,
          AppButton: true,
          EmptyState: true,
          FeedCard: true,
          LoadingState: true,
          MoreDataPage: true,
        },
      },
    });
    await flushPromises();

    expect(mocks.getFollowUserList).not.toHaveBeenCalled();
    await wrapper.findAll('.sidebar-tab-btn')[1]!.trigger('click');
    await flushPromises();
    expect(mocks.getFansList).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each(['users', 'fans'])('%s 列表的头像、昵称、简介、空白处和箭头均进入对方主页', async tab => {
    useAuthStore().user = { uid: '100', username: '自己' } as any;
    mocks.getFollowUserList.mockResolvedValue({ data: [{ uid: '100', fuid: '200', fusername: '关注酷友', bio: '简介' }] });
    mocks.getFansList.mockResolvedValue({ data: [{ uid: '300', fuid: '100', username: '粉丝酷友', bio: '简介' }] });
    const wrapper = mountFollowingPage();
    await flushPromises();
    if (tab === 'fans') {
      await wrapper.findAll('.sidebar-tab-btn')[1]!.trigger('click');
      await flushPromises();
    }
    const row = wrapper.get('.sidebar-user-item[role="link"]');
    const expectedPath = tab === 'fans' ? '/user/300' : '/user/200';
    for (const selector of ['app-avatar-stub', '.user-item-name', '.user-item-desc', '.user-profile-btn']) {
      mocks.push.mockClear();
      await row.get(selector).trigger('click');
      expect(mocks.push).toHaveBeenCalledExactlyOnceWith(expectedPath);
    }
    mocks.push.mockClear();
    await row.trigger('click');
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(expectedPath);
    mocks.push.mockClear();
    await row.trigger('keydown', { key: 'Enter' });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(expectedPath);
    expect(mocks.getUserFeeds).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('独立的看动态按钮只筛选动态，全部动态可清除筛选', async () => {
    useAuthStore().user = { uid: '100', username: '自己' } as any;
    mocks.getFollowUserList.mockResolvedValue({ data: [{ uid: '100', fuid: '200', fusername: '关注酷友' }] });
    const wrapper = mountFollowingPage();
    await flushPromises();
    const button = wrapper.get('.user-feed-btn');
    await button.trigger('keydown', { key: 'Enter' });
    expect(mocks.push).not.toHaveBeenCalled();
    await button.trigger('click');
    await flushPromises();
    expect(mocks.getUserFeeds).toHaveBeenCalledExactlyOnceWith('200', 1, 'feed');
    expect(mocks.push).not.toHaveBeenCalled();
    expect(button.attributes('aria-pressed')).toBe('true');
    expect(wrapper.get('.user-filter-bar').text()).toContain('关注酷友');
    mocks.getFollowingFeeds.mockClear();
    await wrapper.get('.sidebar-user-item:not([role])').trigger('click');
    await flushPromises();
    expect(mocks.getFollowingFeeds).toHaveBeenCalledExactlyOnceWith(1);
    expect(wrapper.find('.user-filter-bar').exists()).toBe(false);
    wrapper.unmount();
  });

  it('关注更新名单在查看粉丝动态时保留，且不混入该粉丝', async () => {
    useAuthStore().user = { uid: '100', username: '自己' } as any;
    const dateline = Math.floor(Date.now() / 1000);
    mocks.getFollowingFeeds.mockResolvedValue({ data: [{ entityType: 'card', entityTemplate: 'iconScrollCard', url: '/user/recentUpdateList', entities: [{ entityType: 'user', uid: '200', username: '有更新的关注酷友', url: '/u/200' }] }, { id: 1, uid: '200', username: '有更新的关注酷友', dateline }] });
    mocks.getFansList.mockResolvedValue({ data: [{ uid: '300', fuid: '100', username: '粉丝酷友' }] });
    mocks.getUserFeeds.mockResolvedValue({ data: [{ id: 2, uid: '300', username: '粉丝酷友', dateline }] });
    const wrapper = mountFollowingPage();
    await flushPromises();
    expect(wrapper.get('.updated-follow-users').text()).toContain('有更新的关注酷友');
    await wrapper.findAll('.sidebar-tab-btn')[1]!.trigger('click');
    await flushPromises();
    await wrapper.get('.user-feed-btn').trigger('click');
    await flushPromises();
    expect(wrapper.get('.updated-follow-users').text()).toContain('有更新的关注酷友');
    expect(wrapper.get('.updated-follow-users').text()).not.toContain('粉丝酷友');
    wrapper.unmount();
  });
});
