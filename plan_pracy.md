# LinkedIn MCP Server - Plan Pracy

## Status: W TRAKCIE IMPLEMENTACJI
**Ostatnia aktualizacja:** 2025-12-11
**Aktualny etap:** 1 - Struktura projektu

---

## 1. CEL PROJEKTU

Serwer MCP (Model Context Protocol) do automatyzacji researchu na LinkedIn, który:
- Drastycznie redukuje zużycie tokenów (z ~30k do ~800 na operację)
- Zachowuje human-like zachowania (anti-detection)
- Pozwala agentowi interweniować w niestandardowych sytuacjach (CAPTCHA, zmieniony UI)
- Jest niezależnym produktem (możliwość komercjalizacji)

### Problem który rozwiązujemy

| Obecne podejście (Playwright MCP) | Nowe podejście (LinkedIn MCP) |
|-----------------------------------|-------------------------------|
| Agent robi screenshot (~15k tokenów) | Agent wywołuje `linkedin_search` |
| Agent interpretuje UI | Serwer zwraca JSON (~500 tokenów) |
| Agent decyduje co kliknąć | Serwer wykonuje akcję automatycznie |
| Agent robi kolejny screenshot | Agent dostaje strukturyzowane dane |
| **~100 screenshotów na sesję** | **~5 screenshotów tylko przy problemach** |

---

## 2. ARCHITEKTURA

```
┌─────────────────────┐
│   Claude Agent      │
│   (Sonnet/Haiku)    │
└──────────┬──────────┘
           │ MCP Protocol (stdio)
           │ JSON requests/responses
           ▼
┌─────────────────────┐
│  LinkedIn MCP       │
│  Server (Node.js)   │
│  ┌───────────────┐  │
│  │ Tools:        │  │
│  │ - search      │  │
│  │ - get_profile │  │
│  │ - scroll      │  │
│  │ - connect     │  │
│  │ - screenshot  │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ Browser:      │  │
│  │ - Playwright  │  │
│  │ - Anti-detect │  │
│  │ - Session     │  │
│  └───────────────┘  │
│  ┌───────────────┐  │
│  │ Detector:     │  │
│  │ - CAPTCHA     │  │
│  │ - Rate limit  │  │
│  │ - Login wall  │  │
│  └───────────────┘  │
└──────────┬──────────┘
           │ Playwright
           ▼
┌─────────────────────┐
│   LinkedIn.com      │
│   (Browser session) │
└─────────────────────┘
```

---

## 3. WYMAGANIA TECHNICZNE

### 3.1 Zależności (package.json)

```json
{
  "name": "linkedin-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for LinkedIn automation with human-like behavior",
  "main": "dist/index.js",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "playwright": "^1.40.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.3.0"
  }
}
```

### 3.2 TypeScript Config (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.3 Struktura plików

```
linkedin-mcp-server/
├── package.json
├── tsconfig.json
├── plan_pracy.md          # Ten plik - aktualizowany po każdym etapie
├── README.md              # Dokumentacja dla użytkowników/klientów
├── .env.example           # Przykładowa konfiguracja
├── .gitignore
├── src/
│   ├── index.ts           # Entry point - inicjalizacja MCP server
│   ├── config.ts          # Konfiguracja (env variables)
│   ├── types.ts           # TypeScript interfaces
│   ├── tools/
│   │   ├── index.ts       # Eksport wszystkich narzędzi
│   │   ├── search.ts      # linkedin_search
│   │   ├── profile.ts     # linkedin_get_profile
│   │   ├── scroll.ts      # linkedin_scroll_results
│   │   ├── connect.ts     # linkedin_send_connection
│   │   └── screenshot.ts  # linkedin_screenshot (fallback)
│   ├── browser/
│   │   ├── index.ts       # Browser manager
│   │   ├── session.ts     # Session persistence
│   │   ├── humanize.ts    # Human-like behaviors (delays, mouse, scroll)
│   │   └── selectors.ts   # LinkedIn CSS selectors (łatwe do aktualizacji)
│   └── detector/
│       ├── index.ts       # Problem detector
│       ├── captcha.ts     # CAPTCHA detection
│       ├── ratelimit.ts   # Rate limiting detection
│       └── loginwall.ts   # Session expired detection
└── dist/                  # Skompilowany kod (git ignore)
```

