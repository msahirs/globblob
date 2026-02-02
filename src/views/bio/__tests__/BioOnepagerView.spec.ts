import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BioOnepagerView from '../BioOnepagerView.vue'

describe('BioOnepagerView', () => {
  it('renders UI and toggles Start/Stop', async () => {
    const wrapper = mount(BioOnepagerView, { attachTo: document.body })
    expect(wrapper.get('button').text()).toBe('Start')

    await wrapper.get('button').trigger('click')
    expect(wrapper.get('button').text()).toBe('Stop')

    expect(wrapper.text()).toContain('Draaisnelheid')
    expect(wrapper.text()).toContain('pH niveau')
    expect(wrapper.text()).toContain('Zuurstof niveau')
    expect(wrapper.find('[aria-label="Petri dish simulation"]').exists()).toBe(true)
  })
})
