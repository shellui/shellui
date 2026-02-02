import { useTranslation } from 'react-i18next';
import { shellui } from '@shellui/sdk';
import { useConfig } from '@/features/config/useConfig';
import type { NavigationItem, NavigationGroup } from '@/features/config/types';

const flattenNavigationItems = (navigation: (NavigationItem | NavigationGroup)[]): NavigationItem[] => {
  if (navigation.length === 0) return [];
  return navigation.flatMap((item) => {
    if ('title' in item && 'items' in item) {
      return (item as NavigationGroup).items;
    }
    return item as NavigationItem;
  });
};

export const NotFoundView = () => {
  const { config } = useConfig();
  const { i18n } = useTranslation();
  const currentLanguage = i18n.language || 'en';

  const resolveLocalizedString = (
    value: string | { en: string; fr: string; [key: string]: string },
    lang: string
  ): string => {
    if (typeof value === 'string') return value;
    return value[lang] || value.en || value.fr || Object.values(value)[0] || '';
  };

  const navItems =
    config?.navigation && config.navigation.length > 0
      ? flattenNavigationItems(config.navigation).filter((item) => !item.hidden)
      : [];

  const handleNavigate = (path: string) => {
    shellui.navigate(path.startsWith('/') ? path : `/${path}`);
  };

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-muted-foreground">
        <span className="text-6xl font-light tracking-tighter text-foreground/80 select-none">404</span>
        <p className="mt-3 text-lg text-muted-foreground">Page not found</p>
      </div>

      {navItems.length > 0 && (
        <footer className="border-t border-border py-4 px-6 mt-auto bg-muted/30">
          <nav className="flex flex-row flex-wrap justify-center items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" aria-label="Available pages">
            {navItems.map((item, index) => (
              <span key={item.path} className="inline-flex items-center gap-x-2">
                {index > 0 && <span className="text-border select-none" aria-hidden>·</span>}
                <button
                  type="button"
                  onClick={() => handleNavigate(`/${item.path}`)}
                  className="text-muted-foreground hover:text-foreground hover:underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0 font-normal"
                >
                  {resolveLocalizedString(item.label, currentLanguage)}
                </button>
              </span>
            ))}
          </nav>
        </footer>
      )}
    </div>
  );
};
