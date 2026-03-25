import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MicrobiologyConfigView from '../MicrobiologyConfigView.vue'

const confirmMock = vi.spyOn(window, 'confirm').mockImplementation(() => true)

function buildConfigs() {
  return [
    {
      id: 1,
      name: 'Baseline culture curve',
      expression: '1 + oxygen',
      isActive: true,
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Evening bloom curve',
      expression: '0.4 + sin(t / 5)',
      isActive: false,
      createdAt: '2026-03-25T00:00:00.000Z',
      updatedAt: '2026-03-25T00:00:00.000Z',
    },
  ]
}

const store = {
  configs: buildConfigs(),
  activeConfig: buildConfigs()[0],
  lastError: null as string | null,
  hydrate: vi.fn().mockResolvedValue(undefined),
  createConfig: vi.fn().mockResolvedValue({
    id: 3,
    name: 'Baseline culture curve 2',
    expression: '1 + oxygen',
    isActive: false,
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  }),
  saveConfig: vi.fn(),
  setActiveConfig: vi.fn().mockImplementation(async (id: number) => {
    store.configs = store.configs.map((config) => ({
      ...config,
      isActive: config.id === id,
    }))
    const nextActiveConfig = store.configs.find((config) => config.id === id)
    if (nextActiveConfig) {
      store.activeConfig = nextActiveConfig
    }
  }),
  deleteConfig: vi.fn(),
}

vi.mock('@/stores/microbiologyConfigs', () => ({
  useMicrobiologyConfigsStore: () => store,
}))

describe('MicrobiologyConfigView', () => {
  beforeEach(() => {
    confirmMock.mockClear()
    store.configs = buildConfigs()
    store.activeConfig = store.configs[0]
    store.hydrate.mockClear()
    store.createConfig.mockClear()
    store.saveConfig.mockClear()
    store.setActiveConfig.mockClear()
    store.deleteConfig.mockClear()
    store.lastError = null
  })

  it('renders the saved configuration list and current active curve', async () => {
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()

    expect(wrapper.text()).toContain('Saved Curves')
    expect(wrapper.text()).toContain('Baseline culture curve')
    expect(wrapper.text()).toContain('Evening bloom curve')
    expect(wrapper.text()).toContain('Expression for current population at time t')
    expect(store.hydrate).toHaveBeenCalled()
  })

  it('disables Set active when the selected curve is already active', async () => {
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()
    await nextTick()

    const activeButton = wrapper.findAll('button.secondaryButton')[1]
    expect(activeButton?.attributes('disabled')).toBeDefined()
  })

  it('shows validation feedback and disables save for invalid expressions', async () => {
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()
    await wrapper.get('textarea').setValue('sin(')

    expect(wrapper.text()).toContain('Needs attention')
    expect(wrapper.get('button.primaryButton').attributes('disabled')).toBeDefined()
  })

  it('shows an unsaved notice for a new draft and persists it only on save', async () => {
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()
    await wrapper.findAll('button.secondaryButton')[0]!.trigger('click')

    expect(wrapper.text()).toContain('New curve has not been saved yet.')
    expect(store.createConfig).not.toHaveBeenCalled()

    await wrapper.get('button.primaryButton').trigger('click')

    expect(store.createConfig).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('"Baseline culture curve 2" was saved.')
  })

  it('renders the unsaved notice in the floating shell', async () => {
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()
    await wrapper.findAll('button.secondaryButton')[0]!.trigger('click')

    expect(wrapper.find('.floatingNoticeShell').exists()).toBe(true)
    expect(wrapper.find('.floatingNotice').text()).toContain('New curve has not been saved yet.')
  })

  it('asks for confirmation before deleting a saved curve', async () => {
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()
    await nextTick()
    await wrapper.find('button.ghostButton').trigger('click')

    expect(confirmMock).toHaveBeenCalledWith('Delete "Baseline culture curve"?')
    expect(store.deleteConfig).toHaveBeenCalledWith(1)
    expect(wrapper.text()).toContain('"Baseline culture curve" was deleted.')
  })

  it('does not delete when confirmation is cancelled', async () => {
    confirmMock.mockReturnValueOnce(false)
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()
    await nextTick()
    await wrapper.find('button.ghostButton').trigger('click')

    expect(store.deleteConfig).not.toHaveBeenCalled()
  })

  it('shows a notification when a curve is set active', async () => {
    const wrapper = mount(MicrobiologyConfigView)

    await Promise.resolve()
    await nextTick()
    await wrapper.findAll('.configCard')[1]!.trigger('click')
    await nextTick()

    const activeButton = wrapper.findAll('button.secondaryButton')[1]
    await activeButton!.trigger('click')
    await nextTick()

    expect(store.setActiveConfig).toHaveBeenCalledWith(2)
    expect(wrapper.text()).toContain('"Evening bloom curve" is now the active curve.')
    const updatedActiveButton = wrapper.findAll('button.secondaryButton')[1]
    expect(updatedActiveButton!.attributes('disabled')).toBeDefined()
  })
})
