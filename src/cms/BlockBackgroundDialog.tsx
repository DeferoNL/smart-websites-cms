import { useState } from 'react';
import { Button } from '../components/ui/button.tsx';
import { Input } from '../components/ui/input.tsx';
import { Label } from '../components/ui/label.tsx';
import { Slider } from '../components/ui/slider.tsx';
import { Switch } from '../components/ui/switch.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog.tsx';
import { colorInputValue, safeButtonColor } from './content.ts';
import { BACKGROUND_PRESETS, contrastColor, hexToRgba, type BlockAppearance } from './block-background.ts';

export function BlockBackgroundDialog({ initial, accent, onChange, onClose }: {
  initial: { background: string; contrast: boolean }; accent?: string | undefined;
  onChange: (appearance: BlockAppearance) => void; onClose: () => void;
}) {
  const [hex, setHex] = useState(colorInputValue(initial.background) ?? '#ffffff');
  const [opacity, setOpacity] = useState(initial.background === 'transparent' ? 0 : Math.round(Number(initial.background.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 1) * 100));
  const [contrast, setContrast] = useState(initial.contrast);
  const apply = (color: string, coverage: number, auto: boolean) => {
    const background = hexToRgba(color, coverage);
    if (background) onChange({ background: coverage === 0 ? 'transparent' : background, ...(auto ? { color: contrastColor(color) } : {}) });
  };
  const presets = [...BACKGROUND_PRESETS, ...(safeButtonColor(accent) ? [{ name: 'Huisstijl accent', hex: accent ?? '', opacity: 100 }] : [])];
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }} modal={false}>
    <DialogContent data-cms-background-dialog className="sm:max-w-sm" onInteractOutside={e => e.preventDefault()}>
      <DialogHeader><DialogTitle>Blokachtergrond</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-2">
        {presets.map(p => <Button key={p.name} variant="outline" size="sm" onClick={() => { setHex(p.hex); setOpacity(p.opacity); apply(p.hex, p.opacity, contrast); }}>{p.name}</Button>)}
      </div>
      <div className="space-y-2">
        <Label htmlFor="block-background-hex">Eigen kleur</Label>
        <div className="flex items-center gap-2">
          <Input type="color" aria-label="Achtergrondkleur kiezen" value={safeButtonColor(hex) ?? '#ffffff'} className="h-10 w-12 shrink-0 p-1" onChange={e => { setHex(e.target.value); apply(e.target.value, opacity, contrast); }} />
          <Input id="block-background-hex" value={hex} maxLength={7} aria-invalid={!safeButtonColor(hex)} onChange={e => { setHex(e.target.value); apply(e.target.value, opacity, contrast); }} />
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between"><Label htmlFor="block-background-opacity">Dekking</Label><span className="text-sm text-muted-foreground">{opacity}%</span></div>
        <Slider id="block-background-opacity" aria-label="Dekking" min={0} max={100} step={1} value={[opacity]} onValueChange={values => { const value = values[0] ?? 0; setOpacity(value); apply(hex, value, contrast); }} />
        <div className="flex justify-between text-xs text-muted-foreground"><span>Transparant</span><span>Ondoorzichtig</span></div>
      </div>
      <div className="flex items-center justify-between gap-3"><Label htmlFor="block-background-contrast">Tekstcontrast aanpassen</Label><Switch id="block-background-contrast" checked={contrast} onCheckedChange={value => { setContrast(value); apply(hex, opacity, value); }} /></div>
      <Button onClick={onClose}>Gereed</Button>
    </DialogContent>
  </Dialog>;
}