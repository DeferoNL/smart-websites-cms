# SMART Websites CMS: gedeelde pakketvoorbereiding

## Status van stap 1

Het bestaande CMS blijft werken vanuit de huidige bestanden. De export maakt een
afzonderlijke broncodedistributie, zonder websitepagina's, foto's, accounts,
gegenereerde Cloud-clients, omgevingsbestanden of repositorymetadata. Er zijn geen
klantwebsites omgezet en er wordt geen databasewijziging uitgevoerd.

```sh
bun run cms:export
# Kies bij een volgende export een nieuwe map:
node scripts/export-cms-package.mjs --output /tmp/smart-websites-cms-review
```

De standaarduitvoer is `dist/cms-package/`. De export weigert een bestaande map
te overschrijven en stopt bij ontbrekende of onbekende gedeelde afhankelijkheden.
`release.json` bevat de SHA-256 van ieder geleverd bestand. De exportversie komt
uit `src/cms/version.ts`; voorbereiding alleen verhoogt de CMS-versie niet.

## Publieke pakketonderdelen

- `@defero/smart-websites-cms/editor`: `CmsEditor`
- `@defero/smart-websites-cms/slider`: `GallerySlider`
- `@defero/smart-websites-cms/theme`: `CmsThemeProvider`, `useCmsTheme`
- `@defero/smart-websites-cms/preview-access`: `PreviewAccess`
- `/version`, `/content`, `/blocks`, `/gallery`: browserveilige hulpfuncties
- `/src/*`: expliciete bronmodule, inclusief afzonderlijke serverfuncties
- `/styles/admin.css`: bestaande afgeschermde CMS-regels, zonder website-CSS

Er is bewust geen hoofdingang die alle functies samen importeert. Serverfuncties
en server-only helpers blijven afzonderlijke modules. De bestaande servergrenzen
en autorisatie blijven intact. Gedeelde interne imports worden relatief gemaakt;
alleen de expliciet toegestane website-afhankelijkheden blijven bij de klant.

## Wat bij iedere website blijft

`integration/host-contract.json` somt exact de benodigde lokale imports op:
de website-adapter, oorspronkelijke pagina's en gegenereerde Cloud-clients met
hun eigen authenticatie en databasetypen. Website-inhoud, domein, tokens, accounts,
e-mailinstellingen en start/root-configuratie worden niet overgenomen van de Master.
Ook de lokale CMS-logoverwijzing en eventuele planning-authenticatie blijven bij
het ontvangende project; de logoverwijzing moet daar al aanwezig zijn of afzonderlijk
via de normale media-import worden toegevoegd.

Vanaf 3.0.2 blijft `@/lib/email-templates/send-email` een expliciete host-import.
Het pakket levert dus geen Master-verzenddomein of transport mee. Iedere website
behoudt haar eigen door Lovable geverifieerde e-mailconfiguratie. Controleer bij
installatie dat deze lokale helper altijd **SMART Websites** als afzendernaam
gebruikt en de eigen projectnaam server-side toevoegt; nooit een willekeurig,
ongeverifieerd domein uit een formulier gebruiken. Auth-webhooks en bijbehorende
mailtemplates blijven lokaal en moeten dezelfde identiteit behouden.

De installatie blijft gereserveerd voor het vaste beheerdersadres, inclusief
tien minuten wachttijd en bestaande permanente voltooiings-/uitnodigingscontrole.
Het vaste account mag niet worden verwijderd of van rol veranderd. Behoud ook
lokale databaseguards: de gedeelde serverchecks vervangen die niet.

Openbare gegevens ondersteunen zowel `public_cms_page_data` als de bestaande
`public_website_configuration`-projectie. Alleen een ontbrekende functie activeert
de terugval; toegangsfouten niet. De bestaande uitsluitingsvelden blijven intact.
Er wordt geen functie aangemaakt: als beide ontbreken, eerst goedkeuring vragen.
Gewoon wachtwoordherstel voor andere uitgenodigde gebruikers blijft beschikbaar.

### Update 3.0.3: uitnodigingen en wachtwoordherstel