---

## 4. SPECYFIKACJA NARZĘDZI MCP

### 4.1 linkedin_search

**Cel:** Wyszukiwanie osób na LinkedIn

**Input:**
```typescript
{
  query: string;           // np. "Marketing Director 4F Poland"
  location?: string;       // np. "Poland" (opcjonalny filtr)
  limit?: number;          // max wyników (default: 10)
}
```

**Output (success):**
```typescript
{
  status: "success";
  data: {
    results: Array<{
      name: string;
      headline: string;      // "CMO at 4F"
      location: string;      // "Warsaw, Poland"
      profile_url: string;   // "https://linkedin.com/in/..."
      connection_degree: string; // "2nd", "3rd"
    }>;
    total_results: number;
    has_more: boolean;
  }
}
```

**Output (problem):**
```typescript
{
  status: "needs_human";
  reason: "captcha_detected" | "rate_limited" | "login_required" | "unexpected_ui";
  screenshot?: string;     // base64 encoded PNG
  hint: string;            // "CAPTCHA detected - please solve manually"
}
```

**Logika wewnętrzna:**
1. Nawiguj do linkedin.com/search/results/people/
2. Wpisz query w search box
3. Zastosuj filtry (location)
4. Poczekaj na wyniki (z human-like delay)
5. Sparsuj wyniki do JSON
6. Wykryj problemy (CAPTCHA, rate limit)

---

### 4.2 linkedin_get_profile

**Cel:** Pobranie szczegółów profilu

**Input:**
```typescript
{
  profile_url: string;     // "https://linkedin.com/in/jankowalski"
}
```

**Output (success):**
```typescript
{
  status: "success";
  data: {
    first_name: string;
    last_name: string;
    headline: string;
    location: string;
    current_company: string;
    current_position: string;
    email?: string;          // jeśli widoczny
    phone?: string;          // jeśli widoczny
    about?: string;          // bio (skrócone)
    experience: Array<{
      title: string;
      company: string;
      duration: string;
      is_current: boolean;
    }>;
    connection_degree: string;
    profile_url: string;
  }
}
```

**Logika wewnętrzna:**
1. Nawiguj do profile_url
2. Human-like delay (symulacja czytania)
3. Sparsuj dane z DOM
4. Opcjonalnie: kliknij "Contact info" jeśli dostępne
5. Zwróć strukturyzowane dane

---

### 4.3 linkedin_scroll_results

**Cel:** Przewinięcie i załadowanie więcej wyników

**Input:**
```typescript
{
  direction: "down" | "up";
  amount?: number;         // ile scrollować (default: 1 page)
}
```

**Output:**
```typescript
{
  status: "success";
  data: {
    new_results: Array<{...}>;  // nowo załadowane wyniki
    total_loaded: number;
  }
}
```

---

### 4.4 linkedin_send_connection

**Cel:** Wysłanie zaproszenia do połączenia

**Input:**
```typescript
{
  profile_url: string;
  message?: string;        // opcjonalna wiadomość (max 300 znaków)
}
```

**Output:**
```typescript
{
  status: "success" | "needs_human" | "already_connected" | "pending";
  message?: string;
}
```

**UWAGA:** To narzędzie wymaga szczególnej ostrożności:
- Max 100 zaproszeń tygodniowo (LinkedIn limit)
- Human-like delays między zaproszeniami
- Tracking w Supabase (nie wysyłaj duplikatów)

---

### 4.5 linkedin_screenshot

**Cel:** Zrobienie screenshota aktualnego widoku (fallback dla agenta)

**Input:**
```typescript
{
  full_page?: boolean;     // default: false (tylko viewport)
  element?: string;        // opcjonalny CSS selector
}
```

**Output:**
```typescript
{
  status: "success";
  screenshot: string;      // base64 PNG
  current_url: string;
}
```

---

