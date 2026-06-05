# Sunday Suite — UX-prinsipper

Felles rettesnor for UX/UI på tvers av suiten (gjelder alle apper unntatt SundayRec,
som er låst nær release). Målet: **mer ikoner, logisk struktur, mindre tekst og rot.**

Kilden til sannhet for farger/spacing/type er `@sunday/design`
(`packages/design`). Hver app beholder sin signaturpalett (aksent + nøytraler),
men deler det semantiske laget: spacing-rytme, radius, type-skala, statusfarger
(`success`/`warning`/`danger`/`info`) og gull-tråd-merkevaren.

## 1. Ikon-først
- Bruk **lucide-react** i alle React-apper. Ingen emoji/unicode som funksjonelle ikoner.
- Ikon + kort etikett er standard for navigasjon. Ikon-kun er greit **kun** med tooltip.
- Velg semantisk presise ikoner; gjenbruk samme ikon for samme konsept på tvers av apper.
- Standardstørrelser: 16–18px i UI-chrome, 14–15px i tette lister/verktøylinjer.

## 2. Logisk struktur, maks ~7 per gruppe
- Ikke mer enn ~7 valg i én navigasjonsgruppe. Flere → grupper med seksjonsikon/overskrift.
- Beslektede handlinger samles; ulike skilles med skillelinje eller egen klynge.
- Vis hvor man er: brødsmuler eller aktiv-markering i nav. Unngå "skjult modal-stabel".

## 3. Mindre tekst
- Foretrekk ikon + verdi fremfor "Etikett: verdi"-setninger der ikonet er tydelig.
- Progressiv avsløring: vis det vanlige først, skjul avanserte valg bak "Flere valg".
- Slå sammen nær-identiske flater i stedet for å duplisere skjemaer/sider.

## 4. ⌘K kommandopalett i hver app
- Hver app skal ha en ⌘K-palett som dekker navigasjon + hovedhandlinger.
- Paletten er den primære "finn alt"-veien; nav-chrome kan da holdes slank.

## 5. Status og tilbakemelding fra tokens
- Bruk `--color-success/-warning/-danger/-info` (aldri ad-hoc hex) for tilstand.
- Ikke kommuniser status med farge alene — par med ikon/tekst (tilgjengelighet).
- On-air/live og andre kritiske tilstander: ikon + ring/markering, tydelig synlig.

## 6. Tilgjengelighet (minstekrav)
- Ikon-kun-knapper har `aria-label` + tooltip.
- Fokus synlig; tastaturnavigasjon i menyer, paletter og dialoger.
- Kontrast på tekst/ikon mot bakgrunn følger tokens (lys- og mørk-modus).

## Token-wiring per app-type
- **Tailwind v4-apper** (Studio, Paper, Verbatim, Stage, Plan): `@import "@sunday/design/theme.css"`
  øverst i rot-stilen, *før* appens egen `tokens.css` — appens nøytraler/aksent overstyrer
  der de overlapper, så app-en arver delt spacing/radius/status/type additivt.
- **Pure-CSS-app** (SundaySong): speil de delte verdiene inn i `globals.css` med en
  kommentar som peker til `@sunday/design` som kilde (kan ikke konsumere Tailwind-@theme).
