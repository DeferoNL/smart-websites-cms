// Standard contact and footer blocks offered in every block library. Browser-safe.
import icons from './icon-library.json';
import { coloredIconUrl } from './icon-colors.ts';
import { applyBlockBackground } from './block-background.ts';

const svg = (name: string) => (icons as { name: string; svg: string }[]).find(i => i.name === name)?.svg ?? '';
const icon = (name: string, color: string) => coloredIconUrl(svg(name), color);

export const SOCIAL_KEYS = [
  ['instagram', 'Instagram'], ['facebook', 'Facebook'], ['linkedin', 'LinkedIn'], ['youtube', 'YouTube'], ['twitter', 'X'],
] as const;

/** Social icons; each link is filled from Instellingen → Social media and hidden when empty. */
function socials(color: string) {
  return `<div class="socials">${SOCIAL_KEYS.map(([k, l]) => `<a href="#" data-social="${k}" aria-label="${l}"><img src="${icon(k, color)}" alt="${l}"></a>`).join('')}</div>`;
}

export type StarterBlock = { id: string; name: string; category: 'formulieren' | 'footer'; html: string };

const INK = '#1f2937';
const WHITE = '#ffffff';
const ACCENT = '#2563eb';

export const STARTER_BLOCKS: StarterBlock[] = [
  {
    id: 'contact-form', name: 'Contact – gegevens + formulier', category: 'formulieren',
    html: `<section class="block-contact"><div class="container"><h2>Neem contact op</h2><div class="text-2">Heb je een vraag? Stuur ons een bericht, we reageren binnen één werkdag.</div><div class="contact-grid"><div class="contact-list"><div class="contact-item"><img src="${icon('phone', ACCENT)}" alt="Telefoon"><div class="text-3">012 - 345 67 89</div></div><div class="contact-item"><img src="${icon('mail', ACCENT)}" alt="E-mail"><div class="text-3">info@voorbeeld.nl</div></div><div class="contact-item"><img src="${icon('map-pin', ACCENT)}" alt="Adres"><div class="text-3">Voorbeeldstraat 1, 1234 AB Plaats</div></div><div class="contact-item"><img src="${icon('clock', ACCENT)}" alt="Openingstijden"><div class="text-3">Ma t/m vr 08:30 – 17:00</div></div></div><form name="Contactformulier"><input name="naam" placeholder="Naam" required><input name="email" type="email" placeholder="E-mailadres" required><input name="telefoon" placeholder="Telefoonnummer"><textarea name="bericht" rows="5" placeholder="Je bericht" required></textarea><input name="bm_website" tabindex="-1" autocomplete="off" style="display:none"><button type="submit" class="button-1">Versturen</button></form></div></div></section>`,
  },
  {
    id: 'contact-cards', name: 'Contact – drie kaarten', category: 'formulieren',
    html: `<section class="block-contact soft"><div class="container"><h2>Zo bereik je ons</h2><div class="contact-cards"><div class="contact-card"><img src="${icon('phone', ACCENT)}" alt="Telefoon"><h3>Bellen</h3><div class="text-3">012 - 345 67 89</div></div><div class="contact-card"><img src="${icon('mail', ACCENT)}" alt="E-mail"><h3>Mailen</h3><div class="text-3">info@voorbeeld.nl</div></div><div class="contact-card"><img src="${icon('map-pin', ACCENT)}" alt="Adres"><h3>Langskomen</h3><div class="text-3">Voorbeeldstraat 1, Plaats</div></div></div></div></section>`,
  },
  {
    id: 'contact-simple', name: 'Contact – alleen formulier', category: 'formulieren',
    html: `<section class="block-contact"><div class="container narrow"><h2>Stuur ons een bericht</h2><div class="text-2">Vul het formulier in en we nemen snel contact met je op.</div><form name="Contactformulier" style="margin-top:24px;text-align:left"><input name="naam" placeholder="Naam" required><input name="email" type="email" placeholder="E-mailadres" required><textarea name="bericht" rows="5" placeholder="Je bericht" required></textarea><input name="bm_website" tabindex="-1" autocomplete="off" style="display:none"><button type="submit" class="button-1">Versturen</button></form></div></section>`,
  },
  {
    id: 'footer-columns', name: 'Footer – kolommen met social media (donker)', category: 'footer',
    html: `<section class="block-footer"><div class="container"><div class="footer-grid"><div><h3>Bedrijfsnaam</h3><div class="text-4">Korte omschrijving van het bedrijf in één of twee zinnen.</div>${socials(WHITE)}</div><div><h4>Contact</h4><div class="text-4">Voorbeeldstraat 1<br>1234 AB Plaats<br>012 - 345 67 89<br>info@voorbeeld.nl</div></div><div><h4>Openingstijden</h4><div class="text-5">Ma t/m vr 08:30 – 17:00<br>Za 09:00 – 12:00<br>Zo gesloten</div></div></div><div class="footer-bottom"><div class="text-6">© Bedrijfsnaam — Alle rechten voorbehouden.</div><div class="text-6">KvK 12345678</div></div></div></section>`,
  },
  {
    id: 'footer-light', name: 'Footer – kolommen met social media (licht)', category: 'footer',
    html: `<section class="block-footer light"><div class="container"><div class="footer-grid"><div><h3>Bedrijfsnaam</h3><div class="text-4">Korte omschrijving van het bedrijf in één of twee zinnen.</div>${socials(INK)}</div><div><h4>Contact</h4><div class="text-4">Voorbeeldstraat 1<br>1234 AB Plaats<br>012 - 345 67 89</div></div><div><h4>Volg ons</h4><div class="text-5">Blijf op de hoogte van nieuws en acties via social media.</div></div></div><div class="footer-bottom"><div class="text-6">© Bedrijfsnaam — Alle rechten voorbehouden.</div></div></div></section>`,
  },
  {
    id: 'footer-center', name: 'Footer – gecentreerd met social media', category: 'footer',
    html: `<section class="block-footer center"><div class="container narrow"><h3>Bedrijfsnaam</h3><div class="text-4">Voorbeeldstraat 1, 1234 AB Plaats · 012 - 345 67 89 · info@voorbeeld.nl</div>${socials(WHITE)}<div class="footer-bottom" style="justify-content:center"><div class="text-6">© Bedrijfsnaam — Alle rechten voorbehouden.</div></div></div></section>`,
  },
].map(block => ({ ...block, category: block.category as StarterBlock['category'], html: applyBlockBackground(block.html, {
  background: block.id.startsWith('contact-') || block.id === 'footer-light' ? WHITE : INK,
  color: block.id.startsWith('contact-') || block.id === 'footer-light' ? INK : WHITE,
}) }));