### 4.6 linkedin_navigate

**Cel:** Nawigacja do konkretnego URL (dla agenta gdy interweniuje)

**Input:**
```typescript
{
  url: string;
}
```

**Output:**
```typescript
{
  status: "success" | "needs_human";
  current_url: string;
}
```

---

### 4.7 linkedin_click

**Cel:** Kliknięcie elementu (dla agenta gdy interweniuje)

**Input:**
```typescript
{
  selector?: string;       // CSS selector
  text?: string;           // lub tekst elementu do kliknięcia
}
```

---

### 4.8 linkedin_type

**Cel:** Wpisanie tekstu (dla agenta gdy interweniuje)

**Input:**
```typescript
{
  selector: string;
  text: string;
  clear_first?: boolean;   // wyczyść pole przed wpisaniem
}
```

---

## 5. HUMAN-LIKE BEHAVIORS

### 5.1 Delays

```typescript
// src/browser/humanize.ts

const DELAYS = {
  between_actions: { min: 1000, max: 3000 },      // 1-3s między akcjami
  before_click: { min: 200, max: 800 },           // przed kliknięciem
  typing_speed: { min: 50, max: 150 },            // ms między znakami
  reading_profile: { min: 5000, max: 15000 },     // "czytanie" profilu
  after_search: { min: 2000, max: 5000 },         // po wyszukaniu
  between_scrolls: { min: 500, max: 2000 },       // między scrollami
  session_pause: { min: 30*60*1000, max: 60*60*1000 }, // przerwa co 30-60 min
};

function randomDelay(type: keyof typeof DELAYS): number {
  const { min, max } = DELAYS[type];
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

### 5.2 Mouse movements

```typescript
// Przed kliknięciem - ruch myszą do elementu (nie teleportacja)
async function humanMouseMove(page: Page, selector: string) {
  const element = await page.$(selector);
  const box = await element.boundingBox();

  // Losowy punkt w obrębie elementu (nie zawsze środek)
  const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
  const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

  // Ruch z aktualnej pozycji do celu (z krzywą Beziera)
  await page.mouse.move(targetX, targetY, { steps: 10 + Math.random() * 20 });
}
```

### 5.3 Scrolling

```typescript
// Human-like scrolling (nie instant jump)
async function humanScroll(page: Page, direction: 'down' | 'up') {
  const scrollAmount = 300 + Math.random() * 400; // 300-700px
  const steps = 5 + Math.floor(Math.random() * 5); // 5-10 kroków

  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel({
      deltaY: direction === 'down' ? scrollAmount/steps : -scrollAmount/steps
    });
    await sleep(50 + Math.random() * 100);
  }
}
```

### 5.4 Typing

```typescript
// Human-like typing (różne prędkości, okazjonalne błędy)
async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);

  for (const char of text) {
    await page.keyboard.type(char);
    await sleep(50 + Math.random() * 100); // 50-150ms między znakami

    // Okazjonalna dłuższa pauza (jak przy myśleniu)
    if (Math.random() < 0.05) {
      await sleep(300 + Math.random() * 500);
    }
  }
}
```

---

## 6. WYKRYWANIE PROBLEMÓW (Detector)

### 6.1 CAPTCHA Detection

```typescript
// src/detector/captcha.ts

const CAPTCHA_INDICATORS = [
  'iframe[src*="recaptcha"]',
  'iframe[src*="captcha"]',
  '[class*="captcha"]',
  '[id*="captcha"]',
  'img[src*="captcha"]',
  '[aria-label*="security verification"]',
];

async function detectCaptcha(page: Page): Promise<boolean> {
  for (const selector of CAPTCHA_INDICATORS) {
    if (await page.$(selector)) {
      return true;
    }
  }

  // Sprawdź też tekst na stronie
  const text = await page.textContent('body');
  return text?.toLowerCase().includes('security verification') ||
         text?.toLowerCase().includes('unusual activity');
}
```

### 6.2 Rate Limit Detection

```typescript
// src/detector/ratelimit.ts

