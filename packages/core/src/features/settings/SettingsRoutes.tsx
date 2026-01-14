import {
  BellIcon,
  MenuIcon,
  HomeIcon,
  PaintbrushIcon,
  MessageCircleIcon,
  GlobeIcon,
  KeyboardIcon,
  CheckIcon,
  VideoIcon,
  LinkIcon,
  LockIcon,
  SettingsIcon,
} from "./SettingsIcons"

export const settingsRoutes = [
  {
    name: "Notifications",
    icon: BellIcon,
    path: "notifications",
    element: <div>Notifications page</div>
  },
  {
    name: "Navigation",
    icon: MenuIcon,
    path: "navigation",
    element: <div>Navigation page</div>
  },
  {
    name: "Home",
    icon: HomeIcon,
    path: "home",
    element: <div>Home page</div>
  },
  {
    name: "Appearance",
    icon: PaintbrushIcon,
    path: "appearance",
    element: <div>Appearance page</div>
  },
  {
    name: "Messages & media",
    icon: MessageCircleIcon,
    path: "messages-and-media",
    element: <div>Messages & media page</div>
  },
  {
    name: "Language & region",
    icon: GlobeIcon,
    path: "language-and-region",
    element: <div>Language & region page</div>
  },
  {
    name: "Accessibility",
    icon: KeyboardIcon,
    path: "accessibility",
    element: <div>Accessibility page</div>
  },
  {
    name: "Mark as read",
    icon: CheckIcon,
    path: "mark-as-read",
    element: <div>Mark as read page</div>
  },
  {
    name: "Audio & video",
    icon: VideoIcon,
    path: "audio-and-video",
    element: <div>Audio & video page</div>
  },
  {
    name: "Connected accounts",
    icon: LinkIcon,
    path: "connected-accounts",
    element: <div>Connected accounts page</div>
  },
  {
    name: "Privacy & visibility",
    icon: LockIcon,
    path: "privacy-and-visibility",
    element: <div>Privacy & visibility page</div>
  },
  {
    name: "Advanced",
    icon: SettingsIcon,
    path: "advanced",
    element: <div>Advanced page</div>
  },
]