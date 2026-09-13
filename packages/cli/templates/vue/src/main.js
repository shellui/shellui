import { createApp } from 'vue'
import { shellui } from '@shellui/sdk/tiny'
import './style.css'
import App from './App.vue'

// Light Shellui host handshake when embedded (no-op outside the shell).
void shellui.ready

createApp(App).mount('#app')
