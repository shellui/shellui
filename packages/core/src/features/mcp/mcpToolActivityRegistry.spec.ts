import { describe, expect, it } from 'vitest';
import { humanizeMcpToolName } from './mcpToolActivityRegistry';

describe('mcpToolActivityRegistry', () => {
  it('labels known tools', () => {
    expect(humanizeMcpToolName('storage_delete')).toBe('Delete stored object');
    expect(humanizeMcpToolName('unknown_tool_xyz')).toBeNull();
  });
});
