import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StatsDialog } from './StatsDialog';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const data = (views: number) => ({ daily: [{ day: '2026-11-24', visitors: 1, views }], visitors: 1, views, pages: [], entries: [], exits: [], sources: [], devices: [] });
const deferred = () => {
  let complete: ((value: { data: ReturnType<typeof data> | null; error: unknown }) => void) | undefined;
  const promise = new Promise<{ data: ReturnType<typeof data> | null; error: unknown }>(resolve => { complete = resolve; });
  return { promise, resolve: (value: { data: ReturnType<typeof data> | null; error: unknown }) => {
    if (!complete) throw new Error('No pending load');
    complete(value);
  } };
};
afterEach(() => { cleanup(); rpc.mockReset(); });

describe('statistics period loading', () => {
  it('displays successful results after an earlier period failed', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error('Offline') });
    rpc.mockResolvedValueOnce({ data: data(7), error: null });
    render(<StatsDialog onClose={() => undefined} />);
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '7' } });
    await waitFor(() => expect(screen.getByText('Totaal: 7')).toBeInTheDocument());
    expect(rpc).toHaveBeenLastCalledWith('get_stats', { _days: 7 });
  });

  it('does not let an older response overwrite the selected period', async () => {
    const old = deferred();
    const recent = deferred();
    rpc.mockReturnValueOnce(old.promise).mockReturnValueOnce(recent.promise);
    render(<StatsDialog onClose={() => undefined} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });
    await act(async () => recent.resolve({ data: data(4), error: null }));
    expect(screen.getByText('Totaal: 4')).toBeInTheDocument();
    await act(async () => old.resolve({ data: data(30), error: null }));
    expect(screen.getByText('Totaal: 4')).toBeInTheDocument();
    expect(screen.queryByText('Totaal: 30')).not.toBeInTheDocument();
  });

  it('recovers from a rejected request on a new period', async () => {
    rpc.mockRejectedValueOnce(new Error('Connection failed'));
    rpc.mockResolvedValueOnce({ data: data(9), error: null });
    render(<StatsDialog onClose={() => undefined} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '90' } });
    await waitFor(() => expect(screen.getByText('Totaal: 9')).toBeInTheDocument());
  });
});