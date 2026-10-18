import { describe, expect, it } from 'vitest';
import { collectUpdatedFollowUsers } from '../followUpdates';

const now = Date.UTC(2026, 9, 18, 4);
const seconds = now / 1000;

describe('有更新的酷友汇总', () => {
  it('每个作者只保留最新动态，兼容秒和毫秒，并按时间倒序排列', () => {
    const result = collectUpdatedFollowUsers([
      { id: 1, uid: 20, username: '旧昵称', dateline: seconds - 500 },
      { id: 2, uid: '30', username: '另一位酷友', dateline: String(seconds - 100) },
      { id: 3, userInfo: { uid: 20, username: '新昵称', userAvatar: 'avatar', avatar_plugin_url: 'plugin' }, dateline: now - 1000 },
      { id: 3, uid: 20, dateline: seconds - 1 },
    ], '10', now);
    expect(result).toEqual([
      { uid: '20', username: '新昵称', avatar: 'avatar', pluginUrl: 'plugin', dateline: seconds - 1 },
      { uid: '30', username: '另一位酷友', avatar: '', pluginUrl: '', dateline: seconds - 100 },
    ]);
  });

  it('排除本人、超过 24 小时、未来和无有效时间的动态，以及推荐用户卡片', () => {
    const rows = [
      { id: 1, uid: '10', dateline: seconds },
      { id: 2, uid: '20', dateline: seconds - 86400 },
      { id: 3, uid: '30', dateline: seconds + 1 },
      { id: 4, uid: '40', dateline: 'invalid' },
      { id: 5, uid: '50' },
      { id: 6, uid: '60', dateline: 0 },
      { id: 7, uid: '70', dateline: seconds, entityType: 'user' },
      { id: 8, uid: '80', dateline: seconds, entityType: 'card' },
      { id: 9, uid: '../settings', dateline: seconds },
      { id: 10, uid: 0, dateline: seconds },
      null,
    ];
    expect(collectUpdatedFollowUsers(rows, '10', now)).toEqual([]);
  });

  it('转发只计入发布者，旧动态不会因重新出现或原作者有更新而计入', () => {
    const result = collectUpdatedFollowUsers([
      { id: 1, uid: '20', dateline: seconds - 1, forwardSourceFeed: { uid: '30', dateline: seconds } },
      { id: 2, uid: '40', dateline: seconds - 90000, lastChangeTime: seconds },
    ], '10', now);
    expect(result.map(user => user.uid)).toEqual(['20']);
  });
});
