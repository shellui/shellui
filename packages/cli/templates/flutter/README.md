# shellui_flutter (Flutter Web)

Official `flutter create --platforms=web --empty` starter for use as a Shellui companion.

**Flutter Web only** — iOS/Android are out of scope for `shellui init`. Requires the [Flutter SDK](https://docs.flutter.dev/get-started/install) on your PATH.

## Shellui SDK status

There is **no** `@shellui/sdk` / Dart handshake yet (JS starters call `shellui.ready`; Flutter does not). This template only provides a Web companion that Shellui can iframe. Theme / chrome padding / URL sync from the shell will come later when a Dart SDK exists.

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

**Cold start:** the first `flutter run -d web-server` compile often takes longer than Shellui’s default **60s** companion wait. If `shellui start` times out waiting for `:8080`, run the Flutter command once until it serves, then retry `shellui start` (or start Flutter yourself and point `dev.url` at it).

## Run standalone

```bash
flutter run -d web-server --web-hostname=localhost --web-port=8080
```
