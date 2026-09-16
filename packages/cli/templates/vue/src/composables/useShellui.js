import { onMounted, onUnmounted, ref } from 'vue'
import { shellui } from '@shellui/sdk/tiny'
import { useI18n } from 'vue-i18n'
import { normalizeLang } from '../i18n'

/**
 * Handshake + theme/language sync with the Shellui host (tiny SDK).
 */
export function useShellui() {
  const { locale } = useI18n()
  const theme = ref(shellui.theme)
  const language = ref(normalizeLang(shellui.language || locale.value))

  let offTheme = () => {}
  let offLanguage = () => {}

  onMounted(() => {
    const applyTheme = () => {
      shellui.applyTheme()
      theme.value = shellui.theme
    }

    const applyLanguage = (code) => {
      const lang = normalizeLang(code)
      locale.value = lang
      language.value = lang
    }

    void shellui.ready.then(() => {
      applyTheme()
      applyLanguage(shellui.language)
    })

    offTheme = shellui.on('theme', applyTheme)
    offLanguage = shellui.on('language', applyLanguage)
  })

  onUnmounted(() => {
    offTheme()
    offLanguage()
  })

  return { theme, language }
}
