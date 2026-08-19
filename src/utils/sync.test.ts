import { describe, it, expect } from 'vitest';
import { SYNC_INTERVALS } from './sync';

describe('SYNC_INTERVALS', () => {
  it('should have correct values in minutes', () => {
    expect(SYNC_INTERVALS['15min']).toBe(15);
    expect(SYNC_INTERVALS['30min']).toBe(30);
    expect(SYNC_INTERVALS['1hour']).toBe(60);
    expect(SYNC_INTERVALS['2hours']).toBe(120);
    expect(SYNC_INTERVALS['1day']).toBe(1440);
  });

  it('should have all intervals as const', () => {
    const keys = Object.keys(SYNC_INTERVALS);
    expect(keys).toEqual(['15min', '30min', '1hour', '2hours', '1day']);
  });
});
