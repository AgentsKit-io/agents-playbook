import { fail } from './errors.js'
import type { HarnessEvent, HarnessEventListener, HarnessEventType } from './events.js'

export const HARNESS_PLUGIN_API_VERSION = 1 as const
export type Disposer = () => void

export interface PluginSlot<T> { readonly id: string }
export const createPluginSlot = <T>(id: string): PluginSlot<T> => {
  if (!id.trim()) fail('Plugin slot id is required.', 'INVALID_INPUT')
  return { id }
}

export interface HarnessPluginContext {
  readonly apiVersion: typeof HARNESS_PLUGIN_API_VERSION
  register<T>(slot: PluginSlot<T>, id: string, value: T): Disposer
  effect(disposer: Disposer): void
  on<K extends HarnessEventType>(type: K, listener: HarnessEventListener<K>): Disposer
}

export interface HarnessPlugin {
  readonly id: string
  readonly version: string
  readonly apiVersion: typeof HARNESS_PLUGIN_API_VERSION
  readonly requires?: readonly string[]
  readonly apply: (context: HarnessPluginContext) => void | Disposer
}

export interface PluginContribution<T> { readonly pluginId: string; readonly id: string; readonly value: T }

export interface PluginRegistry {
  register(plugin: HarnessPlugin): void
  mount(): void
  emit<K extends HarnessEventType>(event: HarnessEvent<K>): void
  on<K extends HarnessEventType>(type: K, listener: HarnessEventListener<K>): Disposer
  contributions<T>(slot: PluginSlot<T>): readonly PluginContribution<T>[]
  dispose(): void
}

const validId = (value: string, label: string): string => {
  if (!value.trim()) fail(`${label} is required.`, 'INVALID_INPUT')
  return value
}

export const createPluginRegistry = (): PluginRegistry => {
  const plugins = new Map<string, HarnessPlugin>()
  const contributions = new Map<string, Map<string, PluginContribution<unknown>>>()
  const listeners = new Map<HarnessEventType, Set<HarnessEventListener<HarnessEventType>>>()
  const cleanups: Disposer[] = []
  let mounted = false
  let disposed = false

  const ensureOpen = (): void => { if (disposed) fail('Plugin registry has been disposed.', 'HARNESS_ERROR') }
  const removeContribution = (slot: PluginSlot<unknown>, id: string, pluginId: string): void => {
    const entries = contributions.get(slot.id)
    if (entries?.get(id)?.pluginId === pluginId) entries.delete(id)
  }
  const registerContribution = <T>(pluginId: string, slot: PluginSlot<T>, id: string, value: T): Disposer => {
    const entries = contributions.get(slot.id) ?? new Map<string, PluginContribution<unknown>>()
    if (entries.has(id)) fail(`Plugin contribution already exists: ${slot.id}/${id}.`, 'INVALID_INPUT')
    entries.set(id, { pluginId, id, value })
    contributions.set(slot.id, entries)
    const disposer = (): void => removeContribution(slot as PluginSlot<unknown>, id, pluginId)
    cleanups.push(disposer)
    return disposer
  }
  const order = (): HarnessPlugin[] => {
    const result: HarnessPlugin[] = []
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const visit = (id: string): void => {
      if (visited.has(id)) return
      if (visiting.has(id)) fail(`Plugin dependency cycle includes ${id}.`, 'INVALID_INPUT')
      const candidate = plugins.get(id)
      if (!candidate) fail(`Plugin dependency is missing: ${id}.`, 'INVALID_INPUT')
      const plugin = candidate as HarnessPlugin
      visiting.add(id)
      for (const dependency of plugin.requires ?? []) visit(dependency)
      visiting.delete(id); visited.add(id); result.push(plugin)
    }
    for (const id of plugins.keys()) visit(id)
    return result
  }
  const registry: PluginRegistry = {
    register(plugin) {
      ensureOpen()
      if (mounted) fail('Plugins cannot be registered after mount.', 'HARNESS_ERROR')
      validId(plugin.id, 'Plugin id'); validId(plugin.version, 'Plugin version')
      if (plugin.apiVersion !== HARNESS_PLUGIN_API_VERSION) fail(`Unsupported plugin API version: ${String(plugin.apiVersion)}.`, 'INVALID_INPUT')
      if (plugins.has(plugin.id)) fail(`Plugin already registered: ${plugin.id}.`, 'INVALID_INPUT')
      plugins.set(plugin.id, plugin)
    },
    mount() {
      ensureOpen()
      if (mounted) return
      try {
        for (const plugin of order()) {
          const context: HarnessPluginContext = {
            apiVersion: HARNESS_PLUGIN_API_VERSION,
            register: (slot, id, value) => registerContribution(plugin.id, slot, validId(id, 'Plugin contribution id'), value),
            effect: (disposer) => { cleanups.push(disposer) },
            on: (type, listener) => {
              const handlers = listeners.get(type) ?? new Set<HarnessEventListener<HarnessEventType>>()
              handlers.add(listener as HarnessEventListener<HarnessEventType>); listeners.set(type, handlers)
              const disposer = (): void => { handlers.delete(listener as HarnessEventListener<HarnessEventType>) }
              cleanups.push(disposer); return disposer
            },
          }
          const cleanup = plugin.apply(context)
          if (cleanup) cleanups.push(cleanup)
        }
        mounted = true
      } catch (error) { registry.dispose(); throw error }
    },
    emit(event) {
      ensureOpen()
      for (const listener of listeners.get(event.type) ?? []) listener(event as HarnessEvent<HarnessEventType>)
    },
    on(type, listener) {
      ensureOpen()
      const handlers = listeners.get(type) ?? new Set<HarnessEventListener<HarnessEventType>>()
      handlers.add(listener as HarnessEventListener<HarnessEventType>); listeners.set(type, handlers)
      return (): void => { handlers.delete(listener as HarnessEventListener<HarnessEventType>) }
    },
    contributions: <T>(slot: PluginSlot<T>): readonly PluginContribution<T>[] => [...(contributions.get(slot.id)?.values() ?? [])] as readonly PluginContribution<T>[],
    dispose() {
      if (disposed) return
      let firstError: unknown
      for (const cleanup of cleanups.splice(0).reverse()) { try { cleanup() } catch (error) { firstError ??= error } }
      contributions.clear(); listeners.clear(); disposed = true; mounted = false
      if (firstError) throw firstError
    },
  }
  return registry
}
