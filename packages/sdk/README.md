# @shellui/sdk

JavaScript/TypeScript SDK for iframe apps hosted in Shellui. Call `init`, then use host chrome (toasts, dialogs, overlays) and storage. Do not reach into host DOM.

## Installation

```bash
npm install @shellui/sdk
```

## Full SDK

```typescript
import { shellui } from "@shellui/sdk";

await shellui.init();
shellui.toast({ title: "Hello", type: "success" });
```

## Tiny CDN script

For external pages that only need theme, language/region, navigation, and layout chrome (~2 KB min):

```html
<script
  src="https://cdn.jsdelivr.net/npm/@shellui/sdk/dist/shellui.tiny.js"
  async
></script>
<script>
  shellui.ready.then(() => shellui.applyTheme());
  shellui.on("theme", () => shellui.applyTheme());
</script>
```

Or via npm:

```typescript
import shellui from "@shellui/sdk/tiny";
```

API reference: [SDK docs](https://docs.shellui.com/sdk).

## License

MIT
