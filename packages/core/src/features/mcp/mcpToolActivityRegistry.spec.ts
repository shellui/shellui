import { describe, expect, it } from 'vitest';
import { humanizeMcpActivityResult, humanizeMcpToolName } from './mcpToolActivityRegistry';

describe('mcpToolActivityRegistry', () => {
  it('labels known tools', () => {
    expect(humanizeMcpToolName('storage_delete')).toBe('Delete stored object');
    expect(humanizeMcpToolName('unknown_tool_xyz')).toBeNull();
  });

  it('labels known results', () => {
    expect(humanizeMcpActivityResult('ok')).toBe('Completed');
    expect(humanizeMcpActivityResult('pending_approval')).toBe('Pending approval');
  });
});
