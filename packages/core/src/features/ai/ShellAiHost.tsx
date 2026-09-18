import { lazy, Suspense } from 'react';
import { useConfig } from '../config/useConfig';
import { AiUnavailableResponder } from './AiUnavailableResponder';
import { isAiFeatureEnabled } from './isAiFeatureEnabled';

/**
 * Lazy-load the full AiBridge (adapters / WebLLM engine graph) only when
 * `config.ai.enabled` is not false. Disabled shells get a tiny unavailable responder.
 */
const AiBridgeLazy = lazy(() => import('./AiBridge').then((mod) => ({ default: mod.AiBridge })));

export function ShellAiHost() {
  const { config } = useConfig();

  if (!isAiFeatureEnabled(config)) {
    return <AiUnavailableResponder />;
  }

  return (
    <Suspense fallback={null}>
      <AiBridgeLazy />
    </Suspense>
  );
}
