# On-device AI (core module)

Local AI is a **default `@shellui/core` feature**. Embedded apps call `@shellui/sdk` (`shellui.ai`); this module owns adapters, registry, and the shell bridge.

## Layout

```
features/ai/
  adapters/          OllamaAdapter, WebLLMAdapter (stub)
  catalog.ts         Curated browser model list (not downloaded yet)
  createRegistry.ts  Default registry factory (Ollama + WebLLM)
  registry.ts        Adapter multiplex
  status.ts          WebGPU + Ollama soft probes
  types.ts           Adapter / model types
  handleRequest.ts   SHELLUI_AI_* request handler
  AiBridge.tsx       Root-window message bridge (mounted from app.tsx)
  *.spec.ts          Unit tests (mocked; no WebGPU CI)
```

Settings UI: `features/settings/components/Ai.tsx` (Preferences → AI).

## Disable (not uninstall)

Use **Settings → AI**:

- Turn off “Allow apps to use AI”
- Toggle Ollama / browser providers

There is no separate `@shellui/ai` package to remove.
