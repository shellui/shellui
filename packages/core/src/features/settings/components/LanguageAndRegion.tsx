import { useTranslation } from 'react-i18next';
import { useSettings } from '../hooks/useSettings';
import { useConfig } from '@/features/config/useConfig';
import { getSupportedLanguages } from '@/i18n/config';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" x2="22" y1="12" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// Timezones organized by region
const TIMEZONE_GROUPS = [
  {
    label: 'UTC',
    timezones: [
      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    ],
  },
  {
    label: 'North America',
    timezones: [
      { value: 'America/New_York', label: 'Eastern Time (US & Canada)' },
      { value: 'America/Chicago', label: 'Central Time (US & Canada)' },
      { value: 'America/Denver', label: 'Mountain Time (US & Canada)' },
      { value: 'America/Los_Angeles', label: 'Pacific Time (US & Canada)' },
      { value: 'America/Toronto', label: 'Toronto' },
      { value: 'America/Vancouver', label: 'Vancouver' },
      { value: 'America/Mexico_City', label: 'Mexico City' },
    ],
  },
  {
    label: 'South America',
    timezones: [
      { value: 'America/Sao_Paulo', label: 'São Paulo' },
      { value: 'America/Buenos_Aires', label: 'Buenos Aires' },
    ],
  },
  {
    label: 'Europe',
    timezones: [
      { value: 'Europe/London', label: 'London' },
      { value: 'Europe/Paris', label: 'Paris' },
      { value: 'Europe/Berlin', label: 'Berlin' },
      { value: 'Europe/Rome', label: 'Rome' },
      { value: 'Europe/Madrid', label: 'Madrid' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam' },
      { value: 'Europe/Stockholm', label: 'Stockholm' },
      { value: 'Europe/Zurich', label: 'Zurich' },
    ],
  },
  {
    label: 'Asia',
    timezones: [
      { value: 'Asia/Tokyo', label: 'Tokyo' },
      { value: 'Asia/Shanghai', label: 'Shanghai' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong' },
      { value: 'Asia/Singapore', label: 'Singapore' },
      { value: 'Asia/Dubai', label: 'Dubai' },
      { value: 'Asia/Kolkata', label: 'Mumbai, New Delhi' },
      { value: 'Asia/Bangkok', label: 'Bangkok' },
    ],
  },
  {
    label: 'Australia & Pacific',
    timezones: [
      { value: 'Australia/Sydney', label: 'Sydney' },
      { value: 'Australia/Melbourne', label: 'Melbourne' },
      { value: 'Pacific/Auckland', label: 'Auckland' },
    ],
  },
];

// Format date based on timezone and language
const formatDate = (date: Date, timezone: string, lang: string): string => {
  try {
    return new Intl.DateTimeFormat(lang, {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return date.toLocaleDateString(lang);
  }
};

// Format time based on timezone and language
const formatTime = (date: Date, timezone: string, lang: string): string => {
  try {
    return new Intl.DateTimeFormat(lang, {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleTimeString(lang);
  }
};

// Get browser's current timezone
const getBrowserTimezone = (): string => {
  if (typeof Intl !== 'undefined') {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }
  return 'UTC';
};

// Get human-readable timezone name
const getTimezoneDisplayName = (timezone: string, lang: string = 'en'): string => {
  try {
    // Try to get a friendly name from Intl
    const formatter = new Intl.DateTimeFormat(lang, {
      timeZone: timezone,
      timeZoneName: 'long',
    });
    const parts = formatter.formatToParts(new Date());
    const timeZoneName = parts.find(part => part.type === 'timeZoneName')?.value;
    
    if (timeZoneName) {
      return timeZoneName;
    }
    
    // Fallback: try to get city name from timezone string
    const cityName = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
    return cityName;
  } catch {
    // Final fallback: use the timezone code
    return timezone;
  }
};

export const LanguageAndRegion = () => {
  const { t } = useTranslation('settings');
  const { settings, updateSetting } = useSettings();
  const { config } = useConfig();
  const currentLanguage = settings.language?.code || 'en';
  const browserTimezone = getBrowserTimezone();
  const currentTimezone = settings.region?.timezone || browserTimezone;
  const isUsingBrowserTimezone = currentTimezone === browserTimezone;
  
  // Get supported languages based on config
  const supportedLanguages = getSupportedLanguages(config?.language);

  const handleResetRegion = () => {
    updateSetting('region', { timezone: browserTimezone });
  };

  // State for current date/time
  const [currentDateTime, setCurrentDateTime] = useState<{ date: string; time: string }>(() => {
    const now = new Date();
    return {
      date: formatDate(now, currentTimezone, currentLanguage),
      time: formatTime(now, currentTimezone, currentLanguage),
    };
  });

  // Update date/time every second and when timezone/language changes
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date();
      setCurrentDateTime({
        date: formatDate(now, currentTimezone, currentLanguage),
        time: formatTime(now, currentTimezone, currentLanguage),
      });
    };

    // Update immediately when timezone or language changes
    updateDateTime();

    // Then update every second
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, [currentTimezone, currentLanguage]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
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
                    "shadow-md",
                    "font-semibold"
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium leading-none" style={{ fontFamily: 'var(--heading-font-family, inherit)' }}>
            {t('languageAndRegion.region')}
          </label>
          {!isUsingBrowserTimezone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetRegion}
              className="h-8 text-xs"
            >
              {t('languageAndRegion.resetToBrowser')}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {t('languageAndRegion.regionDescription')}
        </p>
        <Select
          value={currentTimezone}
          onChange={(e) => {
            updateSetting('region', { timezone: e.target.value });
          }}
          className="w-full"
        >
          {TIMEZONE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.timezones.map((tz) => {
                const isBrowserTimezone = tz.value === browserTimezone;
                return (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}{isBrowserTimezone ? ` (${t('languageAndRegion.defaultBrowser')})` : ''}
                  </option>
                );
              })}
            </optgroup>
          ))}
        </Select>
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/60 border border-border/50">
          <ClockIcon />
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums">
              {currentDateTime.time}
            </span>
            <span className="text-xs text-muted-foreground">
              {currentDateTime.date}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <span>{t('languageAndRegion.timezoneLabel')}:</span>
          <span className="font-medium">{getTimezoneDisplayName(currentTimezone, currentLanguage)}</span>
          {isUsingBrowserTimezone && (
            <span className="ml-1">({t('languageAndRegion.defaultBrowser')})</span>
          )}
        </div>
      </div>
    </div>
  );
}
