import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/microbiology/virtual_biolab',
    },
    {
      path: '/microbiology',
      redirect: '/microbiology/virtual_biolab',
    },
    {
      path: '/microbiology/virtual_biolab',
      name: 'virtual-biolab',
      component: () => import('../views/bio/BioOnepagerView.vue'),
    },
    {
      path: '/microbiology/config',
      name: 'microbiology-config',
      component: () => import('../views/bio/MicrobiologyConfigView.vue'),
    },
  ],
})

export default router