Integreer bij iedere klant óók `templates/src/routes/reset-password.tsx`; alleen
het pakketversienummer wijzigen vernieuwt een eerder gekopieerd routesjabloon niet.
De pagina gebruikt de gedeelde `password-session`-helper, wacht op geverifieerde
authenticatie en ondersteunt PKCE, token-hash en uitnodigings-/herstelhashes.
Behoud de lokale mail-webhook, geverifieerde afzender en rechten/databaseguards.
Voor deze uitgave zijn geen nieuwe migraties nodig.

Mastercontrole: 133 tests, ingelogde CMS-rooktest, ongeldige links op drie
schermformaten en een echte herstellink voor een tijdelijk account: Opslaan,
doorsturen naar beheer en opnieuw inloggen met het nieuwe wachtwoord geslaagd.
Uitnodigingsroltoekenning en auth-mailhandoff zijn afzonderlijk met vervangen
externe diensten getest; dit bewijst geen bezorging bij Oldskool Outdoor.
Test daar na installatie een verse uitnodiging én herstellink, de gekozen rol,
SMART Websites als afzender, projectreferentie en het eigen terugkeeradres.

De dashboard- en HTTP-pagina's staan als **installatiesjablonen** in `templates/`.
TanStack Router moet deze in de routes van de klant genereren; een route is niet
zomaar een gewone bibliotheekcomponent. De sjablonen verwijzen al naar de gedeelde
pakketmodules. Kopieer geen volledige root-route of stylesheet over een klant heen.
Behoud in root/start de bestaande providers, publieke gegevens en auth-middleware.
De publieke website-renderer blijft lokaal en gebruikt waar nodig CMS-modules.

`integration/styles.reference.css` is uitsluitend een referentie voor de bestaande
tokens en volgorde: nooit als volledige vervanging van een klantstylesheet.
Integreer de CMS-regels expliciet, behoud lokale website-tokens en laat Tailwind
ook de pakketbron scannen. Slider- en blokachtergrond-CSS blijven meegeleverd.

## Databasewijzigingen per uitgave

`migrations/catalog.json` koppelt de exportversie aan de geordende SQL-bestanden
en hun hashes. Het is een cumulatieve geschiedenis, geen automatisch uitvoerplan.
Vergelijk bij een klant eerst de toegepaste migraties; voer alleen ontbrekende,
beoordeelde wijzigingen uit. Sommige historische bestanden bevatten demo-data
of Master-specifieke opruimacties: voer die nooit blind op een klant uit.
Er is geen installatiescript dat SQL uitvoert. Uitbreidingen van rechten,
mediabeveiliging en statistieken vereisen aparte controle in de pilot.

## Automatische pakketuitgave via GitHub (stap 2A)

De Master blijft gekoppeld aan `DeferoNL/pagecraft-foundry`. Alleen de schone
export gaat naar de **openbare** repository `DeferoNL/smart-websites-cms`.
Openbaar betekent dat iedereen de code kan lezen en kopiëren, niet wijzigen;
deel dus uitsluitend code die openbaar mag zijn. De export sluit website-inhoud,
omgevingsbestanden en gegenereerde Cloud-clients uit en controleert bestandshashes
en herkenbare sleutelformaten; dit is geen volledige beveiligingsaudit.

`.github/workflows/release-cms.yml` reageert op relevante wijzigingen die via
Git-sync op `main` komen, of op **Actions → Release SMART Websites CMS → Run workflow**.
De Lovable-knop **Publish** is geen GitHub-trigger. De workflow installeert de
vastgelegde afhankelijkheden, draait CMS-tests, exporteert en controleert het pakket.
Daarna schrijft hij bestanden plus `v<CMS_VERSION>` atomair naar de doelrepository.
Een identieke bestaande uitgave wordt overgeslagen; afwijkende inhoud onder dezelfde
versie wordt geweigerd. Verhoog de versie pas na de bestaande tests én ingelogde
rooktest in Lovable. De GitHub-workflow heeft geen Cloud-login en voert die ingelogde
rooktest niet uit: deze blijft een afzonderlijke voorwaarde voor uitgave.

### Eénmalig: geef de workflow schrijfrecht

De gewone `GITHUB_TOKEN` van de Master mag niet in een tweede repository schrijven.
De Lovable Git-koppeling regelt dit ook niet. Stel daarom op **GitHub zelf** in:

