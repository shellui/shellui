import { useEffect, useState } from 'react'
import { shellui } from '@shellui/sdk/tiny'
import i18n, { normalizeLang } from './i18n'

/**
 * Handshake + theme/language sync with the Shellui host (tiny SDK).
 * Outside an iframe, ready resolves immediately with null theme/language.
 */
export function useShellui() {
  const [theme, setTheme] = useState(() => shellui.theme)
  const [language, setLanguage] = useState(() =>
    normalizeLang(shellui.language || i18n.language),
  )

  useEffect(() => {
    const applyTheme = () => {
      shellui.applyTheme()
      setTheme(shellui.theme)
    }

    const applyLanguage = (code) => {
      const lang = normalizeLang(code)
      if (i18n.language !== lang) {
        void i18n.changeLanguage(lang)
      }
      setLanguage(lang)
    }

    void shellui.ready.then(() => {
      applyTheme()
      applyLanguage(shellui.language)
    })

    const offTheme = shellui.on('theme', applyTheme)
    const offLanguage = shellui.on('language', applyLanguage)

    return () => {
      offTheme()
      offLanguage()
    }
  }, [])

  return { theme, language, shellui }
}
