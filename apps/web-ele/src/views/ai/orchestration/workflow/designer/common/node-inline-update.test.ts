import { describe, expect, it, vi } from 'vitest';

import { syncNodeProperties } from './node-inline-update';

describe('workflow node inline update', () => {
  it('syncs node properties and emits inline update without refreshing the Vue component by default', () => {
    const emit = vi.fn();
    const refreshVueComponent = vi.fn();
    const nodeModel = {
      graphModel: { eventCenter: { emit } },
      id: 'reply-node_1',
      properties: { node_data: { reply_type: 'content' } },
      refreshVueComponent,
    };

    syncNodeProperties(
      nodeModel,
      { node_data: { reply_type: 'referencing' } },
      ['node_data'],
    );

    expect(nodeModel.properties.node_data).toEqual({
      reply_type: 'referencing',
    });
    expect(refreshVueComponent).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('node:inline-update', {
      fields: ['node_data'],
      id: 'reply-node_1',
      properties: nodeModel.properties,
      source: 'vue-node',
    });
  });
});
