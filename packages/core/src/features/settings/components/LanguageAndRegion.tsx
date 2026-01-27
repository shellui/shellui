import { useTranslation } from 'react-i18next';
import { useSettings } from '../SettingsContext';
import { useConfig } from '@/features/config/useConfig';
import { getSupportedLanguages } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { cn } from '@/lib/utils';

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const LanguageAndRegion = () => {
  const { t } = useTranslation('settings');
  const { settings, updateSetting } = useSettings();
  const { config } = useConfig();
  const currentLanguage = settings.language?.code || 'en';
  
  // Get supported languages based on config
  const supportedLanguages = getSupportedLanguages(config?.language);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none">
          {t('languageAndRegion.language')}
        </label>
        <p className="text-sm text-muted-foreground">
          {t('languageAndRegion.languageDescription')}
        </p>
        <ButtonGroup>
          {supportedLanguages.map((lang) => {
            const isSelected = currentLanguage === lang.code;
            return (
              <Button
                key={lang.code}
                variant={isSelected ? "default" : "outline"}
                onClick={() => {
                  updateSetting('language', { code: lang.code });
                }}
                className={cn(
                  "h-10 px-4 transition-all flex items-center gap-2",
                  isSelected && [
                    "bg-secondary text-secondary-foreground",
                    "shadow-md",
                    "font-semibold",
                    "border-2 border-primary"
                  ],
                  !isSelected && [
                    "bg-background hover:bg-accent/50",
                    "text-muted-foreground"
                  ]
                )}
                aria-label={lang.nativeName}
                title={lang.nativeName}
              >
                <GlobeIcon />
                <span className="text-sm font-medium">{lang.nativeName}</span>
              </Button>
            );
          })}
        </ButtonGroup>
      </div>
    </div>
  );
}
