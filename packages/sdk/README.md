# @shellui/sdk

Shellui SDK — JavaScript SDK for Shellui integration.

## Installation

```bash
npm install @shellui/sdk
```

## Full SDK

```javascript
import { shellui } from '@shellui/sdk';

await shellui.init();
shellui.toast({ title: 'Hello', type: 'success' });
```

## Tiny CDN script

For external sites that only need theme, language/region, and navigation sync, use the tiny injectable (~2 KB):

```html
<script
  src="https://cdn.jsdelivr.net/npm/@shellui/sdk/dist/shellui.tiny.js"
  async
></script>
<script>
  shellui.ready.then(() => shellui.applyTheme());
  shellui.on('theme', () => shellui.applyTheme());
</script>
```

Or via npm:

```js
import shellui from '@shellui/sdk/tiny';
```

See the [SDK docs](https://docs.shellui.com/sdk) for the full API and tiny section.

## License

MIT
