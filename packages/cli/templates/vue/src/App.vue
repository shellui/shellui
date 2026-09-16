<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useShellui } from './composables/useShellui'

const { t } = useI18n()
const { theme, language } = useShellui()

const themeText = computed(() => {
  const current = theme.value
  if (!current) return t('fallbackTheme')
  const name = current.displayName || current.name || 'shellui'
  return `${name} · ${current.mode}`
})
</script>

<template>
  <main class="shellui-home">
    <p class="eyebrow">Shellui</p>
    <h1>{{ t('title') }}</h1>
    <p class="blurb">{{ t('blurb') }}</p>

    <dl class="meta">
      <div>
        <dt>{{ t('themeLabel') }}</dt>
        <dd>{{ themeText }}</dd>
      </div>
      <div>
        <dt>{{ t('languageLabel') }}</dt>
        <dd>{{ language || t('fallbackLanguage') }}</dd>
      </div>
    </dl>

    <p class="hint">{{ t('hint') }}</p>
  </main>
</template>
