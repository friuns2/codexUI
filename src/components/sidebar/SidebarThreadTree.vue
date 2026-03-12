<template>
  <section class="thread-tree-root">
    <section v-if="pinnedThreads.length > 0" class="pinned-section">
      <ul class="thread-list">
        <li v-for="thread in pinnedThreads" :key="thread.id" class="thread-row-item">
          <SidebarMenuRow
            class="thread-row"
            :data-active="thread.id === selectedThreadId"
            :data-pinned="isPinned(thread.id)"
            @mouseleave="onThreadRowLeave(thread.id)"
          >
            <template #left>
              <span class="thread-left-stack">
                <span v-if="thread.inProgress || thread.unread" class="thread-status-indicator" :data-state="getThreadState(thread)" />
                <button class="thread-pin-button" type="button" title="pin" @click="togglePin(thread.id)">
                  <IconTablerPin class="thread-icon" />
                </button>
              </span>
            </template>
            <button class="thread-main-button" type="button" @click="onSelect(thread.id)">
              <span class="thread-row-title-wrap">
                <span class="thread-row-title">{{ thread.title }}</span>
                <IconTablerGitFork v-if="thread.hasWorktree" class="thread-row-worktree-icon" title="Worktree thread" />
              </span>
            </button>
            <template #right>
              <span class="thread-row-time">{{ formatRelative(thread.createdAtIso || thread.updatedAtIso) }}</span>
            </template>
            <template #right-hover>
              <div :ref="(el) => setThreadMenuWrapRef(thread.id, el)" class="thread-menu-wrap">
                <button
                  class="thread-menu-trigger"
                  type="button"
                  title="thread_menu"
                  @click.stop="toggleThreadMenu(thread.id)"
                >
                  <IconTablerDots class="thread-icon" />
                </button>
                <div v-if="isThreadMenuOpen(thread.id)" class="thread-menu-panel" @click.stop>
                  <button class="thread-menu-item" type="button" @click="openRenameThreadDialog(thread.id, thread.title)">
                    Rename thread
                  </button>
                  <button class="thread-menu-item thread-menu-item-danger" type="button" @click="openDeleteThreadDialog(thread.id, thread.title)">
                    Delete thread
                  </button>
                </div>
              </div>
            </template>
          </SidebarMenuRow>
        </li>
      </ul>
    </section>

    <SidebarMenuRow as="header" class="thread-tree-header-row">
      <span class="thread-tree-header">Threads</span>
      <template #right>
        <div ref="organizeMenuWrapRef" class="organize-menu-wrap">
          <button
            class="organize-menu-trigger"
            type="button"
            :aria-expanded="isOrganizeMenuOpen"
            aria-label="Organize threads"
            title="Organize threads"
            @click="toggleOrganizeMenu"
          >
            <IconTablerDots class="thread-icon" />
          </button>

          <div v-if="isOrganizeMenuOpen" class="organize-menu-panel" @click.stop>
            <p class="organize-menu-title">Organize</p>
            <button
              class="organize-menu-item"
              :data-active="threadViewMode === 'project'"
              type="button"
              @click="setThreadViewMode('project')"
            >
              <span>By project</span>
              <span v-if="threadViewMode === 'project'">✓</span>
            </button>
            <button
              class="organize-menu-item"
              :data-active="threadViewMode === 'chronological'"
              type="button"
              @click="setThreadViewMode('chronological')"
            >
              <span>Chronological list</span>
              <span v-if="threadViewMode === 'chronological'">✓</span>
            </button>
          </div>
        </div>
      </template>
    </SidebarMenuRow>

    <p v-if="isSearchActive && filteredGroups.length === 0" class="thread-tree-no-results">No matching threads</p>

    <p v-else-if="isLoading && groups.length === 0" class="thread-tree-loading">Loading threads...</p>

    <ul v-else-if="isChronologicalView" class="thread-list thread-list-global">
      <li v-for="thread in globalThreads" :key="thread.id" class="thread-row-item">
        <SidebarMenuRow
          class="thread-row"
          :data-active="thread.id === selectedThreadId"
          :data-pinned="isPinned(thread.id)"
          @mouseleave="onThreadRowLeave(thread.id)"
        >
          <template #left>
            <span class="thread-left-stack">
              <span
                v-if="thread.inProgress || thread.unread"
                class="thread-status-indicator"
                :data-state="getThreadState(thread)"
              />
              <button class="thread-pin-button" type="button" title="pin" @click="togglePin(thread.id)">
                <IconTablerPin class="thread-icon" />
              </button>
            </span>
          </template>
          <button class="thread-main-button" type="button" @click="onSelect(thread.id)">
            <span class="thread-row-title-wrap">
              <span class="thread-row-title">{{ thread.title }}</span>
              <IconTablerGitFork v-if="thread.hasWorktree" class="thread-row-worktree-icon" title="Worktree thread" />
            </span>
          </button>
          <template #right>
            <span class="thread-row-time">{{ formatRelative(thread.createdAtIso || thread.updatedAtIso) }}</span>
          </template>
          <template #right-hover>
            <div :ref="(el) => setThreadMenuWrapRef(thread.id, el)" class="thread-menu-wrap">
              <button
                class="thread-menu-trigger"
                type="button"
                title="thread_menu"
                @click.stop="toggleThreadMenu(thread.id)"
              >
                <IconTablerDots class="thread-icon" />
              </button>
              <div v-if="isThreadMenuOpen(thread.id)" class="thread-menu-panel" @click.stop>
                <button class="thread-menu-item" type="button" @click="openRenameThreadDialog(thread.id, thread.title)">
                  Rename thread
                </button>
                <button class="thread-menu-item thread-menu-item-danger" type="button" @click="openDeleteThreadDialog(thread.id, thread.title)">
                  Delete thread
                </button>
              </div>
            </div>
          </template>
        </SidebarMenuRow>
      </li>
    </ul>

    <div v-else ref="groupsContainerRef" class="thread-tree-groups" :style="groupsContainerStyle">
      <article
        v-for="group in filteredGroups"
        :key="group.projectName"
        :ref="(el) => setProjectGroupRef(group.projectName, el)"
        class="project-group"
        :data-project-name="group.projectName"
        :data-expanded="!isCollapsed(group.projectName)"
        :data-dragging="isDraggingProject(group.projectName)"
        :style="projectGroupStyle(group.projectName)"
      >
          <SidebarMenuRow
            as="div"
            class="project-header-row"
            role="button"
            tabindex="0"
            @click="toggleProjectCollapse(group.projectName)"
            @keydown="onProjectHeaderKeyDown($event, group.projectName)"
            @keydown.enter.prevent="toggleProjectCollapse(group.projectName)"
            @keydown.space.prevent="toggleProjectCollapse(group.projectName)"
          >
            <template #left>
              <span class="project-icon-stack">
                <span class="project-icon-folder">
                  <IconTablerFolder v-if="isCollapsed(group.projectName)" class="thread-icon" />
                  <IconTablerFolderOpen v-else class="thread-icon" />
                </span>
                <span class="project-icon-chevron">
                  <IconTablerChevronRight v-if="isCollapsed(group.projectName)" class="thread-icon" />
                  <IconTablerChevronDown v-else class="thread-icon" />
                </span>
              </span>
            </template>
            <span
              class="project-main-button"
              :data-dragging-handle="isDraggingProject(group.projectName)"
              @mousedown.left="onProjectHandleMouseDown($event, group.projectName)"
            >
              <span class="project-title">{{ getProjectDisplayName(group.projectName) }}</span>
            </span>
            <template #right>
              <div class="project-hover-controls">
                <div :ref="(el) => setProjectMenuWrapRef(group.projectName, el)" class="project-menu-wrap">
                  <button
                    class="project-menu-trigger"
                    type="button"
                    title="project_menu"
                    @click.stop="toggleProjectMenu(group.projectName)"
                  >
                    <IconTablerDots class="thread-icon" />
                  </button>

                  <div v-if="isProjectMenuOpen(group.projectName)" class="project-menu-panel" @click.stop>
                    <template v-if="projectMenuMode === 'actions'">
                      <button class="project-menu-item" type="button" @click="openRenameProjectMenu(group.projectName)">
                        Edit name
                      </button>
                      <button
                        class="project-menu-item project-menu-item-danger"
                        type="button"
                        @click="onRemoveProject(group.projectName)"
                      >
                        Remove
                      </button>
                    </template>
                    <template v-else>
                      <label class="project-menu-label">Project name</label>
                      <input
                        v-model="projectRenameDraft"
                        class="project-menu-input"
                        type="text"
                        @input="onProjectNameInput(group.projectName)"
                      />
                    </template>
                  </div>
                </div>

                <button
                  class="thread-start-button"
                  type="button"
                  :aria-label="getNewThreadButtonAriaLabel(group.projectName)"
                  :title="getNewThreadButtonAriaLabel(group.projectName)"
                  @click.stop="onStartNewThread(group.projectName)"
                >
                  <IconTablerFilePencil class="thread-icon" />
                </button>
              </div>
            </template>
          </SidebarMenuRow>

          <ul v-if="hasThreads(group)" class="thread-list">
            <li v-for="thread in visibleThreads(group)" :key="thread.id" class="thread-row-item">
              <SidebarMenuRow
                class="thread-row"
                :data-active="thread.id === selectedThreadId"
                :data-pinned="isPinned(thread.id)"
                @mouseleave="onThreadRowLeave(thread.id)"
              >
                <template #left>
                  <span class="thread-left-stack">
                    <span
                      v-if="thread.inProgress || thread.unread"
                      class="thread-status-indicator"
                      :data-state="getThreadState(thread)"
                    />
                    <button class="thread-pin-button" type="button" title="pin" @click="togglePin(thread.id)">
                      <IconTablerPin class="thread-icon" />
                    </button>
                  </span>
                </template>
                <button class="thread-main-button" type="button" @click="onSelect(thread.id)">
                  <span class="thread-row-title-wrap">
                    <span class="thread-row-title">{{ thread.title }}</span>
                    <IconTablerGitFork v-if="thread.hasWorktree" class="thread-row-worktree-icon" title="Worktree thread" />
                  </span>
                </button>
                <template #right>
                  <span class="thread-row-time">{{ formatRelative(thread.createdAtIso || thread.updatedAtIso) }}</span>
                </template>
                <template #right-hover>
                  <div :ref="(el) => setThreadMenuWrapRef(thread.id, el)" class="thread-menu-wrap">
                    <button
                      class="thread-menu-trigger"
                      type="button"
                      title="thread_menu"
                      @click.stop="toggleThreadMenu(thread.id)"
                    >
                      <IconTablerDots class="thread-icon" />
                    </button>
                    <div v-if="isThreadMenuOpen(thread.id)" class="thread-menu-panel" @click.stop>
                      <button class="thread-menu-item" type="button" @click="openRenameThreadDialog(thread.id, thread.title)">
                        Rename thread
                      </button>
                      <button class="thread-menu-item thread-menu-item-danger" type="button" @click="openDeleteThreadDialog(thread.id, thread.title)">
                        Delete thread
                      </button>
                    </div>
                  </div>
                </template>
              </SidebarMenuRow>
            </li>
          </ul>

          <SidebarMenuRow v-else as="p" class="project-empty-row">
            <template #left>
              <span class="project-empty-spacer" />
            </template>
            <span class="project-empty">No threads</span>
          </SidebarMenuRow>

          <SidebarMenuRow v-if="hasHiddenThreads(group)" class="thread-show-more-row">
            <template #left>
              <span class="thread-show-more-spacer" />
            </template>
            <button class="thread-show-more-button" type="button" @click="toggleProjectExpansion(group.projectName)">
              {{ isExpanded(group.projectName) ? 'Show less' : 'Show more' }}
            </button>
          </SidebarMenuRow>
      </article>
    </div>

    <Teleport to="body">
      <div v-if="renameThreadDialogVisible" class="rename-thread-overlay" @click.self="closeRenameThreadDialog">
        <div class="rename-thread-panel" role="dialog" aria-modal="true" aria-label="Thread title">
          <h3 class="rename-thread-title">Rename thread</h3>
          <p class="rename-thread-subtitle">Make it short and recognizable.</p>
          <input
            ref="renameThreadInputRef"
            v-model="renameThreadDraft"
            class="rename-thread-input"
            type="text"
            placeholder="Add title..."
            @keydown.enter.prevent="submitRenameThread"
            @keydown.esc.prevent="closeRenameThreadDialog"
          />
          <div class="rename-thread-actions">
            <button class="rename-thread-button" type="button" @click="closeRenameThreadDialog">Cancel</button>
            <button class="rename-thread-button rename-thread-button-primary" type="button" @click="submitRenameThread">Save</button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="deleteThreadDialogVisible" class="rename-thread-overlay" @click.self="closeDeleteThreadDialog">
        <div class="rename-thread-panel" role="dialog" aria-modal="true" aria-label="Delete thread">
          <h3 class="rename-thread-title">Delete thread?</h3>
          <p class="rename-thread-subtitle">
            This will archive the thread "{{ deleteThreadTitle }}". You can find it later in archived threads.
          </p>
          <div class="rename-thread-actions">
            <button class="rename-thread-button" type="button" @click="closeDeleteThreadDialog">Cancel</button>
            <button class="rename-thread-button rename-thread-button-danger" type="button" @click="submitDeleteThread">Delete</button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { UiProjectGroup, UiThread } from '../../types/codex'
