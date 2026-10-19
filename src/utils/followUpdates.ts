/** 官方关注页使用服务端 iconScrollCard，保留条目顺序和跳转地址，不从动态推算更新名单。 */
export function isFollowUpdateCard(item: any): boolean {
  return item?.entityTemplate === 'iconScrollCard';
}

export function getFollowUpdateCard(items: any[]): any | undefined {
  return items.find(item => isFollowUpdateCard(item) && Array.isArray(item.entities) && item.entities.length > 0);
}
