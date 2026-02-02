import {
  PaintbrushIcon,
  GlobeIcon,
  SettingsIcon,
  CodeIcon,
  ShieldIcon,
} from "./SettingsIcons"
import { Appearance } from "./components/Appearance"
import { LanguageAndRegion } from "./components/LanguageAndRegion"
import { Advanced } from "./components/Advanced"
import { Develop } from "./components/Develop"
import { DataPrivacy } from "./components/DataPrivacy"

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
    name: t("routes.develop"),
    icon: CodeIcon,
    path: "developpers",
    element: <Develop />
  }
]       