const RATE_LIMIT_TEXTS = [
  "you've reached the weekly invitation limit",
  "you've reached the commercial use limit",
  "too many requests",
  "slow down",
  "temporarily restricted",
];

async function detectRateLimit(page: Page): Promise<boolean> {
  const text = (await page.textContent('body'))?.toLowerCase() || '';
  return RATE_LIMIT_TEXTS.some(phrase => text.includes(phrase));
}
```

### 6.3 Login Wall Detection

```typescript
// src/detector/loginwall.ts

async function detectLoginRequired(page: Page): Promise<boolean> {
  const url = page.url();

  // Przekierowanie na login
  if (url.includes('/login') || url.includes('/checkpoint')) {
    return true;
  }

  // Modal "Join LinkedIn"
  const joinModal = await page.$('[data-test-modal-id="join-now-modal"]');
  if (joinModal) return true;

  // Tekst "Sign in to view"
  const text = await page.textContent('body');
  return text?.includes('Sign in to view') || text?.includes('Join to view');
}
```

### 6.4 Unexpected UI Detection

```typescript
// src/detector/index.ts

async function detectUnexpectedUI(page: Page, expectedSelector: string): Promise<boolean> {
  try {
    await page.waitForSelector(expectedSelector, { timeout: 10000 });
    return false; // Element znaleziony - OK
  } catch {
    return true; // Element nie znaleziony - problem
  }
}
```

---

## 7. KONFIGURACJA

### 7.1 Environment Variables (.env)

```bash
# Browser
LINKEDIN_USER_DATA_DIR=/Users/pawelrutkowski/.playwright-profiles/linkedin
HEADLESS=false

# Delays (opcjonalne - override defaults)
MIN_ACTION_DELAY=1000
MAX_ACTION_DELAY=3000

# Session
SESSION_PAUSE_INTERVAL=2700000    # 45 min (w ms)
SESSION_PAUSE_DURATION=300000     # 5 min przerwy

# Logging
LOG_LEVEL=info
```

### 7.2 Integracja z Claude Code (.mcp.json w zryw_mailer)

```json
{
  "mcpServers": {
    "linkedin": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/pawelrutkowski/Python/Serwery_MCP/linkedin-mcp-server/dist/index.js"],
      "env": {
        "LINKEDIN_USER_DATA_DIR": "/Users/pawelrutkowski/.playwright-profiles/linkedin",
        "HEADLESS": "false"
      }
    }
  }
}
```

---

## 8. SELEKTORY LINKEDIN (łatwe do aktualizacji)

```typescript
// src/browser/selectors.ts

