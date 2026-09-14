// Client-only plugin (.client.ts) — light Shellui host handshake when embedded.
export default defineNuxtPlugin(async () => {
  const { shellui } = await import('@shellui/sdk/tiny');
  void shellui.ready;
});
