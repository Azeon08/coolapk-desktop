import { describe, expect, it } from 'vitest';
import { getFollowUpdateCard, isFollowUpdateCard } from '../followUpdates';

describe('官方最近更新卡片', () => {
  it('仅接受官方卡片，保留实体顺序、内容和跳转地址', () => {
    const card = { entityTemplate: 'iconScrollCard', url: '/user/recent', entities: [{ uid: '30' }, { uid: '20' }] };
    expect(getFollowUpdateCard([{ id: 1, uid: '10' }, card])).toBe(card);
    expect(isFollowUpdateCard(card)).toBe(true);
  });
  it('无卡片或空卡片时不从动态生成名单', () => {
    expect(getFollowUpdateCard([null, { id: 1, uid: '20', dateline: Date.now() }, { entityTemplate: 'iconScrollCard', entities: [] }])).toBeUndefined();
  });
});