1. Je profiel → **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
2. Resource owner **DeferoNL**; repository access **Only select repositories** →
   uitsluitend **smart-websites-cms**; repository permission **Contents: Read and write**
   (Metadata wordt automatisch toegevoegd). Kies een vervaldatum en plan vernieuwing;
   een organisatie kan eerst goedkeuring verlangen.
3. Kopieer het token rechtstreeks naar **DeferoNL/pagecraft-foundry → Settings →
   Secrets and variables → Actions → New repository secret** met de naam
   **CMS_RELEASE_TOKEN**. Niet in de chat, broncode, doelrepository of Lovable-secrets plakken.
4. Ga naar **Actions → Release SMART Websites CMS → Run workflow** op `main`.
   Controleer het groene resultaat en de versietag in `smart-websites-cms`.
   Is Actions uitgeschakeld, schakel GitHub Actions eerst in voor de Master-repository.

De workflow kan ook een geheel lege doelrepository initialiseren. Geef alleen
vertrouwde beheerders schrijfrechten op de Master: zij kunnen workflows wijzigen.
Bescherm beide `main`-branches en gebruik geen force-push. Branchbescherming die
rechtstreekse pushes blokkeert vereist een afzonderlijke goedgekeurde uitgaveprocedure.
Een vervallen token blokkeert nieuwe uitgaven, maar bestaande klantwebsites blijven werken.

## Nog nodig vóór een eerste klantinstallatie (stap 2B/3)

1. Controleer eerst een geslaagde uitgave in `DeferoNL/smart-websites-cms`.
   Gebruik daar de exacte versietag; de Master-repository is geen installeerbaar pakket.
   Bijvoorbeeld `github:DeferoNL/smart-websites-cms#v3.0.1` werkt pas wanneer die tag bestaat.
   De openbare repository vraagt geen toegangssleutel bij klantinstallatie.
2. Maak een onveranderlijke release en leg het exacte pakket plus lockfile vast.
3. Test op één klantproject dat TanStack Start de serverfuncties uit het pakket
   in zowel preview als publicatie correct verwerkt. Niet externaliseren voor SSR.
4. Controleer routes, website-adapter, lokale Cloud-verbinding, Tailwind-scanning,
   e-mailverzending en uitsluitend de ontbrekende migraties.
5. Draai de bestaande CMS-tests en ingelogde rooktest; test daarna bewerken,
   concept teruglezen, publiceren, sliders, media en rechten op die klantwebsite.
   De meegeleverde tests staan in `checks/`; pas hun test-alias bij de pilot aan
   zodat ze het geïnstalleerde pakket testen, niet een oude lokale CMS-kopie.
   De exportcontrole zelf blijft alleen in de Master; bestaande broncontroles
   voor knoppen moeten bij de pilot op de geleverde pakketbestanden worden gericht.
6. Pas na een geslaagde pilot kan een gecontroleerde uitrol worden ingericht.

## Automatische updates zijn nog niet ingericht

GitHub-sync bewaart de Mastercode; het installeert niets in andere projecten.
Een gedeeld pakket voorkomt onvolledig kopiëren, maar een nieuwe pakketversie
verandert bestaande lockfiles of gepubliceerde websites niet vanzelf.
Een latere uitrolstraat moet per klant een versie-update, tests, gecontroleerde
migraties en een publicatie regelen, met een pilot en terugvalmogelijkheid.
Lovable Git-sync past migraties niet toe en publiceert websites niet automatisch.
De websites blijven ook met zo'n uitrol gescheiden, met eigen inhoud en accounts.
## 3.1.0 – Centrale Defero-inlog
- Klantwebsites hebben de Lovable-inlogmodule nodig (`@/integrations/lovable/index`, eenmalig Google-inlog inschakelen) en `src/lib/sso.functions.ts`.
- De Master bewaart de privésleutel als geheim `CMS_SSO_SIGNING_KEY`; klantwebsites vertrouwen alleen de publieke sleutel in `CMS_CONFIG.ssoPublicKey`.
- Een inlogbewijs is 60 seconden geldig en alleen voor het adres waarvoor het is uitgegeven.
