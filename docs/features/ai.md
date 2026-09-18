---
title: Run on-device AI
sidebar_label: On-device AI
description: 'Settings → AI, Ollama and browser models, and shellui.ai Prompt API messaging from iframe apps.'
---

Shellui can run language models **on the user's device** so every embedded app shares one install and one GPU session. Apps never talk to Ollama or WebGPU directly - they call a browser-shaped API on `@shellui/sdk`, and the **shell** (in `@shellui/core`) owns discovery, model lifecycle, and inference.

Local AI ships as a **default core feature**. You do not install a separate AI package. Turn providers on or off in **Settings → AI**, or disable the whole product in config (see below).

## Disable AI entirely (config kill-switch)

In `shellui.config.json` (default is **enabled** when omitted):

```json
{
  "ai": {
    "enabled": false
  }
}
```

When `ai.enabled` is `false`:

- Settings → AI is hidden
- Develop AI test tools are hidden
- The full `AiBridge` is not mounted (a tiny responder answers `shellui.ai` with `unavailable` / `ai_disabled` so apps do not hang)
- `@mlc-ai/web-llm` is never imported and the WebLLM worker is never started
- Storage nav is **not** shown solely for local AI disk usage

This is separate from the in-app **Settings → AI → Allow apps to use AI** toggle, which soft-disables inference while keeping the AI settings panel available (when the config feature is on).

## Lazy loading (when AI is enabled in config)

Even with config AI on:

- Opening Settings → AI lists the catalog and probes WebGPU / Ollama **without** downloading the WebLLM library
- `@mlc-ai/web-llm` is loaded via dynamic `import()` only on first browser-model **Install** or **load** (and best-effort on delete cache wipe)
- The dedicated Web Worker is constructed only at that same time

## What you install or download

There are three optional paths. None requires a Shellui cloud AI backend:

- **Ollama** — the reliable, recommended path when a model is installed on the machine.
- **Chrome built-in Prompt API** — the browser's own on-device model (`LanguageModel` / Gemini Nano). Shown **only when Chrome provides it**; it will not appear on Firefox, Safari, or iPhone.
- **Browser models (WebLLM)** — a curated in-browser catalog downloaded to WebGPU.

### Ollama (app on the machine)

