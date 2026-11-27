// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { readPendingRemovals, writePendingRemovals } from './narrowOverlay';

const SCOPE = JSON.stringify(['u1', '1']);
const KEY = `shellui.navigation.pendingRemovals:${SCOPE}`;

afterEach(() => sessionStorage.clear());

describe('stored pending removals', () => {
  it('round-trips per scope and clears when empty', () => {
    writePendingRemovals(SCOPE, [{ kind: 'revoke', appId: 'notes', capabilities: ['storage'] }]);
    expect(readPendingRemovals(SCOPE)).toEqual([
      { kind: 'revoke', appId: 'notes', capabilities: ['storage'] },
    ]);
    expect(readPendingRemovals(JSON.stringify(['u2', '1']))).toEqual([]);
    writePendingRemovals(SCOPE, []);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('drops entries that are not a removal this shell would make', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify([
        { kind: 'revoke', appId: 'notes', capabilities: ['theme'] },
        { kind: 'revoke', appId: 'notes', capabilities: ['storage', 'locale'] },
        { kind: 'revoke', appId: 'notes', capabilities: [] },
        { kind: 'revoke', appId: 'notes', capabilities: [1] },
        { kind: 'grant', appId: 'notes' },
        { kind: 'uninstall' },
        'notes',
        { kind: 'uninstall', appId: 'files' },
        { kind: 'revoke', appId: 'notes', capabilities: ['ai'] },
      ]),
    );
    expect(readPendingRemovals(SCOPE)).toEqual([
      { kind: 'uninstall', appId: 'files' },
      { kind: 'revoke', appId: 'notes', capabilities: ['ai'] },
    ]);
  });

  it('ignores a value that is not JSON', () => {
    sessionStorage.setItem(KEY, '{not json');
    expect(readPendingRemovals(SCOPE)).toEqual([]);
  });
});