import IconTablerChevronDown from '../icons/IconTablerChevronDown.vue'
import IconTablerChevronRight from '../icons/IconTablerChevronRight.vue'
import IconTablerDots from '../icons/IconTablerDots.vue'
import IconTablerFilePencil from '../icons/IconTablerFilePencil.vue'
import IconTablerFolder from '../icons/IconTablerFolder.vue'
import IconTablerFolderOpen from '../icons/IconTablerFolderOpen.vue'
import IconTablerGitFork from '../icons/IconTablerGitFork.vue'
import IconTablerPin from '../icons/IconTablerPin.vue'
import SidebarMenuRow from './SidebarMenuRow.vue'

const props = defineProps<{
  groups: UiProjectGroup[]
  projectDisplayNameById: Record<string, string>
  selectedThreadId: string
  isLoading: boolean
  searchQuery: string
}>()

const emit = defineEmits<{
  select: [threadId: string]
  archive: [threadId: string]
  'start-new-thread': [projectName: string]
  'rename-project': [payload: { projectName: string; displayName: string }]
  'rename-thread': [payload: { threadId: string; title: string }]
  'remove-project': [projectName: string]
  'reorder-project': [payload: { projectName: string; toIndex: number }]
}>()

type PendingProjectDrag = {
  projectName: string
  fromIndex: number
  startClientX: number
  startClientY: number
  pointerOffsetY: number
  groupLeft: number
  groupWidth: number
  groupHeight: number
  groupOuterHeight: number
}