1. Install [Ollama](https://ollama.com/) on the computer.
2. Pull a model there (for example `ollama pull llama3.2`).
3. Open **Settings → AI** in Shellui. If Ollama is running locally, the shell lists those models.

Models stay in Ollama's own storage. The browser only calls a local HTTP API (`http://127.0.0.1:11434` by default). If Ollama is not running, Shellui soft-fails - the rest of the shell still works.

### Chrome built-in Prompt API (Gemini Nano)

Recent Chromium exposes a built-in on-device model through the **Prompt API** (`LanguageModel`, formerly `window.ai.languageModel`). When present, Shellui feature-detects it and shows a **Built-in browser model** row under **Settings → AI → Providers** with the hint “Built-in browser model (Chrome Prompt API)”. If the model is `downloadable`, an **Install** button triggers the browser's own download (with progress); once `available`, prompts run through the same `shellui.ai` path as any other provider — apps do not care which provider answers.

**Show only when present.** Shellui feature-detects the global (`LanguageModel`, or the legacy `ai.languageModel`) and its `availability()`. If the API is missing or reports `unavailable` — **Firefox, Safari, iPhone, Chrome without the model, older Chrome** — the row is **omitted entirely**: no warning, no disabled stub. Conversations are stateless (a fresh `LanguageModel` session per turn, seeded with history), so there is no per-session lock to get wedged.

### Browser models (WebLLM / WebGPU)

**Settings → AI** lists a curated browser catalog. **Install** uses [`@mlc-ai/web-llm`](https://webllm.mlc.ai/) to fetch MLC weights from Hugging Face (via WebLLM’s prebuilt model library — not a custom HF downloader), warms a **dedicated Web Worker** engine, and marks the model ready when inference can run.

**Recommended browsers for in-browser Install:** **Chrome**, **Edge**, and **Safari** (mature WebGPU). Firefox also ships WebGPU, but its implementation is less mature for WebLLM engine init, so Install there is **experimental**. Shellui no longer hard-blocks Firefox: Settings shows a warning banner (Chrome/Edge/Safari recommended; Ollama is the reliable alternative) but **Install is still allowed** so you can try. If it fails, you get the real mapped error (`[shellui.ai]` console + toast) instead of a generic “Model download failed.”

**Debugging Install:** Hugging Face weight requests run **inside the WebLLM worker**, so they may not appear on the main-document Network list — check the worker’s Network/console in DevTools. Failures log as `console.error('[shellui.ai]', …)` on the page and show the real message in the transfer toaster (WebGPU worker failures map to a clear “WebGPU failed in the WebLLM worker” message).

Closing Settings does **not** cancel the download. Progress continues in the shell root **transfer toaster** (same UI as storage uploads). In-panel progress returns if you reopen Settings mid-download.

After Install completes, apps can call `shellui.ai.languageModel` immediately — no second “load” step on the happy path (the worker keeps the model warm). Reloading the tab may need a short cache warm on first prompt; the install record survives in `localStorage` and weights stay in WebLLM’s browser cache.

Reused sessions (e.g. playground Chat asking a second question) serialize generations on the shared WebLLM worker, drain each stream fully, and call `interruptGenerate()` between turns so the next `promptStreaming` does not hang. The shell also accumulates user/assistant history on the `AiSession` and passes full `messages` into WebLLM for multi-turn context.

**Conversation switching (WebLLM vs Ollama).** Ollama is stateless — each `/api/generate` HTTP call is independent, so switching chats never carries state over. WebLLM's worker keeps engine **chat + KV cache** state between `chat.completions.create` calls and holds a per-model generation lock, so a new conversation can inherit the previous one's state or, worse, deadlock behind an undrained lock.

We initially tried soft `resetChat`, then `interruptGenerate()` + `reload` on the **living** worker. Neither was reliable in the field, and the reason is upstream: [`mlc-ai/web-llm#701`](https://github.com/mlc-ai/web-llm/pull/701) (still open, not in npm) shows the model **lock is not always released after a streamed completion**, so the next `chat.completions.create({ stream: true })` can hang forever; and [`mlc-ai/mlc-llm#3113`](https://github.com/mlc-ai/mlc-llm/issues/3113) shows `interruptGenerate()` can leave `interruptSignal` / the lock stuck. We pin [`@mlc-ai/web-llm@0.2.85`](https://www.npmjs.com/package/@mlc-ai/web-llm) (latest on npm), which still ships this class of bug (#701 is unmerged). Interrupt/reload on a worker that already holds a stuck lock is fighting that bug.

So the reliable v1 strategy is **nuclear**: on a genuine conversation switch (a `create` for a new session, a prompt whose `sessionId` differs from the warm one, or a `destroy` of the active session) we **fully dispose the WebLLM worker** (`worker.terminate()`) — killing any stuck lock with it — and let the next prompt recreate a fresh `CreateWebWorkerMLCEngine` for the same model id. Weights come from the **WebLLM browser cache**, so this is a short warm (progress may briefly flash), not a full Hugging Face re-download. We deliberately do **not** await `engine.unload()` first, because a wedged worker may never ack. The very first conversation and same-session multi-turn keep the warm worker (no recreate, KV preserved within the turn).

**Stop / abort** takes the same path: after an aborted stream the worker is disposed, so the next prompt starts on a fresh engine instead of hitting a possibly-stuck lock — a hung "Thinking…" is worse UX than a quick recreate.

A fire-and-forget `destroy` of the **previous** session must not tear down the **new** one's worker: core tracks `activeSessionId` and skips the dispose for stale destroys. Prefer awaiting `session.destroy()` before `create()` in apps (`session.destroy()` returns a Promise).

Catalog model ids (after the `webllm:` prefix) match WebLLM `model_id` strings, for example:

- `Llama-3.2-1B-Instruct-q4f16_1-MLC`
- `Phi-3.5-mini-instruct-q4f16_1-MLC`

**v1 limit:** one browser model warm at a time (switching models reloads the worker engine).

Browser installs need **WebGPU** (Chrome, Edge, or Safari recommended).

## Why apps don't load WebLLM themselves

If every iframe downloaded and warmed its own copy:

- Disk and RAM would multiply per app
- Phones would thrash GPU memory
- Users would re-download the same weights

The shell keeps **one** registry and **one** WebLLM worker runtime. Apps call `shellui.ai.languageModel` (Prompt API / `LanguageModel` shape). The SDK only `postMessage`s to the parent; adapters (`OllamaAdapter`, `WebLLMAdapter`, …) stay in core. AI requests use the same privileged companion + trusted-frame policy as storage (`safeForAuthToken`).

## WebGPU and soft degradation

Browser catalog installs need **WebGPU**. Settings → AI shows WebGPU, Ollama, and browser storage status. If WebGPU is missing:

- Ollama can still work when installed
- Browser catalog models show as needing WebGPU
- Apps see `availability()` as `unavailable` or `downloadable` instead of hard crashes

## What you should know (risks)

| Topic             | Plain language                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Disk size         | Browser models are large (hundreds of MB to multi-GB).                                                        |
| First-load time   | First Install downloads weights; later loads use WebLLM’s cache when possible.                                |
| Battery / heat    | Local inference uses the CPU/GPU; laptops and phones can get warm.                                            |
| Untrusted prompts | Apps send the text. Treat it like any other untrusted input (prompt injection, sensitive data in the prompt). |
| Privacy           | v1 stays on-device. A later hosted backend is out of scope for this feature's first version.                  |

## Settings → AI

Open the built-in settings route (default `/__settings`), then **Preferences → AI**.

You can:

- Allow or block apps from using AI
- Scan WebGPU / Ollama / browser storage status
- Pick a default model (automatic when only one is ready)
- Toggle Ollama and browser providers
- List Ollama models when reachable
- Install / cancel / remove browser catalog models (real WebLLM download + worker inference)

**Try it locally:** use **Chrome, Edge, or Safari** with WebGPU → Settings → AI → Install a catalog model → wait for the toaster / panel to finish → Settings → Develop → AI test tools, or call `shellui.ai` from an iframe app. On Firefox, Install is experimental — prefer Ollama if it fails.

**Settings → Develop** has **AI test tools** (probe, list, one-shot and stream prompt) for developers. Day-to-day setup stays on Settings → AI.

## Developer SDK sketch

```typescript
import { shellui } from '@shellui/sdk';

await shellui.init();

const availability = await shellui.ai.languageModel.availability();
// 'available' | 'downloadable' | 'downloading' | 'unavailable'

if (availability !== 'available') {
  console.warn('No ready model yet - open Settings → AI');
} else {
  const session = await shellui.ai.languageModel.create();
  const text = await session.prompt('Summarize this…');
  for await (const chunk of session.promptStreaming('…')) {
    // stream tokens
  }
  session.destroy();
}
```

Messaging (for implementers): `SHELLUI_AI_REQUEST` → shell → `SHELLUI_AI_RESPONSE` / `SHELLUI_AI_STREAM` back to the requesting iframe only.

## Architecture

```
App iframe
  └─ shellui.ai / LanguageModel (packages/sdk/src/ai)
       └─ postMessage (privileged + trusted-frame)
            └─ AiBridge (packages/core/src/features/ai)
                 ├─ registry + adapters/
                 │    ├─ OllamaAdapter
                 │    └─ WebLLMAdapter → WebLLMEngineService (worker)
                 ├─ transfer toaster (shared with storage uploads)
                 └─ Settings → AI panel
```

Module map and notes: `packages/core/src/features/ai/README.md`.

## Related

- Issue [#47](https://github.com/shellui/shellui/issues/47) - full v1 acceptance
- [SDK](/sdk) - general iframe APIs
- [Storage](/features/storage) - similar shell-owned bridge pattern
