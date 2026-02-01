<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="home">
    <div class="home-card">
      <h1 class="home-title">Simulations</h1>
      <p class="home-subtitle">Choose a dev page to run.</p>

      <div class="home-actions">
        <RouterLink class="home-button" to="/physarum">Physarum</RouterLink>
        <RouterLink class="home-button" to="/metaballs">Metaballs</RouterLink>
      </div>
    </div>
  </main>
</template>

<style scoped>
.home {
  width: 1080px;
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #0a0922;
  color: rgba(255, 255, 255, 0.92);
}

.home-card {
  width: min(720px, 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
}

.home-title {
  margin: 0 0 6px;
  font-size: 28px;
  letter-spacing: 0.02em;
}

.home-subtitle {
  margin: 0 0 18px;
  color: rgba(255, 255, 255, 0.7);
}

.home-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.home-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 14px 16px;
  border-radius: 12px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
  text-decoration: none;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
}

.home-button:hover {
  background: rgba(255, 255, 255, 0.12);
}

@media (min-width: 720px) {
  .home-actions {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