type ActiveProjectDrag = {
  projectName: string
  fromIndex: number
  pointerOffsetY: number
  groupLeft: number
  groupWidth: number
  groupHeight: number
  groupOuterHeight: number
  ghostTop: number
  dropTargetIndexFull: number | null
}

type DragPointerSample = {
  clientX: number
  clientY: number
}

const DRAG_START_THRESHOLD_PX = 4
const PROJECT_GROUP_EXPANDED_GAP_PX = 6
const expandedProjects = ref<Record<string, boolean>>({})
const collapsedProjects = ref<Record<string, boolean>>({})
const pinnedThreadIds = ref<string[]>([])
const openProjectMenuId = ref('')
const openThreadMenuId = ref('')
const projectMenuMode = ref<'actions' | 'rename'>('actions')
const projectRenameDraft = ref('')
const renameThreadDialogVisible = ref(false)
const renameThreadDialogThreadId = ref('')
const renameThreadDraft = ref('')
const renameThreadInputRef = ref<HTMLInputElement | null>(null)
const deleteThreadDialogVisible = ref(false)
const deleteThreadDialogThreadId = ref('')
const deleteThreadTitle = ref('')
const groupsContainerRef = ref<HTMLElement | null>(null)
const pendingProjectDrag = ref<PendingProjectDrag | null>(null)
const activeProjectDrag = ref<ActiveProjectDrag | null>(null)
let pendingDragPointerSample: DragPointerSample | null = null
let dragPointerRafId: number | null = null
const suppressNextProjectToggleId = ref('')
const measuredHeightByProject = ref<Record<string, number>>({})
const projectGroupElementByName = new Map<string, HTMLElement>()
const projectMenuWrapElementByName = new Map<string, HTMLElement>()
const threadMenuWrapElementById = new Map<string, HTMLElement>()
const projectNameByElement = new WeakMap<HTMLElement, string>()
const organizeMenuWrapRef = ref<HTMLElement | null>(null)
const isOrganizeMenuOpen = ref(false)
const THREAD_VIEW_MODE_STORAGE_KEY = 'codex-web-local.thread-view-mode.v1'
const threadViewMode = ref<'project' | 'chronological'>(loadThreadViewMode())
const projectGroupResizeObserver =
  typeof window !== 'undefined'
    ? new ResizeObserver((entries) => {
        for (const entry of entries) {
          const element = entry.target as HTMLElement
          const projectName = projectNameByElement.get(element)
          if (!projectName) continue
          updateMeasuredProjectHeight(projectName, element)
        }
      })
    : null
const COLLAPSED_STORAGE_KEY = 'codex-web-local.collapsed-projects.v1'

function loadCollapsedState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, boolean>
  } catch {
    return {}
  }
}

function loadThreadViewMode(): 'project' | 'chronological' {
  if (typeof window === 'undefined') return 'project'

  const raw = window.localStorage.getItem(THREAD_VIEW_MODE_STORAGE_KEY)
  return raw === 'chronological' ? 'chronological' : 'project'
}

collapsedProjects.value = loadCollapsedState()

watch(
  collapsedProjects,
  (value) => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(value))
  },
  { deep: true },
)

watch(threadViewMode, (value) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(THREAD_VIEW_MODE_STORAGE_KEY, value)
})

const normalizedSearchQuery = computed(() => props.searchQuery.trim().toLowerCase())

const isSearchActive = computed(() => normalizedSearchQuery.value.length > 0)

function threadMatchesSearch(thread: UiThread): boolean {
  if (!isSearchActive.value) return true
  const q = normalizedSearchQuery.value
  return (
    thread.title.toLowerCase().includes(q) ||
    thread.preview.toLowerCase().includes(q)
  )
}

