import { useTranslation } from 'react-i18next';
import type { AppCapability } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { useNavigation } from '../../marketplace/NavigationProvider';

const TOGGLEABLE: AppCapability[] = ['ui', 'navigate', 'storage', 'ai'];

export function InstalledApps() {
  const { t } = useTranslation('settings');
  const { t: tCommon } = useTranslation();
  const { installedApps, uninstallApp, setAppCapabilities } = useNavigation();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <p className="text-sm text-muted-foreground">{t('installedApps.description')}</p>
      {installedApps.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('installedApps.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {installedApps.map((app) => (
            <li
              key={app.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{app.name}</p>
                  <p className="text-xs text-muted-foreground">{app.origin}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void uninstallApp(app.id);
                  }}
                >
                  {t('installedApps.remove')}
                </Button>
              </div>
              <div className="flex flex-col gap-2">
                {TOGGLEABLE.map((capability) => {
                  const checked = app.capabilities.includes(capability);
                  return (
                    <label
                      key={capability}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span>{tCommon(`marketplace.capability.${capability}`)}</span>
                      <Switch
                        checked={checked}
                        aria-label={tCommon(`marketplace.capability.${capability}`)}
                        onCheckedChange={(next) => {
                          const capabilities = next
                            ? [...app.capabilities, capability]
                            : app.capabilities.filter((entry) => entry !== capability);
                          void setAppCapabilities(app.id, capabilities);
                        }}
                      />
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">{t('installedApps.hostOnly')}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
