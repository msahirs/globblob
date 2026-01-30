import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import MetaballsSim from '../MetaballsSim.vue'

describe('MetaballsSim', () => {
  it('renders a fallback message in non-WebGL environments', async () => {
    const wrapper = mount(MetaballsSim)
    await nextTick()
    expect(wrapper.text()).toContain('requires WebGL2')
  })
})