const filteredGroups = computed<UiProjectGroup[]>(() => {
  if (!isSearchActive.value) return props.groups
  return props.groups
    .map((group) => ({
      ...group,
      threads: group.threads.filter(threadMatchesSearch),
    }))
    .filter((group) => group.threads.length > 0)
})

const isChronologicalView = computed(() => threadViewMode.value === 'chronological')

const globalThreads = computed<UiThread[]>(() => {
  const sourceGroups = filteredGroups.value
  const rows: UiThread[] = []

  for (const group of sourceGroups) {
    for (const thread of group.threads) {
      if (isPinned(thread.id)) continue
      rows.push(thread)
    }
  }

  return rows.sort((first, second) => {
    const firstTimestamp = new Date(first.updatedAtIso || first.createdAtIso).getTime()
    const secondTimestamp = new Date(second.updatedAtIso || second.createdAtIso).getTime()
    return secondTimestamp - firstTimestamp
  })
})

const threadById = computed(() => {
  const map = new Map<string, UiThread>()

  for (const group of props.groups) {
    for (const thread of group.threads) {
      map.set(thread.id, thread)
    }
  }

  return map
})

const pinnedThreads = computed(() =>
  pinnedThreadIds.value
    .map((threadId) => threadById.value.get(threadId) ?? null)
    .filter((thread): thread is UiThread => thread !== null)
    .filter(threadMatchesSearch),
)

const projectedDropProjectIndex = computed<number | null>(() => {
  const drag = activeProjectDrag.value
  if (!drag || drag.dropTargetIndexFull === null || props.groups.length === 0) return null

  const boundedDropIndex = Math.max(0, Math.min(drag.dropTargetIndexFull, props.groups.length))
  const projectedIndex = boundedDropIndex > drag.fromIndex ? boundedDropIndex - 1 : boundedDropIndex
  const boundedProjectedIndex = Math.max(0, Math.min(projectedIndex, props.groups.length - 1))
  return boundedProjectedIndex === drag.fromIndex ? null : boundedProjectedIndex
})

const layoutProjectOrder = computed<string[]>(() => {
  const sourceGroups = isSearchActive.value ? filteredGroups.value : props.groups
  const names = sourceGroups.map((group) => group.projectName)
  const drag = activeProjectDrag.value
  const projectedIndex = projectedDropProjectIndex.value

  if (!drag || projectedIndex === null) {
    return names
  }

  const next = [...names]
  const [movedProject] = next.splice(drag.fromIndex, 1)
  if (!movedProject) {
    return names
  }
  next.splice(projectedIndex, 0, movedProject)
  return next
})

const layoutTopByProject = computed<Record<string, number>>(() => {
  const topByProject: Record<string, number> = {}
  let currentTop = 0

  for (const projectName of layoutProjectOrder.value) {
    topByProject[projectName] = currentTop
    currentTop += getProjectOuterHeight(projectName)
  }

  return topByProject
})

const groupsContainerStyle = computed<Record<string, string>>(() => {
  let totalHeight = 0
  for (const projectName of layoutProjectOrder.value) {
    totalHeight += getProjectOuterHeight(projectName)
  }

  return {
    height: `${Math.max(0, totalHeight)}px`,
  }
})

function formatRelative(value: string): string {
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return 'n/a'

  const diffMs = Math.abs(Date.now() - timestamp)
  if (diffMs < 60000) return 'now'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  return `${days}d`
}

function isPinned(threadId: string): boolean {
  return pinnedThreadIds.value.includes(threadId)
}

function togglePin(threadId: string): void {
  if (isPinned(threadId)) {
    pinnedThreadIds.value = pinnedThreadIds.value.filter((id) => id !== threadId)
    return
  }

  pinnedThreadIds.value = [threadId, ...pinnedThreadIds.value]
}

function onSelect(threadId: string): void {
  emit('select', threadId)
}

function getNewThreadButtonAriaLabel(projectName: string): string {
  return `start new thread ${getProjectDisplayName(projectName)}`
}

function onStartNewThread(projectName: string): void {
  emit('start-new-thread', projectName)
}

function onThreadRowLeave(threadId: string): void {
  if (openThreadMenuId.value === threadId) {
    closeThreadMenu()
  }
}

function isThreadMenuOpen(threadId: string): boolean {
  return openThreadMenuId.value === threadId
}

function closeThreadMenu(): void {
  openThreadMenuId.value = ''
}

function toggleThreadMenu(threadId: string): void {
  if (openThreadMenuId.value === threadId) {
    closeThreadMenu()
    return
  }
  openThreadMenuId.value = threadId
}

function openRenameThreadDialog(threadId: string, currentTitle: string): void {
  renameThreadDialogThreadId.value = threadId
  renameThreadDraft.value = currentTitle
  renameThreadDialogVisible.value = true
  closeThreadMenu()
  nextTick(() => {
    renameThreadInputRef.value?.focus()
    renameThreadInputRef.value?.select()
  })
}

function closeRenameThreadDialog(): void {
  renameThreadDialogVisible.value = false
  renameThreadDialogThreadId.value = ''
  renameThreadDraft.value = ''
}

function submitRenameThread(): void {
  const threadId = renameThreadDialogThreadId.value
  const title = renameThreadDraft.value.trim()
  if (!threadId || !title) return
  emit('rename-thread', { threadId, title })
  closeRenameThreadDialog()
}

function openDeleteThreadDialog(threadId: string, currentTitle: string): void {
  deleteThreadDialogThreadId.value = threadId
  deleteThreadTitle.value = currentTitle
  deleteThreadDialogVisible.value = true
  closeThreadMenu()
}

function closeDeleteThreadDialog(): void {
  deleteThreadDialogVisible.value = false
  deleteThreadDialogThreadId.value = ''
  deleteThreadTitle.value = ''
}

function submitDeleteThread(): void {
  const threadId = deleteThreadDialogThreadId.value
  if (!threadId) return
  pinnedThreadIds.value = pinnedThreadIds.value.filter((id) => id !== threadId)
  emit('archive', threadId)
  closeDeleteThreadDialog()
}

function getProjectDisplayName(projectName: string): string {
  return props.projectDisplayNameById[projectName] ?? projectName
}

function isProjectMenuOpen(projectName: string): boolean {
  return openProjectMenuId.value === projectName
}

