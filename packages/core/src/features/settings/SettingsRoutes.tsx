import {
  PaintbrushIcon,
  GlobeIcon,
  SettingsIcon,
  CodeIcon,
  ShieldIcon,
  PackageIcon,
  RefreshDoubleIcon,
} from './SettingsIcons';
import { Appearance } from './components/Appearance';
import { LanguageAndRegion } from './components/LanguageAndRegion';
import { UpdateApp } from './components/UpdateApp';
import { Advanced } from './components/Advanced';
import { Develop } from './components/Develop';
import { DataPrivacy } from './components/DataPrivacy';
import { ServiceWorker } from './components/ServiceWorker';
import { isTauri } from '../../service-worker/register';

export const createSettingsRoutes = (t: (key: string) => string) => [
  {
    name: t('routes.appearance'),
    icon: PaintbrushIcon,
    path: 'appearance',
    element: <Appearance />,
  },
  {
    name: t('routes.languageAndRegion'),
    icon: GlobeIcon,
    path: 'language-and-region',
    element: <LanguageAndRegion />,
  },
  {
    name: t('routes.updateApp'),
    icon: RefreshDoubleIcon,
    path: 'update-app',
    element: <UpdateApp />,
  },
  {
    name: t('routes.advanced'),
    icon: SettingsIcon,
    path: 'advanced',
    element: <Advanced />,
  },
  {
    name: t('routes.dataPrivacy'),
    icon: ShieldIcon,
    path: 'data-privacy',
    element: <DataPrivacy />,
  },
  {
    name: t('routes.develop'),
    icon: CodeIcon,
    path: 'developpers',
    element: <Develop />,
  },
  ...(isTauri()
    ? []
    : [
        {
          name: t('routes.serviceWorker'),
          icon: PackageIcon,
          path: 'service-worker',
          element: <ServiceWorker />,
        },
      ]),
];
