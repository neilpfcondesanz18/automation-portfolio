import { renderHook, act } from '@testing-library/react';
import { useAIModule } from '../../../src/hooks/useAIModule';

describe('useAIModule', () => {
  it('initialises with empty state', () => {
    const { result } = renderHook(() => useAIModule(jest.fn()));
    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading true while async fn is pending', async () => {
    let resolve;
    const asyncFn = jest.fn(() => new Promise((r) => { resolve = r; }));

    const { result } = renderHook(() => useAIModule(asyncFn));

    act(() => {
      result.current.execute('arg1');
    });

    expect(result.current.loading).toBe(true);

    await act(async () => { resolve({ data: 'ok' }); });

    expect(result.current.loading).toBe(false);
  });

  it('sets result on success', async () => {
    const mockData = { testCases: [] };
    const asyncFn = jest.fn().mockResolvedValue(mockData);

    const { result } = renderHook(() => useAIModule(asyncFn));

    await act(async () => {
      await result.current.execute('input');
    });

    expect(result.current.result).toEqual(mockData);
    expect(result.current.error).toBeNull();
  });

  it('sets error on failure and clears result', async () => {
    const asyncFn = jest.fn().mockRejectedValue(new Error('API failed'));

    const { result } = renderHook(() => useAIModule(asyncFn));

    await act(async () => {
      await result.current.execute('input');
    });

    expect(result.current.error).toBe('API failed');
    expect(result.current.result).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('passes arguments through to asyncFn', async () => {
    const asyncFn = jest.fn().mockResolvedValue({});
    const { result } = renderHook(() => useAIModule(asyncFn));

    await act(async () => {
      await result.current.execute('story text', 'gherkin');
    });

    expect(asyncFn).toHaveBeenCalledWith('story text', 'gherkin');
  });

  it('resets state when reset() is called', async () => {
    const asyncFn = jest.fn().mockResolvedValue({ data: 'some result' });
    const { result } = renderHook(() => useAIModule(asyncFn));

    await act(async () => {
      await result.current.execute('input');
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('clears previous error on new execute call', async () => {
    const asyncFn = jest.fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce({ data: 'ok' });

    const { result } = renderHook(() => useAIModule(asyncFn));

    await act(async () => { await result.current.execute('input'); });
    expect(result.current.error).toBe('First error');

    await act(async () => { await result.current.execute('input'); });
    expect(result.current.error).toBeNull();
    expect(result.current.result).toEqual({ data: 'ok' });
  });

  it('returns the result from execute()', async () => {
    const mockData = { foo: 'bar' };
    const asyncFn = jest.fn().mockResolvedValue(mockData);
    const { result } = renderHook(() => useAIModule(asyncFn));

    let returned;
    await act(async () => {
      returned = await result.current.execute();
    });

    expect(returned).toEqual(mockData);
  });

  it('returns null from execute() on failure', async () => {
    const asyncFn = jest.fn().mockRejectedValue(new Error('fail'));
    const { result } = renderHook(() => useAIModule(asyncFn));

    let returned;
    await act(async () => {
      returned = await result.current.execute();
    });

    expect(returned).toBeNull();
  });
});