function closeProjectMenu(): void {
  openProjectMenuId.value = ''
  projectMenuMode.value = 'actions'
  projectRenameDraft.value = ''
}

function toggleOrganizeMenu(): void {
  isOrganizeMenuOpen.value = !isOrganizeMenuOpen.value
}

function setThreadViewMode(mode: 'project' | 'chronological'): void {
  threadViewMode.value = mode
  isOrganizeMenuOpen.value = false
}

function toggleProjectMenu(projectName: string): void {
  if (openProjectMenuId.value === projectName) {
    closeProjectMenu()
    return
  }

  openProjectMenuId.value = projectName
  projectMenuMode.value = 'actions'
  projectRenameDraft.value = getProjectDisplayName(projectName)
}

function openRenameProjectMenu(projectName: string): void {
  openProjectMenuId.value = projectName
  projectMenuMode.value = 'rename'
  projectRenameDraft.value = getProjectDisplayName(projectName)
}

function onProjectNameInput(projectName: string): void {
  emit('rename-project', {
    projectName,
    displayName: projectRenameDraft.value,
  })
}

function onRemoveProject(projectName: string): void {
  emit('remove-project', projectName)
  closeProjectMenu()
}

function onProjectHeaderKeyDown(event: KeyboardEvent, projectName: string): void {
  if (!event.altKey) return
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return

  const currentIndex = props.groups.findIndex((group) => group.projectName === projectName)
  if (currentIndex < 0) return

  const delta = event.key === 'ArrowUp' ? -1 : 1
  const targetIndex = Math.max(0, Math.min(currentIndex + delta, props.groups.length - 1))
  if (targetIndex === currentIndex) return

  event.preventDefault()
  emit('reorder-project', {
    projectName,
    toIndex: targetIndex,
  })
}

function isExpanded(projectName: string): boolean {
  return expandedProjects.value[projectName] === true
}

function isCollapsed(projectName: string): boolean {
  return collapsedProjects.value[projectName] === true
}

function toggleProjectExpansion(projectName: string): void {
  expandedProjects.value = {
    ...expandedProjects.value,
    [projectName]: !isExpanded(projectName),
  }
}

function toggleProjectCollapse(projectName: string): void {
  if (suppressNextProjectToggleId.value === projectName) {
    suppressNextProjectToggleId.value = ''
    return
  }

  collapsedProjects.value = {
    ...collapsedProjects.value,
    [projectName]: !isCollapsed(projectName),
  }
}

function getProjectOuterHeight(projectName: string): number {
  const measuredHeight = measuredHeightByProject.value[projectName] ?? 0
  const drag = activeProjectDrag.value
  const dragHeight = drag?.projectName === projectName ? drag.groupHeight : null
  const baseHeight = dragHeight ?? measuredHeight
  const gap = isCollapsed(projectName) ? 0 : PROJECT_GROUP_EXPANDED_GAP_PX
  return Math.max(0, baseHeight + gap)
}

function setProjectMenuWrapRef(projectName: string, element: Element | ComponentPublicInstance | null): void {
  const htmlElement =
    element instanceof HTMLElement
      ? element
      : element && '$el' in element && element.$el instanceof HTMLElement
        ? element.$el
        : null

  if (htmlElement) {
    projectMenuWrapElementByName.set(projectName, htmlElement)
    return
  }

  projectMenuWrapElementByName.delete(projectName)
}

function setThreadMenuWrapRef(threadId: string, element: Element | ComponentPublicInstance | null): void {
  const htmlElement =
    element instanceof HTMLElement
      ? element
      : element && '$el' in element && element.$el instanceof HTMLElement
        ? element.$el
        : null

  if (htmlElement) {
    threadMenuWrapElementById.set(threadId, htmlElement)
    return
  }

  threadMenuWrapElementById.delete(threadId)
}

function isEventInsideOpenProjectMenu(event: Event): boolean {
  const projectName = openProjectMenuId.value
  if (!projectName) return false

  const openMenuWrapElement = projectMenuWrapElementByName.get(projectName)
  if (!openMenuWrapElement) return false

  const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (eventPath.includes(openMenuWrapElement)) return true

  const target = event.target
  return target instanceof Node ? openMenuWrapElement.contains(target) : false
}

function isEventInsideOpenThreadMenu(event: Event): boolean {
  const threadId = openThreadMenuId.value
  if (!threadId) return false

  const openMenuWrapElement = threadMenuWrapElementById.get(threadId)
  if (!openMenuWrapElement) return false

  const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : []
  if (eventPath.includes(openMenuWrapElement)) return true

  const target = event.target
  return target instanceof Node ? openMenuWrapElement.contains(target) : false
}

function onProjectMenuPointerDown(event: PointerEvent): void {
  if (isOrganizeMenuOpen.value) {
    const organizeElement = organizeMenuWrapRef.value
    const eventPath = typeof event.composedPath === 'function' ? event.composedPath() : []
    const isInsideOrganizeMenu =
      !!organizeElement &&
      (eventPath.includes(organizeElement) || (event.target instanceof Node && organizeElement.contains(event.target)))

    if (!isInsideOrganizeMenu) {
      isOrganizeMenuOpen.value = false
    }
  }

  if (!openProjectMenuId.value) return
  if (!isEventInsideOpenProjectMenu(event)) {
    closeProjectMenu()
  }

  if (!openThreadMenuId.value) return
  if (isEventInsideOpenThreadMenu(event)) return
  closeThreadMenu()
}

function onProjectMenuFocusIn(event: FocusEvent): void {
  if (openProjectMenuId.value && !isEventInsideOpenProjectMenu(event)) {
    closeProjectMenu()
  }
  if (openThreadMenuId.value && !isEventInsideOpenThreadMenu(event)) {
    closeThreadMenu()
  }
}

function onWindowBlurForProjectMenu(): void {
  if (isOrganizeMenuOpen.value) {
    isOrganizeMenuOpen.value = false
  }
  if (openProjectMenuId.value) {
    closeProjectMenu()
  }
  if (openThreadMenuId.value) {
    closeThreadMenu()
  }
}

function bindProjectMenuDismissListeners(): void {
  window.addEventListener('pointerdown', onProjectMenuPointerDown, { capture: true })
  window.addEventListener('focusin', onProjectMenuFocusIn, { capture: true })
  window.addEventListener('blur', onWindowBlurForProjectMenu)
}

