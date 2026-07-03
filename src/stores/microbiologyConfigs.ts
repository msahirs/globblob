import { defineStore } from 'pinia'
import {
  DEFAULT_GROWTH_CONFIG_NAME,
  DEFAULT_GROWTH_EXPRESSION,
} from '@/features/microbiology/defaults'
import { microbiologyConfigRepository } from '@/features/microbiology/configRepository'
import type { GrowthExpressionConfig } from '@/features/microbiology/types'

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Something went wrong while working with the saved configurations'
}

function buildNextName(configs: GrowthExpressionConfig[]) {
  const usedNames = new Set(configs.map((config) => config.name.toLowerCase()))
  if (!usedNames.has(DEFAULT_GROWTH_CONFIG_NAME.toLowerCase())) {
    return DEFAULT_GROWTH_CONFIG_NAME
  }

  let index = 2
  while (usedNames.has(`${DEFAULT_GROWTH_CONFIG_NAME} ${index}`.toLowerCase())) {
    index++
  }
  return `${DEFAULT_GROWTH_CONFIG_NAME} ${index}`
}

export const useMicrobiologyConfigsStore = defineStore('microbiologyConfigs', {
  state: () => ({
    configs: [] as GrowthExpressionConfig[],
    hydrated: false,
    loading: false,
    lastError: null as string | null,
  }),

  getters: {
    activeConfig: (state) => state.configs.find((config) => config.isActive) ?? null,
  },

  actions: {
    async hydrate() {
      if (this.hydrated || this.loading) return

      this.loading = true
      this.lastError = null
      try {
        this.configs = await microbiologyConfigRepository.listConfigurations()
        this.hydrated = true
      } catch (error) {
        this.lastError = toErrorMessage(error)
        throw error
      } finally {
        this.loading = false
      }
    },

    async refresh() {
      this.lastError = null
      try {
        this.configs = await microbiologyConfigRepository.listConfigurations()
        this.hydrated = true
      } catch (error) {
        this.lastError = toErrorMessage(error)
        throw error
      }
    },

    async createConfig(payload?: { name: string; expression: string }) {
      this.lastError = null
      try {
        const config = await microbiologyConfigRepository.createConfiguration(
          payload ?? {
            name: buildNextName(this.configs),
            expression: DEFAULT_GROWTH_EXPRESSION,
          },
          false,
        )
        await this.refresh()
        return this.configs.find((entry) => entry.id === config.id) ?? config
      } catch (error) {
        this.lastError = toErrorMessage(error)
        throw error
      }
    },

    async saveConfig(id: number, payload: { name: string; expression: string }) {
      this.lastError = null
      try {
        const config = await microbiologyConfigRepository.updateConfiguration(id, payload)
        await this.refresh()
        return this.configs.find((entry) => entry.id === config.id) ?? config
      } catch (error) {
        this.lastError = toErrorMessage(error)
        throw error
      }
    },

    async setActiveConfig(id: number) {
      this.lastError = null
      try {
        await microbiologyConfigRepository.setActiveConfiguration(id)
        await this.refresh()
      } catch (error) {
        this.lastError = toErrorMessage(error)
        throw error
      }
    },

    async deleteConfig(id: number) {
      this.lastError = null
      try {
        await microbiologyConfigRepository.deleteConfiguration(id)
        await this.refresh()
      } catch (error) {
        this.lastError = toErrorMessage(error)
        throw error
      }
    },
  },
})
