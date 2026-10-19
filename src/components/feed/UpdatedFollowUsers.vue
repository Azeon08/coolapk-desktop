<template>
  <section v-if="available && !collapsed" class="updated-follow-users" aria-label="最近更新">
    <!-- 对齐 APK：最近更新入口、服务端条目、至少六项时的查看更多入口共用一条横向列表。 -->
    <div :id="listId" class="updates-list" @wheel="handleListWheel">
      <button type="button" class="updated-user" @click="openLink(card.url, '有更新的酷友')">
        <!-- 复用官方 ic_people_fill 矢量路径，入口文字仍为最近更新。 -->
        <span class="entry-icon updated-users-icon"><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M4.5,6.375C4.5,4.097 6.347,2.25 8.625,2.25C10.903,2.25 12.75,4.097 12.75,6.375C12.75,8.653 10.903,10.5 8.625,10.5C6.347,10.5 4.5,8.653 4.5,6.375ZM14.25,8.625C14.25,6.761 15.761,5.25 17.625,5.25C19.489,5.25 21,6.761 21,8.625C21,10.489 19.489,12 17.625,12C15.761,12 14.25,10.489 14.25,8.625ZM1.5,19.125C1.501,15.191 4.691,12.002 8.625,12.002C12.559,12.002 15.749,15.191 15.75,19.125L15.75,19.128L15.749,19.247C15.745,19.506 15.608,19.744 15.386,19.877C13.345,21.106 11.007,21.754 8.625,21.75C6.153,21.75 3.839,21.066 1.865,19.877C1.643,19.744 1.506,19.506 1.501,19.247L1.5,19.125ZM17.25,19.128L17.249,19.272C17.243,19.605 17.164,19.933 17.016,20.232C18.762,20.34 20.505,19.992 22.076,19.222C22.323,19.101 22.485,18.854 22.496,18.579C22.65,14.914 18.854,12.398 15.539,13.968C16.652,15.457 17.252,17.266 17.249,19.125L17.25,19.128L17.25,19.128Z" /></svg></span>
        <span class="updated-user-name">最近更新</span>
      </button>
      <button v-for="(item, index) in card.entities" :key="index" type="button" class="updated-user" @click="openLink(item.url, item.username || item.title)">
        <span v-if="item.entityType === 'user'" class="user-avatar">
          <AppAvatar :src="item.userAvatar || item.userInfo?.userAvatar" :plugin-url="item.avatar_plugin_url || item.userInfo?.avatar_plugin_url" :size="48" />
          <i v-if="item.isSpecial === true || Number(item.isSpecial) === 1" class="fas fa-star special-follow" aria-label="特别关注"></i>
        </span>
        <AppImage v-else :src="item.pic || item.logo" class="entity-icon" fit="contain" />
        <span class="updated-user-name">{{ item.entityType === 'user' ? (item.displayUsername || item.username || item.userInfo?.username) : item.title }}</span>
      </button>
      <button v-if="card.entities.length >= 6" type="button" class="updated-user updates-more" @click="openLink(card.url, '有更新的酷友')">
        <span class="entry-icon"><i class="fas fa-chevron-right" aria-hidden="true"></i></span>
        <span class="updated-user-name">查看更多</span>
      </button>
    </div>
    <button type="button" class="updates-toggle" :aria-expanded="!collapsed" :aria-controls="collapsed ? undefined : listId" :aria-label="collapsed ? '展开最近更新酷友' : '收起最近更新酷友'" :title="collapsed ? '展开最近更新酷友' : '收起最近更新酷友'" @click="toggleCollapsed"><i :class="collapsed ? 'fas fa-chevron-down' : 'fas fa-chevron-up'" aria-hidden="true"></i></button>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { CoolapkTauriAPI } from '../../api/coolapk';
import { normalizeCoolapkDeepLink, normalizeCoolapkRoute } from '../../utils/coolapkRoute';
import { getFollowUpdateCard } from '../../utils/followUpdates';
import AppAvatar from '../common/AppAvatar.vue';
import AppImage from '../common/AppImage.vue';