function unbindProjectMenuDismissListeners(): void {
  window.removeEventListener('pointerdown', onProjectMenuPointerDown, { capture: true })
  window.removeEventListener('focusin', onProjectMenuFocusIn, { capture: true })
  window.removeEventListener('blur', onWindowBlurForProjectMenu)
}

function updateMeasuredProjectHeight(projectName: string, element: HTMLElement): void {
  const nextHeight = element.getBoundingClientRect().height
  if (!Number.isFinite(nextHeight) || nextHeight <= 0) return

  const previousHeight = measuredHeightByProject.value[projectName]
  if (previousHeight !== undefined && Math.abs(previousHeight - nextHeight) < 0.5) {
    return
  }

  measuredHeightByProject.value = {
    ...measuredHeightByProject.value,
    [projectName]: nextHeight,
  }
}

function setProjectGroupRef(projectName: string, element: Element | ComponentPublicInstance | null): void {
  const previousElement = projectGroupElementByName.get(projectName)
  if (previousElement && previousElement !== element && projectGroupResizeObserver) {
    projectGroupResizeObserver.unobserve(previousElement)
  }

  const htmlElement =
    element instanceof HTMLElement
      ? element
      : element && '$el' in element && element.$el instanceof HTMLElement
        ? element.$el
        : null

  if (htmlElement) {
    projectGroupElementByName.set(projectName, htmlElement)
    projectNameByElement.set(htmlElement, projectName)
    updateMeasuredProjectHeight(projectName, htmlElement)
    projectGroupResizeObserver?.observe(htmlElement)
    return
  }

  if (previousElement) {
    projectGroupResizeObserver?.unobserve(previousElement)
  }

  projectGroupElementByName.delete(projectName)
}

function onProjectHandleMouseDown(event: MouseEvent, projectName: string): void {
  if (event.button !== 0) return
  if (pendingProjectDrag.value || activeProjectDrag.value) return

  const fromIndex = props.groups.findIndex((group) => group.projectName === projectName)
  const projectGroupElement = projectGroupElementByName.get(projectName)
  if (fromIndex < 0 || !projectGroupElement) return

  const groupRect = projectGroupElement.getBoundingClientRect()
  const groupGap = isCollapsed(projectName) ? 0 : PROJECT_GROUP_EXPANDED_GAP_PX
  pendingProjectDrag.value = {
    projectName,
    fromIndex,
    startClientX: event.clientX,
    startClientY: event.clientY,
    pointerOffsetY: event.clientY - groupRect.top,
    groupLeft: groupRect.left,
    groupWidth: groupRect.width,
    groupHeight: groupRect.height,
    groupOuterHeight: groupRect.height + groupGap,
  }

  event.preventDefault()
  bindProjectDragListeners()
}

function bindProjectDragListeners(): void {
  window.addEventListener('mousemove', onProjectDragMouseMove)
  window.addEventListener('mouseup', onProjectDragMouseUp)
  window.addEventListener('keydown', onProjectDragKeyDown)
}

function unbindProjectDragListeners(): void {
  window.removeEventListener('mousemove', onProjectDragMouseMove)
  window.removeEventListener('mouseup', onProjectDragMouseUp)
  window.removeEventListener('keydown', onProjectDragKeyDown)
}

function onProjectDragMouseMove(event: MouseEvent): void {
  pendingDragPointerSample = {
    clientX: event.clientX,
    clientY: event.clientY,
  }
  scheduleProjectDragPointerFrame()
}

function onProjectDragMouseUp(event: MouseEvent): void {
  processProjectDragPointerSample({
    clientX: event.clientX,
    clientY: event.clientY,
  })

  const drag = activeProjectDrag.value
  if (drag && projectedDropProjectIndex.value !== null) {
    const currentProjectIndex = props.groups.findIndex((group) => group.projectName === drag.projectName)
    if (currentProjectIndex >= 0) {
      const toIndex = projectedDropProjectIndex.value
      if (toIndex !== currentProjectIndex) {
        emit('reorder-project', {
          projectName: drag.projectName,
          toIndex,
        })
      }
    }
  }

  resetProjectDragState()
}

function onProjectDragKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  if (!pendingProjectDrag.value && !activeProjectDrag.value) return

  event.preventDefault()
  resetProjectDragState()
}

function resetProjectDragState(): void {
  if (dragPointerRafId !== null) {
    window.cancelAnimationFrame(dragPointerRafId)
    dragPointerRafId = null
  }
  pendingDragPointerSample = null
  pendingProjectDrag.value = null
  activeProjectDrag.value = null
  suppressNextProjectToggleId.value = ''
  unbindProjectDragListeners()
}

function scheduleProjectDragPointerFrame(): void {
  if (dragPointerRafId !== null) return

  dragPointerRafId = window.requestAnimationFrame(() => {
    dragPointerRafId = null
    if (!pendingDragPointerSample) return

    const sample = pendingDragPointerSample
    pendingDragPointerSample = null
    processProjectDragPointerSample(sample)
  })
}

function processProjectDragPointerSample(sample: DragPointerSample): void {
  const pending = pendingProjectDrag.value
  if (!activeProjectDrag.value && pending) {
    const deltaX = sample.clientX - pending.startClientX
    const deltaY = sample.clientY - pending.startClientY
    const distance = Math.hypot(deltaX, deltaY)
    if (distance < DRAG_START_THRESHOLD_PX) {
      return
    }

    closeProjectMenu()
    suppressNextProjectToggleId.value = pending.projectName
    activeProjectDrag.value = {
      projectName: pending.projectName,
      fromIndex: pending.fromIndex,
      pointerOffsetY: pending.pointerOffsetY,
      groupLeft: pending.groupLeft,
      groupWidth: pending.groupWidth,
      groupHeight: pending.groupHeight,
      groupOuterHeight: pending.groupOuterHeight,
      ghostTop: sample.clientY - pending.pointerOffsetY,
      dropTargetIndexFull: null,
    }
  }

  if (!activeProjectDrag.value) return
  updateProjectDropTarget(sample)
}

