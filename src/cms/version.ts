// CMS version + changelog. Bump CMS_VERSION and prepend a CHANGELOG entry with every master update.
// security: true marks a release that every client site must install promptly (daily alert from the master).
export type ChangelogEntry = { version: string; date: string; changes: string[]; security?: boolean };

export const CMS_VERSION = '3.1.0';

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '3.1.0', date: '2026-11-24', security: true,
    changes: ['Centrale Defero-inlog: in de Master inloggen met Google en via Beheer direct als Administrator op iedere klantwebsite, zonder Google-configuratie per website.', 'Kortlevende (60 seconden), ondertekende en per website gerichte inlogbewijzen; alleen office@defero.nl en kars@defero.nl, na recente Google- of 2FA-inlog.', 'kars@defero.nl beschermd tegen verwijderen en rolwijziging; bestaande klantaccounts en wachtwoordinlog blijven ongewijzigd.'],
  },
  {
    version: '3.0.3', date: '2026-11-24',
    changes: ['Uitnodigings- en herstellinks wachten op geverifieerde authenticatie; ondersteuning voor code, token-hash en bestaande uitnodigingssessies.', 'Verlopen of gebruikte links tonen een duidelijke melding zonder wachtwoordformulier; na opslaan direct naar het beheer.', 'Gekozen uitnodigingsrechten, eigen mailidentiteit, vaste beheerder en 2FA-beveiliging behouden en automatisch gecontroleerd.'],
  },
  {
    version: '3.0.2', date: '2026-11-17', security: true,
    changes: ['CMS-pakket gebruikt de eigen geverifieerde e-mailafzender van iedere website; afzendernaam blijft SMART Websites.', 'Vaste beheerder beschermd tegen verwijderen en rolwijzigingen; gereserveerde installatie, tien minuten wachttijd en bestaande installatielatch behouden.', 'Ondersteuning voor bestaande openbare websitefunctie zonder databasewijziging; uitsluitingen en toegangsbeveiliging behouden.'],
  },
  {
    version: '3.0.1', date: '2026-11-11',
    changes: ['Blauwe CMS-actieknoppen beschermd tegen bestaande website-stijlen, zonder overige vormgeving te wijzigen.', 'Directe CMS-link per klantwebsite in het centrale overzicht; update-opdracht controleert ook dashboard, Helpdesk en gedeelde knopstijlen.'],
  },
  {
    version: '3.0.0', date: '2026-11-11',
    changes: ['Centraal overzicht van alle klantwebsites in de Master: versie, updatestatus, gebruikers, 2FA, concepten en ongelezen formulieren.', 'Klantwebsites geven bij de versiecheck alleen tellingen door, beveiligd met een eigen sleutel per website.'],
  },
  {
    version: '2.9.4', date: '2026-11-11',
    changes: ['Foto’s verwijderen uit sliders, ook bij een gekoppelde fotomap; bestanden blijven in Bestandsbeheer behouden.'],
  },
  {
    version: '2.9.3', date: '2026-11-11',
    changes: ['Binnenruimte van Publiceren en Nieuwe pagina hersteld zonder andere knopvormgeving te wijzigen; automatische controle van tekstknoppen en icoontjes in paginaoverzicht en editor.'],
  },
  {
    version: '2.9.2', date: '2026-11-11',
    changes: ['Nieuw ingevoegde blokken blijven altijd binnen de breedte van de website; de achtergrond loopt wel over de volle breedte.', 'De blokkenbibliotheek toont eerst de eigen blokken van de website; standaardblokken alleen als er geen eigen blok van die soort is.'],
  },
  {
    version: '2.9.1', date: '2026-11-11',
    changes: ['Icoontjes voor pagina-instellingen en meer opties zijn weer zichtbaar; automatische controle op zichtbare knoppen na elke update.'],
  },
  {
    version: '2.9.0', date: '2026-11-11',
    changes: ['Achtergrondkleur en dekking per blok instellen, met direct voorbeeld en optioneel tekstcontrast.', 'Achtergrond behouden bij dupliceren en bewaren in de bibliotheek; standaard contactblokken hebben een leesbare achtergrond.'],
  },
  {
    version: '2.8.1',
    date: '2026-11-11',
    changes: ['Vernieuwde, eigen layout voor het uploadvenster in Bestandsbeheer; alle functies blijven gelijk.'],
  },
  {
    version: '2.8.0',
    date: '2026-11-11',
    security: true,
    changes: [
      'Beveiliging: CMS-gegevens en mediabestanden alleen nog leesbaar voor beheerders; de website toont uitsluitend gepubliceerde inhoud.',
      'Ongebruikte en concept-uploads blijven privé; gepubliceerde foto’s en sliders blijven zichtbaar.',
      'Websites melden bij het controleren op updates hun adres en versie aan het centrale Smart Websites-dashboard.',
    ],
  },
  {
    version: '2.7.0',
    date: '2026-11-11',
    changes: [
      'Klassieke foto-carrousels in headers herkenbaar en bewerkbaar als slider, met behoud van slide-inhoud.',
      "Losse sliderfoto's vervangen, toevoegen, verwijderen en verplaatsen vanuit Bestandsbeheer.",
      'Een fotomap koppelen; snelheid (2–15 seconden) en overgang (schuiven, vervagen, inzoomen) instellen.',
      'Sliders pauzeren tijdens bewerken; concept en publicatie blijven gescheiden.',
    ],
  },
  {
    version: '2.6.1',
    date: '2026-11-07',
    changes: [
      'Administrator en Webbouwer kunnen de achtergrond- en tekstkleur van websiteknoppen aanpassen.',
      'Webbouwer kan ook back-ups terugzetten; klanten krijgen deze bevoegdheid niet.',
    ],
  },
  {
    version: '2.6.0',
    date: '2026-11-07',
    changes: [
      'Eén rolkeuze: Administrator, Webbouwer, Klant Basis en Klant Advanced, plus eigen rollen.',
      'Klant Basis krijgt ook statistieken; standaardrollen hebben een vaste rechtenverdeling.',
      'Alleen Administrator kan uitnodigen, gebruikers en rollen beheren en back-ups terugzetten.',
      'Webbouwer mag back-ups maken, maar niet terugzetten; DNS en Updates blijven Administrator-exclusief.',
    ],
  },
  {
    version: '2.5.0',
    date: '2026-11-07',
    changes: [
      '2FA-status (actief/ontbreekt) per gebruiker in Gebruikers & rollen.',
      'Herinneringsbalk in het dashboard zolang 2FA niet is ingesteld.',
      'Herinneringsmail om de 2 weken (niet vaker) zolang 2FA ontbreekt, verstuurd bij inloggen.',
    ],
  },
  {
    version: '2.4.0',
    date: '2026-11-07',
    changes: [
      'Eenmalige installatie via beveiligde uitnodiging naar de vooraf vastgelegde beheerder',
      'Klantdomeinen automatisch gebruikt zonder ongevraagd www toe te voegen',
      'Beheer, media en voorbeelden uitgesloten in robots.txt',
      'Volledige overdrachtsinstructies met behoud van bestaande klantwebsite en beveiliging',
    ],
  },
  {
    version: '2.3.0',
    date: '2026-11-06',
    changes: [
      'Standaard contactblokken en footers met social media-icoontjes in de blokkenbibliotheek',
      'Social media-icoontjes linken automatisch naar de kanalen uit Instellingen (verborgen zonder link)',
      'Hamburger-menu verschijnt automatisch zodra het menu niet meer op één regel past',
      'Kleur van het menu-icoon instelbaar onder Instellingen',
    ],
  },
  {
    version: '2.2.0',
    date: '2026-11-06',
    changes: [
      'Foto\'s: vorm (liggend, staand, vierkant, rond), afgeronde hoeken en een link bij klikken (bijv. logo naar home)',
      'Achtergrondfoto\'s van blokken wijzigen en uitlijnen',
      'Blokken tijdelijk uitschakelen: zichtbaar in de editor, niet gepubliceerd',
      'Tekst links, midden of rechts uitlijnen en AI-hulp: verbeteren, herschrijven, inkorten en spelling',
      'Social media-links onder Instellingen',
      'Automatische sitemap.xml',
      'Formulieren-inbox voor alle gebruikers met gelezen/ongelezen',
      'Voorbeeld bekijken op desktop, tablet en telefoon',
    ],
  },
  {
    version: '2.1.0',
    date: '2026-11-06',
    changes: [
      'Back-up terugplaatsen zet ook zelf aangemaakte pagina\'s terug: later toegevoegde pagina\'s verdwijnen',
      'Na terugplaatsen ververst het dashboard automatisch',
      'Activiteit, Instellingen, Gebruikers & rollen, Statistieken, Back-ups en DNS toe te kennen per rol (Updates alleen voor beheerders)',
      'Foto\'s uitlijnen: klik op een foto voor een pop-up met 3×3 uitlijning, voorbeeld en "Andere foto kiezen"',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-11-06',
    changes: [
      'Knop "Eerste blok toevoegen" op nieuwe, lege pagina\'s',
      'Blokkenbibliotheek en pop-ups staan volledig op de voorgrond',
      'Rustiger paginaoverzicht: klik op de paginanaam om te bewerken',
      'Alleen-lezen voorbeeld via het oogje naast Publiceren',
      'Keuze tussen lichte en donkere weergave onder Uitloggen',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-04',
    changes: [
      'Blokkenbibliotheek vullen met één klik vanuit Instellingen (Blokken indexeren)',
      'Blokken ingedeeld in categorieën met zoeken en tabbladen bij invoegen',
      'Blokken hernoemen, van categorie wisselen, verbergen of verwijderen',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-11-04',
    changes: [
      'Eerste master-versie van Smart Websites CMS',
      'Concept opslaan, voorbeeld bekijken en publiceren',
      'Bestandsbeheer met mappen en 200 iconen met eigen kleur',
      'Schone Nederlandse adressen en optionele Engelse taal',
      'Nederlandse e-mails, 2FA en Updates-overzicht voor beheerders',
    ],
  },
];

/** Compares dotted versions numerically: returns -1, 0 or 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0);
  const pb = b.split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

/** Newest release marked as security update, or null. */
export function latestSecurityVersion(log: ChangelogEntry[]): string | null {
  return log.filter(e => e.security).map(e => e.version).sort((a, b) => compareVersions(b, a))[0] ?? null;
}
