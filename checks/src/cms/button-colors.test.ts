import { expect, it } from 'vitest';
import { buttonColorStyle, safeButtonColor, colorInputValue } from './content';
import { blockHtml } from './blocks';
it('Knopkleuren bewaren exact de gekozen achtergrond en tekstkleur', () => {
  expect(buttonColorStyle({buttonBackground:'#123456',buttonForeground:'#fefefe'})).toEqual({backgroundColor:'#123456',color:'#fefefe'});
});
it('Knopkleuren accepteren geen ongevalideerde CSS', () => {
  expect(safeButtonColor('red;background:url(https://example.com)')).toBeUndefined();
  expect(buttonColorStyle({buttonBackground:'var(--secret)'})).toEqual({});
  expect(colorInputValue('rgb(18, 52, 86)')).toBe('#123456');
});
it('Een gekopieerd blok behoudt de gekozen knopkleuren', () => {
  const html = '<section><a href="/">Knop</a></section>';
  const result = blockHtml('', {i:'btest',html}, {'btest:c0-0':{buttonBackground:'#123456',buttonForeground:'#fefefe'}});
  expect(result).toContain('background-color:#123456');
  expect(result).toContain('color:#fefefe');
});