function updateProjectDropTarget(sample: DragPointerSample): void {
  const drag = activeProjectDrag.value
  if (!drag) return

  drag.ghostTop = sample.clientY - drag.pointerOffsetY
  if (!isPointerInProjectDropZone(sample)) {
    drag.dropTargetIndexFull = null
    return
  }

  const cursorY = sample.clientY
  const groupsContainer = groupsContainerRef.value
  if (!groupsContainer) {
    drag.dropTargetIndexFull = null
    return
  }

  const containerRect = groupsContainer.getBoundingClientRect()
  const projectIndexByName = new Map(props.groups.map((group, index) => [group.projectName, index]))
  const nonDraggedProjectNames = props.groups
    .map((group) => group.projectName)
    .filter((projectName) => projectName !== drag.projectName)

  let accumulatedTop = 0
  let nextDropTarget = props.groups.length

  for (const projectName of nonDraggedProjectNames) {
    const originalIndex = projectIndexByName.get(projectName)
    if (originalIndex === undefined) continue

    const groupOuterHeight = getProjectOuterHeight(projectName)
    const groupMiddleY = containerRect.top + accumulatedTop + groupOuterHeight / 2
    if (cursorY < groupMiddleY) {
      nextDropTarget = originalIndex
      break
    }

    accumulatedTop += groupOuterHeight
  }

  drag.dropTargetIndexFull = nextDropTarget
}

function isPointerInProjectDropZone(sample: DragPointerSample): boolean {
  const groupsContainer = groupsContainerRef.value
  if (!groupsContainer) return false

  const bounds = groupsContainer.getBoundingClientRect()
  const xInBounds = sample.clientX >= bounds.left && sample.clientX <= bounds.right
  const yInBounds = sample.clientY >= bounds.top - 32 && sample.clientY <= bounds.bottom + 32
  return xInBounds && yInBounds
}

function isDraggingProject(projectName: string): boolean {
  return activeProjectDrag.value?.projectName === projectName
}

function projectGroupStyle(projectName: string): Record<string, string> | undefined {
  const drag = activeProjectDrag.value
  const targetTop = layoutTopByProject.value[projectName] ?? 0
  const shouldElevateForMenu = openProjectMenuId.value === projectName

  if (!drag || drag.projectName !== projectName) {
    return {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      zIndex: shouldElevateForMenu ? '40' : '1',
      transform: `translate3d(0, ${targetTop}px, 0)`,
      willChange: 'transform',
      transition: 'transform 180ms ease',
    }
  }

  return {
    position: 'fixed',
    top: '0',
    left: `${drag.groupLeft}px`,
    width: `${drag.groupWidth}px`,
    height: `${drag.groupHeight}px`,
    zIndex: '50',
    pointerEvents: 'none',
    transform: `translate3d(0, ${drag.ghostTop}px, 0)`,
    willChange: 'transform',
    transition: 'transform 0ms linear',
  }
}

function projectThreads(group: UiProjectGroup): UiThread[] {
  return group.threads.filter((thread) => !isPinned(thread.id))
}

function visibleThreads(group: UiProjectGroup): UiThread[] {
  if (isSearchActive.value) return projectThreads(group)
  if (isCollapsed(group.projectName)) return []

  const rows = projectThreads(group)
  return isExpanded(group.projectName) ? rows : rows.slice(0, 10)
}

function hasHiddenThreads(group: UiProjectGroup): boolean {
  if (isSearchActive.value) return false
  return !isCollapsed(group.projectName) && projectThreads(group).length > 10
}

function hasThreads(group: UiProjectGroup): boolean {
  return projectThreads(group).length > 0
}

function getThreadState(thread: UiThread): 'working' | 'unread' | 'idle' {
  if (thread.inProgress) return 'working'
  if (thread.unread) return 'unread'
  return 'idle'
}

watch(
  () => props.groups.map((group) => group.projectName),
  (projectNames) => {
    const dragProjectName = activeProjectDrag.value?.projectName ?? pendingProjectDrag.value?.projectName ?? ''
    if (dragProjectName && !props.groups.some((group) => group.projectName === dragProjectName)) {
      resetProjectDragState()
    }

    const projectNameSet = new Set(projectNames)
    const nextMeasuredHeights = Object.fromEntries(
      Object.entries(measuredHeightByProject.value).filter(([projectName]) => projectNameSet.has(projectName)),
    ) as Record<string, number>

    if (Object.keys(nextMeasuredHeights).length !== Object.keys(measuredHeightByProject.value).length) {
      measuredHeightByProject.value = nextMeasuredHeights
    }
  },
)

const hasOpenDismissableMenu = computed(() => isOrganizeMenuOpen.value || openProjectMenuId.value !== '')

watch(hasOpenDismissableMenu, (isOpen) => {
  if (isOpen) {
    bindProjectMenuDismissListeners()
    return
  }

  unbindProjectMenuDismissListeners()
})

onBeforeUnmount(() => {
  for (const element of projectGroupElementByName.values()) {
    projectGroupResizeObserver?.unobserve(element)
  }
  projectGroupElementByName.clear()
  projectMenuWrapElementByName.clear()
  unbindProjectMenuDismissListeners()
  resetProjectDragState()
})
</script>

<style scoped>
@reference "tailwindcss";

.thread-tree-root {
  @apply flex flex-col;
}

.pinned-section {
  @apply mb-1;
}

.thread-tree-header-row {
  @apply cursor-default;
}

.thread-tree-header {
  @apply text-sm font-normal text-zinc-500 select-none;
}

.organize-menu-wrap {
  @apply relative;
}

.organize-menu-trigger {
  @apply h-5 w-5 rounded text-zinc-500 flex items-center justify-center transition hover:bg-zinc-200 hover:text-zinc-700;
}

.organize-menu-panel {
  @apply absolute right-0 top-full mt-1 z-30 min-w-44 rounded-xl border border-zinc-200 bg-white/95 p-1.5 shadow-lg backdrop-blur-sm;
}

.organize-menu-title {
  @apply px-2 py-1 text-xs text-zinc-500;
}

.organize-menu-item {
  @apply w-full rounded-lg px-2 py-1.5 text-sm text-zinc-700 flex items-center justify-between hover:bg-zinc-100;
}

.organize-menu-item[data-active='true'] {
  @apply bg-zinc-100 text-zinc-900;
}

