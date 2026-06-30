import { describe, it, expect } from 'vitest';
import { formatSyncInterval, SYNC_INTERVALS } from './sync';

describe('formatSyncInterval', () => {
  it('should return correct label for 15min', () => {
    expect(formatSyncInterval('15min')).toBe('Every 15 minutes');
  });

  it('should return correct label for 30min', () => {
    expect(formatSyncInterval('30min')).toBe('Every 30 minutes');
  });

  it('should return correct label for 1hour', () => {
    expect(formatSyncInterval('1hour')).toBe('Every hour');
  });

  it('should return correct label for 2hours', () => {
    expect(formatSyncInterval('2hours')).toBe('Every 2 hours');
  });

  it('should return correct label for 1day', () => {
    expect(formatSyncInterval('1day')).toBe('Every day');
  });

  it('should return input string for unknown interval', () => {
    expect(formatSyncInterval('5min')).toBe('5min');
    expect(formatSyncInterval('custom')).toBe('custom');
  });
});

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
