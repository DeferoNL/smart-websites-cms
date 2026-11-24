import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';

type Row = { k: string; n: number };
type Stats = { daily: { day: string; visitors: number; views: number }[]; visitors: number; views: number; pages: Row[]; entries: Row[]; exits: Row[]; sources: Row[]; devices: Row[] };
const nf = new Intl.NumberFormat('nl-NL');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function Chart({ title, data, total }: { title: string; data: { day: string; v: number }[]; total: number }) {
  const W = 540, H = 240, L = 40, B = 46, T = 50;
  const max = Math.max(1, ...data.map(d => d.v)), min = Math.min(...data.map(d => d.v), max);
  const lo = Math.max(0, Math.floor(min - (max - min) * 0.05)), hi = Math.ceil(max + (max - min) * 0.05) || 1;
  const x = (i: number) => L + (i * (W - L - 10)) / Math.max(1, data.length - 1);
  const y = (v: number) => T + (H - T - B) * (1 - (v - lo) / Math.max(1, hi - lo));
  const ticks = Array.from({ length: 6 }, (_, i) => lo + ((hi - lo) * i) / 5);
  const step = Math.max(1, Math.ceil(data.length / 16));
  return (
    <section>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="relative rounded-xl border border-border bg-card p-3">
        <span className="absolute right-4 top-4 rounded-md bg-muted px-2 py-0.5 text-xs">Totaal: {nf.format(total)}</span>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
          {ticks.map((t, i) => <g key={i}><line x1={L} x2={W - 10} y1={y(t)} y2={y(t)} className="stroke-border" /><text x={L - 6} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground text-[10px]">{Math.round(t)}</text></g>)}
          {data.map((d, i) => i % step === 0 && <g key={d.day}><line x1={x(i)} x2={x(i)} y1={T} y2={H - B} className="stroke-border" /><text transform={`translate(${x(i)},${H - B + 10}) rotate(-50)`} textAnchor="end" className="fill-muted-foreground text-[10px]">{+d.day.slice(8)} {MONTHS[+d.day.slice(5, 7) - 1]}</text></g>)}
          <polyline fill="none" strokeWidth={2} className="stroke-primary" points={data.map((d, i) => `${x(i)},${y(d.v)}`).join(' ')} />
        </svg>
      </div>
    </section>
  );
}

function List({ title, rows }: { title: string; rows: Row[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? rows : rows.slice(0, 7);
  return (
    <section>
      <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">{title}</h3>
        {rows.length > 7 && <button type="button" onClick={() => setAll(!all)} className="rounded-md bg-muted px-2 py-0.5 text-xs">{all ? 'Minder' : 'Details'}</button>}</div>
      <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {shown.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">Nog geen gegevens</p>}
        {shown.map(r => <div key={r.k} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="truncate">{r.k}</span><span className="rounded-md bg-muted px-2 py-0.5 text-xs">{nf.format(r.n)}</span></div>)}
      </div>
    </section>
  );
}

export function StatsDialog({ onClose }: { onClose: () => void }) {
  const [days, setDays] = useState(30);
  const [s, setS] = useState<Stats | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    let active = true;
    setS(null);
    setErr('');
    const load = async () => {
      try {
        const { data, error } = await supabase.rpc('get_stats', { _days: days });
        if (!active) return;
        if (error || !data) setErr('Statistieken konden niet worden geladen.');
        else setS(data as unknown as Stats);
      } catch {
        if (active) setErr('Statistieken konden niet worden geladen.');
      }
    };
    void load();
    return () => { active = false; };
  }, [days]);
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="dark sw-admin max-h-[92vh] max-w-6xl overflow-y-auto text-foreground">
        <DialogHeader><DialogTitle className="text-2xl font-normal">Statistieken</DialogTitle></DialogHeader>
        <div className="flex justify-end border-t border-border pt-4">
          <select value={days} onChange={e => setDays(+e.target.value)} className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <option value={1}>Vandaag</option><option value={7}>7 dagen</option><option value={30}>30 dagen</option><option value={90}>90 dagen</option><option value={365}>Jaar</option>
          </select>
        </div>
        {err ? <p className="text-destructive">{err}</p> : !s ? <p className="text-muted-foreground">Laden…</p> : (
          <div className="grid gap-8 md:grid-cols-2">
            <Chart title="Unieke bezoekers" total={s.visitors} data={s.daily.map(d => ({ day: d.day, v: d.visitors }))} />
            <Chart title="Pagina weergaves" total={s.views} data={s.daily.map(d => ({ day: d.day, v: d.views }))} />
            <List title="Top pagina's" rows={s.pages} />
            <List title="Top ingangspagina's" rows={s.entries} />
            <List title="Top uitgangspagina's" rows={s.exits} />
            <List title="Top bronnen" rows={s.sources} />
            <List title="Top apparaten" rows={s.devices} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
