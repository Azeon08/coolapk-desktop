export interface UpdatedFollowUser {
  uid: string;
  username: string;
  avatar: string;
  pluginUrl: string;
  dateline: number;
}

/** 汇总已加载关注动态中最近 24 小时的作者，不将转发原作者或卡片推荐算作更新。 */
export function collectUpdatedFollowUsers(feeds: any[], ownUid: string, now = Date.now()): UpdatedFollowUser[] {
  const latest = new Map<string, UpdatedFollowUser>();
  const nowSeconds = now / 1000;
  for (const feed of feeds) {
    if (!feed || typeof feed !== 'object' || !feed.id) continue;
    const entityType = String(feed.entityType || feed.entity_type || 'feed').toLowerCase();
    if (!['feed', 'article', 'news'].includes(entityType)) continue;
    const info = feed.userInfo || feed.user_info || {};
    const uid = String(feed.uid || info.uid || '').trim();
    if (!/^\d+$/.test(uid) || Number(uid) <= 0 || uid === ownUid) continue;
    let dateline = Number(feed.dateline);
    if (dateline > 1e12) dateline /= 1000;
    if (!Number.isFinite(dateline) || dateline <= nowSeconds - 86400 || dateline > nowSeconds) continue;
    if ((latest.get(uid)?.dateline ?? 0) >= dateline) continue;
    latest.set(uid, {
      uid,
      username: String(feed.username || info.username || '酷友'),
      avatar: String(feed.userAvatar || info.userAvatar || info.avatar || ''),
      pluginUrl: String(feed.avatar_plugin_url || info.avatar_plugin_url || ''),
      dateline,
    });
  }
  return [...latest.values()].sort((a, b) => b.dateline - a.dateline);
}
