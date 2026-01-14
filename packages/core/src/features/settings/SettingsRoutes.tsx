import {
  BellIcon,
  PaintbrushIcon,
  GlobeIcon,
  SettingsIcon,
  CodeIcon,
} from "./SettingsIcons"
import { Notifications } from "./components/Notifications"
import { Appearance } from "./components/Appearance"
import { LanguageAndRegion } from "./components/LanguageAndRegion"
import { Advanced } from "./components/Advanced"
import { Develop } from "./components/Develop"

export const settingsRoutes = [
  {
    name: "Notifications",
    icon: BellIcon,
    path: "notifications",
    element: <Notifications />
  },
  {
    name: "Appearance",
    icon: PaintbrushIcon,
    path: "appearance",
    element: <Appearance />
  },
  {
    name: "Language & region",
    icon: GlobeIcon,
    path: "language-and-region",
    element: <LanguageAndRegion />
  },
  {
    name: "Advanced",
    icon: SettingsIcon,
    path: "advanced",
    element: <Advanced />
  },
  {
    name: "Develop",
    icon: CodeIcon,
    path: "developpers",
    element: <Develop />
  }
]       