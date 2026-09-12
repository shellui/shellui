<template>
  <div class="app">
    <h1>Welcome to Shellui + Vue</h1>

    <div class="section">
      <h2>Getting Started</h2>
      <p>This is a minimal Vue starter integrated with the Shellui SDK.</p>

      <button
        @click="handleShowToast"
        class="button"
      >
        Show Toast
      </button>
    </div>

    <div
      v-if="settings"
      class="section"
    >
      <h3>Shell Settings</h3>
      <pre class="code-block">{{ JSON.stringify(settings, null, 2) }}</pre>
    </div>

    <div
      v-if="user"
      class="section"
    >
      <h3>Current User</h3>
      <pre class="code-block">{{ JSON.stringify(user, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import shellui from '@shellui/sdk';

const settings = ref(null);
const user = ref(null);

onMounted(async () => {
  // Initialize Shellui SDK
  await shellui.ready();

  // Get settings from parent shell
  settings.value = shellui.getSettings();

  // Get current user if authenticated
  user.value = shellui.getUser();

  console.log('Shellui SDK initialized', { settings: settings.value, user: user.value });
});

const handleShowToast = () => {
  shellui.showToast({
    title: 'Hello from Vue!',
    description: 'This is a toast notification from your Vue app.',
  });
};
</script>

<style scoped>
.app {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  color: #333;
}

h2,
h3 {
  color: #666;
}

.section {
  margin-top: 2rem;
}

.button {
  padding: 0.5rem 1rem;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  margin-top: 1rem;
}

.button:hover {
  opacity: 0.9;
}

.button:active {
  opacity: 0.8;
}

.code-block {
  background-color: #f5f5f5;
  padding: 1rem;
  border-radius: 0.25rem;
  overflow: auto;
}

body {
  margin: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell',
    'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style>
