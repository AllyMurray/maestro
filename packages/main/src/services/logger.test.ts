import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWrite = vi.fn();

vi.mock('fs', () => ({
  default: {
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => ({
      write: mockWrite,
    })),
  },
  mkdirSync: vi.fn(),
  createWriteStream: vi.fn(() => ({
    write: mockWrite,
  })),
}));

describe('logger', () => {
  beforeEach(async () => {
    mockWrite.mockClear();
    vi.resetModules();
  });

  it('writes info log lines with timestamp and level', async () => {
    const { initLogger, logger } = await import('./logger');
    initLogger();
    logger.info('test message');

    expect(mockWrite).toHaveBeenCalledTimes(1);
    const line = mockWrite.mock.calls[0][0] as string;
    expect(line).toMatch(/\[INFO\]/);
    expect(line).toContain('test message');
    expect(line).toMatch(/^\[[\dT:.Z-]+\]/);
  });

  it('writes warn log lines', async () => {
    const { initLogger, logger } = await import('./logger');
    initLogger();
    logger.warn('warning message');

    const line = mockWrite.mock.calls[0][0] as string;
    expect(line).toMatch(/\[WARN\]/);
    expect(line).toContain('warning message');
  });

  it('writes error log lines and console.error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { initLogger, logger } = await import('./logger');
    initLogger();
    logger.error('error message');

    const line = mockWrite.mock.calls[0][0] as string;
    expect(line).toMatch(/\[ERROR\]/);
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('writes debug log lines', async () => {
    const { initLogger, logger } = await import('./logger');
    initLogger();
    logger.debug('debug message');

    const line = mockWrite.mock.calls[0][0] as string;
    expect(line).toMatch(/\[DEBUG\]/);
    expect(line).toContain('debug message');
  });

  it('formats extra args as JSON', async () => {
    const { initLogger, logger } = await import('./logger');
    initLogger();
    logger.info('message with data', { key: 'value' }, 42);

    const line = mockWrite.mock.calls[0][0] as string;
    expect(line).toContain('{"key":"value"}');
    expect(line).toContain('42');
  });
});
