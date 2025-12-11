# LinkedIn MCP Server

MCP (Model Context Protocol) server dla automatyzacji LinkedIn. Pozwala na wyszukiwanie kontaktów, pobieranie profili i wysyłanie zaproszeń przez Claude Code lub inne narzędzia wspierające MCP.

## Funkcje

- **linkedin_search** - Wyszukiwanie osób na LinkedIn
- **linkedin_get_profile** - Pobieranie szczegółów profilu
- **linkedin_send_connection** - Wysyłanie zaproszeń do kontaktu
- **linkedin_screenshot** - Robienie screenshotów
- **linkedin_navigate** - Nawigacja do URL
- **linkedin_click** - Klikanie elementów
- **linkedin_type** - Wpisywanie tekstu
- **linkedin_scroll_results** - Przewijanie wyników
- **linkedin_debug_dom** - Debugowanie struktury DOM (patrz sekcja Troubleshooting)

## Instalacja

```bash
cd linkedin-mcp-server
npm install
npm run build
```

## Konfiguracja Claude Code

Dodaj do `~/.claude.json` lub `.claude/settings.json`:

```json
{
  "mcpServers": {
    "linkedin": {
      "command": "node",
      "args": ["/ścieżka/do/linkedin-mcp-server/dist/index.js"]
    }
  }
}
```

## Zmienne środowiskowe

| Zmienna | Domyślna | Opis |
|---------|----------|------|
| `LINKEDIN_USER_DATA_DIR` | `~/.playwright-profiles/linkedin` | Katalog z profilem przeglądarki |
| `HEADLESS` | `false` | Tryb headless (bez okna) |
| `LOG_LEVEL` | `info` | Poziom logowania: debug, info, warn, error |

## Pierwsze użycie

1. Uruchom serwer (przez Claude Code)
2. Otworzy się przeglądarka Chrome
3. **Zaloguj się ręcznie do LinkedIn** - sesja zostanie zapisana
4. Od teraz możesz używać narzędzi

## Przykłady użycia

### Wyszukiwanie kontaktów
```
linkedin_search: "Marketing Director Poland"
```

### Pobieranie profilu
```
linkedin_get_profile: "https://linkedin.com/in/jankowalski"
```

### Wysyłanie zaproszenia
```
linkedin_send_connection:
  profile_url: "https://linkedin.com/in/jankowalski"
  message: "Cześć! Chętnie nawiążę kontakt..."
```

## Troubleshooting

### Parser nie działa / 0 wyników

LinkedIn często zmienia strukturę DOM. Użyj narzędzia debug:

```
linkedin_debug_dom
```

To narzędzie:
1. Analizuje aktualną strukturę DOM strony
2. Pokazuje ścieżki do elementów (profile links, listitems)
3. Generuje rekomendacje jakich selektorów użyć
4. Robi screenshot dla wizualnej weryfikacji

**Przykładowy output:**
```json
{
  "debug_info": {
    "mainExists": true,
    "profileLinksCount": 20,
    "roleListitemCount": 10,
    "liCount": 0,
    "profileLinks": [
      {
        "href": "https://linkedin.com/in/example/",
        "text": "Jan Kowalski",
        "pathUp": "p > div > div > a..."
      }
    ]
  },
  "recommendations": [
    "LinkedIn uses div[role=\"listitem\"] instead of <li>. Use selector: [role=\"listitem\"]"
  ]
}
```

### Jak naprawić selektory

1. Uruchom `linkedin_debug_dom` na stronie z wynikami
2. Sprawdź `recommendations` - zawierają sugestie selektorów
3. Sprawdź `profileLinks[].pathUp` - pokazuje ścieżkę DOM do linków
4. Zaktualizuj selektory w `src/tools/search.ts` i `src/browser/selectors.ts`
5. Przebuduj: `npm run build`

### Typowe zmiany LinkedIn (grudzień 2024)

| Stara struktura | Nowa struktura |
|-----------------|----------------|
| `<li>` | `<div role="listitem">` |
| `<ul>` | `<div role="list">` |
| `.entity-result` | Losowe klasy CSS |

### Błędy przeglądarki

**"Browser already in use"**
- Zamknij inne instancje Playwright/Chrome korzystające z tego samego profilu
- `pkill -f "Chrome for Testing"`

**"Target page closed" / SIGTRAP**
- Usuń pliki blokady: `rm ~/.playwright-profiles/linkedin/Singleton*`
- Restart CLI

## Architektura

```
src/
├── index.ts          # Entry point, MCP server setup
├── config.ts         # Konfiguracja, zmienne środowiskowe
├── types.ts          # TypeScript types
├── browser/
│   ├── index.ts      # BrowserManager - główna klasa przeglądarki
│   ├── humanize.ts   # Symulacja ludzkiego zachowania
│   └── selectors.ts  # Selektory CSS dla LinkedIn
├── detector/
│   └── index.ts      # Detekcja problemów (CAPTCHA, limity)
└── tools/
    ├── search.ts     # linkedin_search
    ├── profile.ts    # linkedin_get_profile
    ├── connect.ts    # linkedin_send_connection
    ├── screenshot.ts # linkedin_screenshot
    ├── navigate.ts   # linkedin_navigate
    ├── click.ts      # linkedin_click
    ├── type.ts       # linkedin_type
    ├── scroll.ts     # linkedin_scroll_results
    └── debug.ts      # linkedin_debug_dom
```

## Humanizacja

Serwer symuluje ludzkie zachowanie:
- Losowe opóźnienia między akcjami (1.5-4s)
- Bezier curves dla ruchów myszy
- Przerwy na "czytanie" (6-18s na profil)
- Sesyjny współczynnik prędkości (każda sesja ma trochę inny timing)
- Micro-pauzy podczas przeglądania

## Limity LinkedIn

- ~100 zaproszeń/tydzień
- ~80 profili/dzień (Sales Navigator więcej)
- Zbyt szybkie akcje = ryzyko blokady

## Licencja

MIT
