import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { afterEach, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getFeedDetail: vi.fn(), getQuestionAnswers: vi.fn() }));
vi.mock('../../api/coolapk', () => ({ CoolapkTauriAPI: api }));
import QuestionDetailPage from '../QuestionDetailPage.vue';

afterEach(() => vi.restoreAllMocks());

it.each([true, false])('问题详情加载后仅在回答入口定位列表（回答入口=%s）', async atAnswers => {
  let resolveDetail!: (value: unknown) => void;
  api.getFeedDetail.mockReturnValue(new Promise(resolve => { resolveDetail = resolve; }));
  api.getQuestionAnswers.mockResolvedValue({ data: [], hasMore: false });
  const scroll = vi.fn();
  vi.stubGlobal('IntersectionObserver', undefined);
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { value: scroll, configurable: true, writable: true });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/question/:questionId', component: { template: '<div />' } }] });
  await router.push({ path: '/question/74458787', query: atAnswers ? { scrollTo: 'answers' } : {} });
  const wrapper = mount(QuestionDetailPage, { props: { questionId: '74458787' }, global: { plugins: [createPinia(), router], stubs: { QuestionHeaderCard: true, QuestionAnswerCard: true, AppDialog: true, AppButton: true, LoadingState: true, EmptyState: true } } });
  try {
    await flushPromises();
    expect(scroll).not.toHaveBeenCalled();
    resolveDetail({ data: { id: '74458787', feedType: 'question', username: '提问者', uid: '123', message: '问题正文' } });
    await flushPromises();
    expect(wrapper.find('.answers-section').exists()).toBe(true);
    expect(scroll).toHaveBeenCalledTimes(atAnswers ? 1 : 0);
    if (atAnswers) expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });
  } finally { wrapper.unmount(); vi.unstubAllGlobals(); }
});

it.each([390, 1280])('宽度 %s 的问题页完整保留提问正文和全部回答', async width => {
  const previousWidth = window.innerWidth;
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
  vi.stubGlobal('IntersectionObserver', undefined);
  api.getFeedDetail.mockResolvedValue({ data: { id: 'question-42', feedType: 'question', title: '最近一年半载会迭代clip3吗？', message: '有没有熟悉产品迭代周期的酷友预测一下', uid: '1', username: '提问者', replynum: 2 } });
  api.getQuestionAnswers.mockResolvedValue({ data: [
    { id: 'answer-1', feedType: 'answer', message: '我也感觉是两年一代了', uid: '2', username: '第一个回答者' },
    { id: 'answer-2', feedType: 'answer', message: '这次估计是两年一代了', uid: '3', username: '第二个回答者' },
  ], hasMore: false });
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/question/:questionId', component: { template: '<div />' } }] });
  await router.push('/question/question-42');
  const wrapper = mount(QuestionDetailPage, { props: { questionId: 'question-42' }, global: { plugins: [createPinia(), router], stubs: { FeedHeader: true, FeedActionBar: true, AppDialog: true, AppButton: true } } });
  try {
    await flushPromises();
    expect(wrapper.get('.question-header-card').text()).toContain('最近一年半载会迭代clip3吗？');
    expect(wrapper.get('.question-header-card').text()).toContain('有没有熟悉产品迭代周期的酷友预测一下');
    expect(wrapper.get('.question-header-card').text()).toContain('写回答');
    expect(wrapper.get('.answers-title').text()).toBe('全部回答');
    expect(wrapper.findAll('.question-answer-card')).toHaveLength(2);
    expect(wrapper.get('.answer-list').text()).toContain('我也感觉是两年一代了');
    expect(wrapper.get('.answer-list').text()).toContain('这次估计是两年一代了');
    expect(api.getFeedDetail).toHaveBeenLastCalledWith('question-42');
  } finally { wrapper.unmount(); window.innerWidth = previousWidth; window.dispatchEvent(new Event('resize')); vi.unstubAllGlobals(); }
});