export const SELECTORS = {
  // Search
  search_input: 'input[placeholder="Search"]',
  search_results_container: '.search-results-container',
  search_result_item: '.entity-result__item',
  search_result_name: '.entity-result__title-text a',
  search_result_headline: '.entity-result__primary-subtitle',
  search_result_location: '.entity-result__secondary-subtitle',

  // Profile
  profile_name: 'h1.text-heading-xlarge',
  profile_headline: '.text-body-medium',
  profile_location: '.text-body-small:has(.t-normal)',
  profile_about: '#about ~ .display-flex .full-width',
  profile_experience: '#experience ~ .pvs-list__outer-container',
  contact_info_button: '#top-card-text-details-contact-info',

  // Connection
  connect_button: 'button:has-text("Connect")',
  send_invitation_button: 'button:has-text("Send")',
  add_note_button: 'button:has-text("Add a note")',
  message_input: 'textarea[name="message"]',

  // Modals & Popups
  modal_overlay: '.artdeco-modal-overlay',
  close_modal_button: 'button[aria-label="Dismiss"]',

  // Filters
  location_filter: 'button:has-text("Locations")',
  filter_input: 'input[placeholder="Add a location"]',
};
```

**WAŻNE:** LinkedIn często zmienia UI. Te selektory mogą wymagać aktualizacji. Trzymamy je w jednym pliku dla łatwej modyfikacji.

---

## 9. ETAPY IMPLEMENTACJI

### Etap 1: Struktura projektu [W TRAKCIE]
- [x] Utworzenie folderu i struktury katalogów
- [ ] package.json z zależnościami
- [ ] tsconfig.json
- [ ] .gitignore
- [ ] Inicjalizacja git

### Etap 2: Podstawowy serwer MCP
- [ ] src/index.ts - entry point
- [ ] src/config.ts - konfiguracja
- [ ] src/types.ts - interfejsy TypeScript
- [ ] Rejestracja pustych narzędzi w MCP

### Etap 3: Browser Manager
- [ ] src/browser/index.ts - zarządzanie przeglądarką
- [ ] src/browser/session.ts - persystencja sesji
- [ ] src/browser/humanize.ts - human-like behaviors
- [ ] src/browser/selectors.ts - selektory LinkedIn

### Etap 4: Detector
- [ ] src/detector/captcha.ts
- [ ] src/detector/ratelimit.ts
- [ ] src/detector/loginwall.ts
- [ ] src/detector/index.ts - główny detector

### Etap 5: Narzędzia (Tools)
- [ ] src/tools/search.ts - linkedin_search
- [ ] src/tools/profile.ts - linkedin_get_profile
- [ ] src/tools/scroll.ts - linkedin_scroll_results
- [ ] src/tools/screenshot.ts - linkedin_screenshot (fallback)

### Etap 6: Narzędzia zaawansowane
- [ ] src/tools/connect.ts - linkedin_send_connection
- [ ] src/tools/navigate.ts - linkedin_navigate
- [ ] src/tools/click.ts - linkedin_click
- [ ] src/tools/type.ts - linkedin_type

### Etap 7: Integracja i testy
- [ ] Konfiguracja w zryw_mailer/.mcp.json
- [ ] Test linkedin_search
- [ ] Test linkedin_get_profile
- [ ] Test obsługi CAPTCHA (fallback do agenta)
- [ ] README.md dla użytkowników

### Etap 8: Optymalizacje
- [ ] Session pause (przerwy co 45 min)
- [ ] Logging i monitoring
- [ ] Error recovery
- [ ] Rate limiting wbudowany

---

## 10. INSTRUKCJA DLA AGENTA KONTYNUUJĄCEGO PRACĘ

Jeśli kontekst się skończył lub wystąpił błąd:

1. **Przeczytaj ten plik** (`plan_pracy.md`) - zawiera pełną specyfikację
2. **Sprawdź checklistę w sekcji 9** - zobacz co zostało zrobione
3. **Kontynuuj od pierwszego niezaznaczonego punktu**
4. **Po każdym ukończonym etapie** - zaktualizuj checklistę w tym pliku

### Komendy do uruchomienia projektu:

```bash
cd /Users/pawelrutkowski/Python/Serwery_MCP/linkedin-mcp-server

# Instalacja zależności
npm install

# Kompilacja TypeScript
npm run build

# Uruchomienie (do testów)
npm start
```

### Testowanie z Claude Code:

Po dodaniu do `.mcp.json` w zryw_mailer, agent powinien mieć dostęp do narzędzi:
- `linkedin_search`
- `linkedin_get_profile`
- `linkedin_scroll_results`
- etc.

---

## 11. UWAGI BEZPIECZEŃSTWA

1. **NIE commituj** pliku z sesją przeglądarki
2. **NIE przekraczaj limitów LinkedIn:**
   - ~100 zaproszeń/tydzień
   - ~30 wiadomości/dzień do osób spoza sieci
   - ~100 profili/godzinę (przy agresywnym scrapingu)
3. **ZAWSZE używaj przerw** między sesjami
4. **Session persistence** - używaj istniejącej zalogowanej sesji, nie loguj się automatycznie

---

## 12. PRZYSZŁE ROZSZERZENIA (v2.0)

- [ ] linkedin_get_company - dane o firmie
- [ ] linkedin_search_jobs - wyszukiwanie ofert pracy
- [ ] linkedin_get_posts - posty osoby/firmy
- [ ] Rate limiting dashboard
- [ ] Integracja z Supabase (tracking wysłanych zaproszeń)
- [ ] Proxy rotation (dla większej skali)
