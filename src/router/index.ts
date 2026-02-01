import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import PhysarumDevView from '../views/PhysarumDevView.vue'
import MetaballsDevView from '../views/MetaballsDevView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/physarum',
      name: 'physarum',
      component: PhysarumDevView,
    },
    {
      path: '/metaballs',
      name: 'metaballs',
      component: MetaballsDevView,
    },
  ],
})

export default router
