import { describe, expect, it } from 'vitest';
import { idDeJob } from './queues';

describe('idDeJob', () => {
  it('nunca tem dois-pontos, que o BullMQ recusa lançando erro no add', () => {
    expect(idDeJob('campanha', 'cmabc123')).toBe('campanha-cmabc123');
    expect(idDeJob('expirar', 'pedido:com:dois-pontos')).not.toContain(':');
  });
});
