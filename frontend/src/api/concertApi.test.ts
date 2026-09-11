import { beforeEach, describe, expect, it, vi } from 'vitest';
import { concertApi } from './concertApi';

describe('concertApi database source', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns API concerts without mock fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([{ concert_id: 'CC9', concert_name: 'Real' }]), { status: 200 }));
    await expect(concertApi.getConcerts()).resolves.toEqual([expect.objectContaining({ concert_id: 'CC9' })]);
  });

  it('surfaces network errors instead of returning defaults', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    await expect(concertApi.getConcerts()).rejects.toThrow('offline');
  });
});
