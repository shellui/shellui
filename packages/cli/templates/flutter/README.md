# shellui_flutter (Flutter Web)

Official `flutter create --platforms=web --empty` starter, wired for Shellui.

**Flutter Web only** — iOS/Android are out of scope for `shellui init`. Requires the [Flutter SDK](https://docs.flutter.dev/get-started/install) on your PATH.

## Run with Shellui

```bash
flutter pub get
shellui start
```

Companion (written into `shellui.config.json`):

```text
flutter run -d web-server --web-hostname=localhost --web-port=8080
→ http://localhost:8080
```

## Run standalone

```bash
flutter run -d web-server --web-hostname=localhost --web-port=8080
```
