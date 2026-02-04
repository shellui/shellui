import {
  PaintbrushIcon,
  GlobeIcon,
  SettingsIcon,
  CodeIcon,
  ShieldIcon,
  HardDriveIcon,
} from "./SettingsIcons"
import { Appearance } from "./components/Appearance"
import { LanguageAndRegion } from "./components/LanguageAndRegion"
import { Advanced } from "./components/Advanced"
import { Develop } from "./components/Develop"
import { DataPrivacy } from "./components/DataPrivacy"
import { Caching } from "./components/Caching"

export const createSettingsRoutes = (t: (key: string) => string) => [
  {
    name: t("routes.appearance"),
    icon: PaintbrushIcon,
    path: "appearance",
    element: <Appearance />
  },
  {
    name: t("routes.languageAndRegion"),
    icon: GlobeIcon,
    path: "language-and-region",
    element: <LanguageAndRegion />
  },
  {
    name: t("routes.advanced"),
    icon: SettingsIcon,
    path: "advanced",
    element: <Advanced />
  },
  {
    name: t("routes.dataPrivacy"),
    icon: ShieldIcon,
    path: "data-privacy",
    element: <DataPrivacy />
  },
  {
    name: t("routes.caching"),
    icon: HardDriveIcon,
    path: "caching",
    element: <Caching />
  },
  {
    name: t("routes.develop"),
    icon: CodeIcon,
    path: "developpers",
    element: <Develop />
  }
]       