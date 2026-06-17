import { describe, expect, it } from 'vitest';

import { legacyMaxKbDefaultPrologue } from './base-node-application-info';
import { buildDebugApplicationDetails } from './debug-application-details';

function graphWithBasePrologue(prologue: null | string | undefined) {
  const nodeData = prologue === undefined ? {} : { prologue };
  return JSON.stringify({
    edges: [],
    nodes: [
      {
        id: 'base-node',
        properties: { node_data: nodeData },
        type: 'base-node',
      },
    ],
  });
}

describe('buildDebugApplicationDetails', () => {
  it('uses the latest base-node prologue from graph data', () => {
    const details = buildDebugApplicationDetails(
      { name: '应用', prologue: '旧开场白' },
      graphWithBasePrologue('新的开场白'),
    );

    expect(details.prologue).toBe('新的开场白');
  });

  it('preserves an intentionally empty base-node prologue', () => {
    const details = buildDebugApplicationDetails(
      { prologue: '旧开场白' },
      graphWithBasePrologue(''),
    );

    expect(details.prologue).toBe('');
  });

  it('falls back to application prologue only when graph prologue is absent', () => {
    const details = buildDebugApplicationDetails(
      { prologue: '应用开场白' },
      graphWithBasePrologue(undefined),
    );

    expect(details.prologue).toBe('应用开场白');
  });

  it('passes workflow nodes through for AiChat input fields', () => {
    const details = buildDebugApplicationDetails(
      {},
      graphWithBasePrologue(null),
    );

    expect(details.work_flow.nodes).toHaveLength(1);
  });

  it('normalizes legacy MaxKB XXX prologue before passing details to AiChat', () => {
    const details = buildDebugApplicationDetails(
      { name: '高级智能体2' },
      graphWithBasePrologue(legacyMaxKbDefaultPrologue),
    );

    expect(details.prologue).toContain('高级智能体2');
    expect(details.prologue).not.toContain('XXX');
  });
});
