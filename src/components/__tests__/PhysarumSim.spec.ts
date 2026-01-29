import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import PhysarumSim from '../PhysarumSim.vue'

describe('PhysarumSim', () => {
  it('renders a fallback message in non-WebGL environments', async () => {
    const wrapper = mount(PhysarumSim)
    await nextTick()
    expect(wrapper.text()).toContain('requires WebGL2')
  })
})
