# @shellui/core

React runtime for Shellui, the open-source app shell: navigation, layouts, light and dark themes, sign-in, and your apps hosted as micro frontends in one interface. `@shellui/cli` depends on this package. Install it yourself when you import config types or `useAuth` from host code.

```bash
npm install @shellui/core
```

Shellui **0.6.2** is the current stable release: `npm install @shellui/core@0.6.2`.

```typescript
import type { ShellUIConfig } from '@shellui/core';
```

Docs: [Core](https://docs.shellui.com/core), [CLI](https://docs.shellui.com/cli).

In **Settings → MCP / AI agents**, Shellui shows a global MCP URL only when identity returns the full dashboard endpoint (`…/mcp`). Recent tool activity lists classified outcomes and identity error codes only; it never prints raw provider error bodies.

## License

MIT
