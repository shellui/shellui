# On-device AI (core module)

Local AI is a **default `@shellui/core` feature**. Embedded apps call `@shellui/sdk` (`shellui.ai`); this module owns adapters, registry, and the shell bridge. Requests use the same privileged companion + trusted-frame policy as storage.

## Layout

```
features/ai/
  adapters/              OllamaAdapter, WebLLMAdapter
  engine/                WebLLMEngineService + webllm.worker.ts (CreateWebWorkerMLCEngine)
  browserInstallStore.ts Persist browser catalog installs (reload / same-origin reuse)
  catalog.ts             Curated browser model list (WebLLM model_id strings)
  createRegistry.ts      Default registry factory (Ollama + shared WebLLM)
  registry.ts            Adapter multiplex
  status.ts              WebGPU + Ollama soft probes
  types.ts               Adapter / model types
  handleRequest.ts       SHELLUI_AI_* request handler
  developHarness.ts      Settings → Develop diagnostics / prompt harness
  AiBridge.tsx           Root-window message bridge (mounted from app.tsx)
  *.spec.ts              Unit tests (mocked engine; no live HF / WebGPU in CI)
```

Shared progress UI: `features/transfers/` (`TransferToaster` / `transferQueue`) — used by storage uploads and AI model downloads.

Settings UI: `features/settings/components/Ai.tsx` (Preferences → AI).
Developer harness: `features/settings/components/develop/AiTestTools.tsx` (Develop → Testing).

## Browser runtime notes

- Dependency: `@mlc-ai/web-llm` (dynamically imported when browser AI is used).
- Worker: `engine/webllm.worker.ts` + `CreateWebWorkerMLCEngine` so the UI thread stays responsive.
- Progress: WebLLM `initProgressCallback` → transfer toaster + Settings panel (no fake timers).
- Warm model: Install leaves the engine ready for `prompt` / `promptStreaming`. v1 keeps **one** browser model warm at a time.

## Disable (not uninstall)

Use **Settings → AI**:

- Turn off "Allow apps to use AI"
- Toggle Ollama / browser providers

There is no separate `@shellui/ai` package to remove.