const props = defineProps<{ feeds: any[] }>();
const router = useRouter();
const authStore = useAuthStore();
const card = computed(() => getFollowUpdateCard(props.feeds));
const collapseStorageKey = 'coolapk_follow_updates_collapsed';
const listId = useId();
// 直接在内容区域记住收起状态，无需增加设置项；存储不可用时仍可正常切换。
function readCollapsed() {
  try { return localStorage.getItem(collapseStorageKey) === '1'; } catch { return false; }
}
const collapsed = ref(readCollapsed());
function toggleCollapsed() {
  collapsed.value = !collapsed.value;
  try { localStorage.setItem(collapseStorageKey, collapsed.value ? '1' : '0'); } catch { /* 无法持久化时保留本次页面选择。 */ }
}


const available = computed(() => authStore.isLoggedIn && Boolean(card.value));
function expand() {
  if (collapsed.value) toggleCollapsed();
}
// 收起时由上方已有分类栏承载展开按钮，组件自身不留下占位行。
defineExpose({ collapsed, available, expand });

/** 隐藏滚动条后，桌面鼠标仍可横向浏览；到达边界时继续滚动页面。 */
function handleListWheel(event: WheelEvent) {
  const list = event.currentTarget as HTMLElement;
  if (Math.abs(event.deltaX) >= Math.abs(event.deltaY) || list.scrollWidth <= list.clientWidth) return;
  const next = Math.max(0, Math.min(list.scrollWidth - list.clientWidth, list.scrollLeft + event.deltaY));
  if (next === list.scrollLeft) return;
  event.preventDefault();
  event.stopPropagation();
  list.scrollLeft = next;
}

/** 与 APK 一样优先使用实体 URL；列表接口交给通用服务端页面加载。 */
async function openLink(url: string, title = '') {
  if (!url) return;
  const route = normalizeCoolapkDeepLink(url) || normalizeCoolapkRoute(url);
  // /user 下还包含列表接口，不能把接口名误当成用户 UID。
  const isUserList = route?.startsWith('/user/') && !/^\/user\/\d+(?:[/?#]|$)/.test(route);
  // 最近更新可能返回用户实体或 flexList 配置，必须使用保留原始实体的页面解析。
  if (route?.startsWith('/page?')) {
    const query: Record<string, string> = {};
    new URLSearchParams(route.slice(route.indexOf('?') + 1)).forEach((value, key) => { query[key] = value; });
    await router.push({ path: '/page', query: { ...query, title: title || query.title, renderer: 'discovery' } });
    return;
  }
  if (route && !isUserList && router.resolve(route).matched.length) { await router.push(route); return; }
  if (url.startsWith('#/') || url.startsWith('/')) {
    await router.push({ path: '/page', query: { url, title, renderer: 'discovery' } });
    return;
  }
  await CoolapkTauriAPI.openUrl(url, 'internal');
}
</script>

<style scoped>
.updated-follow-users { position: relative; display: flex; align-items: center; min-width: 0; background: var(--surface); }
.updates-list { display: flex; flex: 1; min-width: 0; overflow-x: auto; padding: 8px 36px 8px 0; scrollbar-width: none; }
.updates-list::-webkit-scrollbar { display: none; }
.updated-user { display: flex; flex: 0 0 64px; flex-direction: column; align-items: center; gap: 2px; min-width: 0; border: none; padding: 2px; background: transparent; color: var(--text-primary); cursor: pointer; }
.updated-user:hover { background: var(--surface-hover); }
.updated-user:focus-visible, .updates-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: -2px; }
.updates-toggle { position: absolute; top: 0; right: 0; bottom: 0; z-index: 1; display: flex; align-items: center; justify-content: flex-end; width: 40px; min-height: 44px; border: 0; padding: 0 5px 0 11px; background: linear-gradient(to right, transparent, var(--surface) 45%); color: var(--text-tertiary); font-size: 11px; cursor: pointer; }
.updates-toggle i { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 24px; height: 24px; border-radius: 50%; }
.updates-toggle:hover i, .updates-toggle:focus-visible i { background: var(--surface-hover); color: var(--text-secondary); }
.user-avatar { position: relative; width: 48px; height: 48px; }
.special-follow { position: absolute; right: -1px; bottom: 0; color: #ffb300; font-size: 12px; }
.entry-icon { display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 50%; background: var(--surface-hover); color: var(--text-secondary); font-size: 24px; }
.updated-users-icon { border-radius: 12px; color: var(--text-primary); }
.entity-icon { width: 48px; height: 48px; }
.updated-user-name { width: 60px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; line-height: 20px; text-align: center; }
</style>
