import { useTranslation } from 'react-i18next'
import { useShellui } from './useShellui'
import './App.css'

function themeLabel(theme, t) {
  if (!theme) return t('fallbackTheme')
  const name = theme.displayName || theme.name || 'shellui'
  return `${name} · ${theme.mode}`
}

function App() {
  const { t } = useTranslation()
  const { theme, language } = useShellui()

  return (
    <main className="shellui-home">
      <p className="eyebrow">Shellui</p>
      <h1>{t('title')}</h1>
      <p className="blurb">{t('blurb')}</p>

      <dl className="meta">
        <div>
          <dt>{t('themeLabel')}</dt>
          <dd>{themeLabel(theme, t)}</dd>
        </div>
        <div>
          <dt>{t('languageLabel')}</dt>
          <dd>{language || t('fallbackLanguage')}</dd>
        </div>
      </dl>

      <p className="hint">{t('hint')}</p>
    </main>
  )
}

export default App
