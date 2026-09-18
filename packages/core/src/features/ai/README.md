# On-device AI (core module)

Local AI is a **default `@shellui/core` feature**. Embedded apps call `@shellui/sdk` (`shellui.ai`); this module owns adapters, registry, and the shell bridge. Requests use the same privileged companion + trusted-frame policy as storage.

## Layout

```
features/ai/
  adapters/              OllamaAdapter, WebLLMAdapter (catalog install stub)
  browserInstallStore.ts Persist browser catalog installs (reload / same-origin reuse)
  catalog.ts             Curated browser model list
  createRegistry.ts      Default registry factory (Ollama + shared WebLLM)
  registry.ts            Adapter multiplex
  status.ts              WebGPU + Ollama soft probes
  types.ts               Adapter / model types
  handleRequest.ts       SHELLUI_AI_* request handler
  developHarness.ts      Settings → Develop diagnostics / prompt harness
  AiBridge.tsx           Root-window message bridge (mounted from app.tsx)
  *.spec.ts              Unit tests (mocked; no WebGPU / Ollama in CI)
```

Settings UI: `features/settings/components/Ai.tsx` (Preferences → AI).
Developer harness: `features/settings/components/develop/AiTestTools.tsx` (Develop → Testing).

## Disable (not uninstall)

Use **Settings → AI**:

- Turn off "Allow apps to use AI"
- Toggle Ollama / browser providers

There is no separate `@shellui/ai` package to remove.
