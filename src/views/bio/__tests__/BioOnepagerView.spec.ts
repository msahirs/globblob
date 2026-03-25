import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import BioOnepagerView from '../BioOnepagerView.vue'

const store = {
  activeConfig: {
    id: 1,
    name: 'Baseline culture curve',
    expression: '1 + oxygen',
    isActive: true,
    createdAt: '2026-03-25T00:00:00.000Z',
    updatedAt: '2026-03-25T00:00:00.000Z',
  },
  hydrate: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/stores/microbiologyConfigs', () => ({
  useMicrobiologyConfigsStore: () => store,
}))

describe('BioOnepagerView', () => {
  it('renders UI and toggles Start/Stop', async () => {
    const wrapper = mount(BioOnepagerView, { attachTo: document.body })
    expect(wrapper.get('.startButton').text()).toBe('Start')

    await wrapper.get('.startButton').trigger('click')
    expect(wrapper.get('.startButton').text()).toBe('Stop')

    expect(wrapper.text()).toContain('Draaisnelheid')
    expect(wrapper.text()).toContain('pH niveau')
    expect(wrapper.text()).toContain('Zuurstof niveau')
    expect(wrapper.find('[aria-label="Petri dish simulation"]').exists()).toBe(true)
  })
})
