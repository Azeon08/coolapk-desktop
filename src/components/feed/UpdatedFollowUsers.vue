<template>
  <section v-if="users.length" class="updated-follow-users" aria-label="有更新的酷友">
    <div class="updates-heading">
      <h3>有更新的酷友 <span>{{ users.length }}</span></h3>
      <button v-if="users.length > previewCount" type="button" class="updates-expand" :aria-expanded="expanded" @click="expanded = !expanded">
        {{ expanded ? '收起' : '查看全部' }} <i :class="expanded ? 'fas fa-chevron-up' : 'fas fa-chevron-right'" aria-hidden="true"></i>
      </button>
    </div>
    <p class="updates-description">最近 24 小时 · 根据已加载的关注动态汇总</p>
    <div :class="['updates-list', 'custom-scrollbar', { expanded }]">
      <button v-for="user in visibleUsers" :key="user.uid" type="button" class="updated-user" :aria-label="`进入 ${user.username} 的主页`" @click="router.push(`/user/${user.uid}`)">
        <AppAvatar :src="user.avatar" :plugin-url="user.pluginUrl" :size="52" />
        <span class="updated-user-name">{{ user.username }}</span>
        <span class="updated-user-time">{{ updateTime(user.dateline) }}</span>
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import { collectUpdatedFollowUsers } from '../../utils/followUpdates';
import AppAvatar from '../common/AppAvatar.vue';

const props = defineProps<{ feeds: any[] }>();
const router = useRouter();
const authStore = useAuthStore();
const previewCount = 10;
const expanded = ref(false);
const now = ref(Date.now());
const users = computed(() => authStore.isLoggedIn
  ? collectUpdatedFollowUsers(props.feeds, String(authStore.user?.uid || ''), now.value)
  : []);
const visibleUsers = computed(() => expanded.value ? users.value : users.value.slice(0, previewCount));
let timer: ReturnType<typeof setInterval> | undefined;

function stopTimer() {
  clearInterval(timer);
  timer = undefined;
}

function startTimer() {
  stopTimer();
  now.value = Date.now();
  timer = setInterval(() => { now.value = Date.now(); }, 60_000);
}

function updateTime(dateline: number) {
  const minutes = Math.floor((now.value / 1000 - dateline) / 60);
  if (minutes < 1) return '刚刚更新';
  if (minutes < 60) return `${minutes} 分钟前`;
  return `${Math.floor(minutes / 60)} 小时前`;
}

onMounted(startTimer);
onActivated(startTimer);
onDeactivated(stopTimer);
onUnmounted(stopTimer);
</script>

<style scoped>
.updated-follow-users {
  min-width: 0;
  margin: var(--space-3) var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-card);
  background: var(--surface);
}
.updates-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.updates-heading h3 { margin: 0; font-size: 16px; color: var(--text-primary); }
.updates-heading h3 span { margin-left: 4px; font-size: 12px; color: var(--text-tertiary); font-weight: normal; }
.updates-expand { flex-shrink: 0; border: none; background: transparent; padding: 8px; font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.updates-description { margin: 6px 0 14px; font-size: 11px; color: var(--text-tertiary); }
.updates-list { display: flex; gap: 12px; overflow-x: auto; padding: 4px 0 8px; }
.updates-list.expanded { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); overflow-x: visible; }
.updated-user { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 0 0 72px; min-width: 0; border: none; border-radius: var(--radius-md); padding: 4px; background: transparent; color: var(--text-primary); cursor: pointer; }
.updated-user:hover { background: var(--surface-hover); }
.updated-user-name { max-width: 100%; width: 64px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 12px; }
.updated-user-time { white-space: nowrap; font-size: 10px; color: var(--text-tertiary); }
@media (max-width: 900px) {
  .updated-follow-users { margin: var(--space-2) var(--space-3); padding: var(--space-3); }
}
</style>