.thread-start-button {
  @apply h-5 w-5 rounded text-zinc-500 flex items-center justify-center transition hover:bg-zinc-200 hover:text-zinc-700;
}

.thread-tree-loading {
  @apply px-3 py-2 text-sm text-zinc-500;
}

.thread-tree-no-results {
  @apply px-3 py-2 text-sm text-zinc-400;
}

.thread-tree-groups {
  @apply pr-0.5 relative;
}

.project-group {
  @apply m-0 transition-shadow;
}

.project-group[data-dragging='true'] {
  @apply shadow-lg;
}

.project-header-row {
  @apply hover:bg-zinc-200 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400;
}

.project-main-button {
  @apply min-w-0 w-full text-left rounded px-0 py-0 flex items-center min-h-5 cursor-grab;
}

.project-main-button[data-dragging-handle='true'] {
  @apply cursor-grabbing;
}

.project-icon-stack {
  @apply relative w-4 h-4 flex items-center justify-center text-zinc-500;
}

.project-icon-folder {
  @apply absolute inset-0 flex items-center justify-center opacity-100;
}

.project-icon-chevron {
  @apply absolute inset-0 items-center justify-center opacity-0 hidden;
}

.project-title {
  @apply text-sm font-normal text-zinc-700 truncate select-none;
}

.project-menu-wrap {
  @apply relative;
}

.project-hover-controls {
  @apply flex items-center gap-1;
}

.project-menu-trigger {
  @apply h-4 w-4 rounded p-0 text-zinc-600 flex items-center justify-center;
}

.project-menu-panel {
  @apply absolute right-0 top-full mt-1 z-20 min-w-36 rounded-md border border-zinc-200 bg-white p-1 shadow-md flex flex-col gap-0.5;
}

.project-menu-item {
  @apply rounded px-2 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-100;
}

.project-menu-item-danger {
  @apply text-rose-700 hover:bg-rose-50;
}

.project-menu-label {
  @apply px-2 pt-1 text-xs text-zinc-500;
}

.project-menu-input {
  @apply px-2 py-1 text-sm text-zinc-800 bg-transparent border-none outline-none;
}

.project-empty-row {
  @apply cursor-default;
}

.project-empty-spacer {
  @apply block w-4 h-4;
}

.project-empty {
  @apply text-sm text-zinc-400;
}

.thread-list {
  @apply list-none m-0 p-0 flex flex-col gap-0.5;
}

.thread-list-global {
  @apply pr-0.5;
}

.project-group > .thread-list {
  @apply mt-0.5;
}

.thread-row-item {
  @apply m-0;
}

.thread-row {
  @apply hover:bg-zinc-200;
}

.thread-left-stack {
  @apply relative w-4 h-4 flex items-center justify-center;
}

.thread-pin-button {
  @apply absolute inset-0 w-4 h-4 rounded text-zinc-500 opacity-0 pointer-events-none transition flex items-center justify-center;
}

.thread-main-button {
  @apply min-w-0 w-full text-left rounded px-0 py-0 flex items-center min-h-5;
}

.thread-row-title-wrap {
  @apply min-w-0 inline-flex items-center gap-1;
}

.thread-row-title {
  @apply block text-sm leading-5 font-normal text-zinc-800 truncate whitespace-nowrap;
}

.thread-row-worktree-icon {
  @apply w-3 h-3 text-zinc-500 shrink-0;
}

.thread-status-indicator {
  @apply w-2.5 h-2.5 rounded-full;
}

.thread-row-time {
  @apply block text-sm font-normal text-zinc-500;
}

.thread-menu-wrap {
  @apply relative;
}

.thread-menu-trigger {
  @apply h-4 w-4 rounded p-0 text-xs text-zinc-600 flex items-center justify-center;
}

.thread-menu-panel {
  @apply absolute right-0 top-full mt-1 z-20 min-w-36 rounded-md border border-zinc-200 bg-white p-1 shadow-md flex flex-col gap-0.5;
}

.thread-menu-item {
  @apply rounded px-2 py-1 text-left text-sm text-zinc-700 hover:bg-zinc-100;
}

.thread-menu-item-danger {
  @apply text-rose-700 hover:bg-rose-50;
}

.thread-icon {
  @apply w-4 h-4;
}

.thread-show-more-row {
  @apply mt-1;
}

.thread-show-more-spacer {
  @apply block w-4 h-4;
}

.thread-show-more-button {
  @apply block mx-auto rounded-lg px-2 py-0.5 text-sm font-normal text-zinc-600 transition hover:text-zinc-800 hover:bg-zinc-200;
}

.project-header-row:hover .project-icon-folder {
  @apply opacity-0;
}

.project-header-row:hover .project-icon-chevron {
  @apply flex opacity-100;
}

.thread-row[data-active='true'] {
  @apply bg-zinc-200;
}

.thread-row:hover .thread-pin-button,
.thread-row:focus-within .thread-pin-button {
  @apply opacity-100 pointer-events-auto;
}

.thread-status-indicator[data-state='unread'] {
  width: 6.6667px;
  height: 6.6667px;
  @apply bg-blue-600;
}

.thread-status-indicator[data-state='working'] {
  @apply border-2 border-zinc-500 border-t-transparent bg-transparent animate-spin;
}

.thread-row:hover .thread-status-indicator[data-state='unread'],
.thread-row:hover .thread-status-indicator[data-state='working'],
.thread-row:focus-within .thread-status-indicator[data-state='unread'],
.thread-row:focus-within .thread-status-indicator[data-state='working'] {
  @apply opacity-0;
}

.rename-thread-overlay {
  @apply fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4;
}

.rename-thread-panel {
  @apply w-full max-w-sm rounded-xl bg-white p-4 shadow-xl;
}

.rename-thread-title {
  @apply m-0 text-base font-semibold text-zinc-900;
}

.rename-thread-subtitle {
  @apply mt-1 mb-3 text-sm text-zinc-500;
}

.rename-thread-input {
  @apply w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500;
}

.rename-thread-actions {
  @apply mt-3 flex items-center justify-end gap-2;
}

.rename-thread-button {
  @apply rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100;
}

.rename-thread-button-primary {
  @apply bg-zinc-900 text-white hover:bg-black;
}

.rename-thread-button-danger {
  @apply bg-rose-600 text-white hover:bg-rose-700;
}
</style>
