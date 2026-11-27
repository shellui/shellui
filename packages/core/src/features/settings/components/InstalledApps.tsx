import { useTranslation } from 'react-i18next';
import type { AppCapability } from '@shellui/sdk';
import { Button } from '../../../components/ui/button';
import { Switch } from '../../../components/ui/switch';
import { flattenNavigationItems, resolveLocalizedString } from '../../layouts/utils';
import { useConfig } from '../../config/useConfig';
import { useNavigation } from '../../marketplace/NavigationProvider';

const TOGGLEABLE: AppCapability[] = ['ui', 'navigate', 'storage', 'ai'];

export function CustomizeNavigation() {
  const { t, i18n } = useTranslation('settings');
  const { t: tCommon } = useTranslation();
  const { config } = useConfig();
  const {
    customizationEnabled,
    installedApps,
    uninstallApp,
    setAppCapabilities,
    moveNavigationItem,
    setNavigationItemHidden,
    resetNavigation,
    unsavedRemovals,
  } = useNavigation();
  const items = flattenNavigationItems(config.navigation ?? []);
  const lang = i18n.language || 'en';

  if (!customizationEnabled) {
    return <p className="text-sm text-muted-foreground">{t('customizeNavigation.disabled')}</p>;
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t('customizeNavigation.description')}</p>
        {unsavedRemovals ? (
          <p
            role="status"
            className="text-sm text-destructive"
          >
            {t('customizeNavigation.notSavedYet')}
          </p>
        ) : null}
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              void resetNavigation();
            }}
          >
            {t('customizeNavigation.reset')}
          </Button>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('customizeNavigation.empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item, index) => {
            const installed = installedApps.find((app) => app.path === item.path);
            const label = resolveLocalizedString(item.label, lang) || item.path;
            const locked = item.locked === true;
            return (
              <li
                key={item.path}
                className="flex flex-col gap-3 rounded-lg border border-border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{item.path}</p>
                    {locked ? (
                      <p className="text-xs text-muted-foreground">
                        {t('customizeNavigation.locked')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t('customizeNavigation.moveUp', { name: label })}
                      disabled={index === 0}
                      onClick={() => {
                        void moveNavigationItem(item.path, 'up');
                      }}
                    >
                      {t('customizeNavigation.up')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t('customizeNavigation.moveDown', { name: label })}
                      disabled={index === items.length - 1}
                      onClick={() => {
                        void moveNavigationItem(item.path, 'down');
                      }}
                    >
                      {t('customizeNavigation.down')}
                    </Button>
                  </div>
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>{t('customizeNavigation.visible')}</span>
                  <Switch
                    checked={!item.hidden}
                    disabled={locked}
                    aria-label={t('customizeNavigation.visibleFor', { name: label })}
                    onCheckedChange={(visible) => {
                      void setNavigationItemHidden(item.path, !visible);
                    }}
                  />
                </label>
                {installed ? (
                  <div className="flex flex-col gap-3 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">{installed.origin}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          void uninstallApp(installed.id);
                        }}
                      >
                        {t('customizeNavigation.uninstall')}
                      </Button>
                    </div>
                    {installed.thirdParty ? (
                      <div className="flex flex-col gap-2">
                        {TOGGLEABLE.map((capability) => {
                          const checked = installed.capabilities.includes(capability);
                          const capabilityLabel = tCommon(`marketplace.capability.${capability}`);
                          return (
                            <label
                              key={capability}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span>{capabilityLabel}</span>
                              <Switch
                                checked={checked}
                                aria-label={t('customizeNavigation.capabilityFor', {
                                  name: label,
                                  capability: capabilityLabel,
                                })}
                                onCheckedChange={(next) => {
                                  const capabilities = next
                                    ? [...installed.capabilities, capability]
                                    : installed.capabilities.filter(
                                        (entry) => entry !== capability,
                                      );
                                  void setAppCapabilities(installed.id, capabilities);
                                }}
                              />
                            </label>
                          );
                        })}
                        <p className="text-xs text-muted-foreground">
                          {t('customizeNavigation.hostOnly')}
                        </p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
