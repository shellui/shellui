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

**Note:** MCP settings copy and identity field contracts (for example `global_mcp_url` as the full dashboard `/mcp` URL) are tracked with [shellui/shellui#182](https://github.com/shellui/shellui/pull/182). Declarative docs will be updated when that pull request lands.

## License

MIT
