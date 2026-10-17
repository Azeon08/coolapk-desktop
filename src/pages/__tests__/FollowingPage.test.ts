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
});
