// LinkedIn CSS Selectors
// IMPORTANT: LinkedIn frequently changes UI - these selectors use stable DOM structure
// instead of class names which change frequently

export const SELECTORS = {
  // ============================================
  // Search Page
  // ============================================
  search: {
    // Main search input (top bar)
    input: 'input[placeholder*="Szukaj"], input[placeholder*="Search"]',
    inputAlternative: 'input.search-global-typeahead__input',

    // Search results container - use structure-based selectors
    resultsContainer: 'main',
    resultsList: 'main ul',

    // Individual result item - li containing profile link
    resultItem: 'main ul > li:has(a[href*="/in/"])',
    resultItemAlternative: 'main li:has(a[href*="/in/"])',

    // Result item details - based on structure, not classes
    // Name is in the link pointing to profile
    resultName: 'a[href*="/in/"] span[aria-hidden="true"]',
    resultNameAlternative: 'a[href*="/in/"]',
    // Headline is typically the 2nd paragraph in the item
    resultHeadline: 'li p:nth-of-type(1)',
    // Location is typically the 3rd paragraph
    resultLocation: 'li p:nth-of-type(2)',
    resultImage: 'img[alt]',
    // Connection degree is in span/text near the name
    resultConnectionDegree: 'span:has-text("1st"), span:has-text("2nd"), span:has-text("3rd"), span:has-text("3.+")',

    // Pagination / Load more
    loadMoreButton: 'button:has-text("więcej"), button:has-text("more")',
    nextPageButton: 'button[aria-label*="Dalej"], button[aria-label*="Next"]',

    // Filters
    filterContainer: 'div[role="toolbar"], [class*="filter"]',
    locationFilter: 'button[aria-label*="Lokalizacj"], button[aria-label*="Location"]',
    locationFilterAlternative: 'button:has-text("Lokalizacj"), button:has-text("Location")',
    filterInput: 'input[placeholder*="lokalizacj"], input[placeholder*="location"]',
    applyFilterButton: 'button:has-text("Zastosuj"), button:has-text("Apply")',

    // No results
    noResults: '[class*="no-result"], :has-text("Brak wyników")',
  },

  // ============================================
  // Profile Page
  // ============================================
  profile: {
    // Main info - use semantic selectors
    name: 'main h1',
    nameAlternative: 'h1[class*="text-heading"]',
    headline: 'main h1 + div, main section div[class*="text-body-medium"]',
    headlineAlternative: 'main section:first-of-type div:nth-of-type(2)',
    location: 'main span[class*="text-body-small"]',
    locationAlternative: 'main section:first-of-type span:has-text(",")',

    // About section
    aboutSection: '#about, section:has(h2:has-text("O mnie")), section:has(h2:has-text("About"))',
    aboutContent: '#about ~ div span[aria-hidden="true"], section:has(h2:has-text("O mnie")) span[aria-hidden="true"]',
    aboutSeeMore: '#about ~ div button, section:has(h2:has-text("O mnie")) button:has-text("więcej")',

    // Experience section
    experienceSection: '#experience, section:has(h2:has-text("Doświadczenie")), section:has(h2:has-text("Experience"))',
    experienceList: '#experience ~ div ul, section:has(h2:has-text("Doświadczenie")) ul',
    experienceItem: 'li:has(a[href*="/company/"])',
    experienceTitle: 'li span[aria-hidden="true"]:first-of-type',
    experienceCompany: 'li a[href*="/company/"] span[aria-hidden="true"]',
    experienceDuration: 'li span:has-text("–"), li span:has-text("-")',

    // Contact info
    contactInfoButton: 'a[href*="contact-info"], button:has-text("Informacje kontaktowe"), #top-card-text-details-contact-info',
    contactInfoModal: '[role="dialog"], .artdeco-modal',
    contactEmail: 'a[href^="mailto:"]',
    contactPhone: 'a[href^="tel:"], span:has-text("+48"), span:has-text("+1")',
    contactWebsite: 'a[href*="http"]:not([href*="linkedin"])',

    // Connection degree
    connectionDegree: 'span:has-text("1st"), span:has-text("2nd"), span:has-text("3rd")',
    connectionDegreeAlternative: 'span[class*="dist-value"]',

    // Profile image
    profileImage: 'main img[alt], img[class*="profile-picture"]',
  },

  // ============================================
  // Connection Actions
  // ============================================
  connection: {
    // Connect button variations - bilingual PL/EN
    connectButton: 'button[aria-label*="Zaproś"], button[aria-label*="Invite"], button[aria-label*="connect"]',
    connectButtonAlt1: 'button:has-text("Nawiąż kontakt"), button:has-text("Connect")',
    connectButtonAlt2: 'main button:has-text("Nawiąż"), main button:has-text("Connect")',
    moreButton: 'button[aria-label*="Więcej"], button[aria-label*="More"]',
    connectInDropdown: '[role="menuitem"]:has-text("Nawiąż"), [role="menuitem"]:has-text("Connect")',

    // Send invitation modal
    invitationModal: '[role="dialog"]:has(textarea), .artdeco-modal:has(textarea)',
    addNoteButton: 'button:has-text("Dodaj notatkę"), button:has-text("Add a note")',
    noteTextarea: 'textarea[name="message"], textarea#custom-message, [role="dialog"] textarea',
    noteTextareaAlt: 'textarea',
    sendButton: 'button[aria-label*="Wyślij zaproszenie"], button[aria-label*="Send invitation"]',
    sendButtonAlt: 'button:has-text("Wyślij"), button:has-text("Send")',

    // Already connected / pending
    messageButton: 'button[aria-label*="Wiadomość"], button[aria-label*="Message"]',
    pendingButton: 'button[aria-label*="Oczekuje"], button[aria-label*="Pending"]',
    followingButton: 'button[aria-label*="Obserwujesz"], button[aria-label*="Following"]',
  },

  // ============================================
  // Modals & Popups
  // ============================================
  modals: {
    overlay: '.artdeco-modal-overlay, [class*="modal-overlay"]',
    container: '.artdeco-modal, [role="dialog"]',
    closeButton: 'button[aria-label*="Zamknij"], button[aria-label*="Dismiss"], button[aria-label*="Close"]',
    closeButtonAlt: '[role="dialog"] button:first-of-type, .artdeco-modal__dismiss',

    // Specific modals
    joinModal: '[role="dialog"]:has-text("Dołącz"), [role="dialog"]:has-text("Join")',
    signInModal: '[role="dialog"]:has-text("Zaloguj"), [role="dialog"]:has-text("Sign in")',
    premiumModal: '[role="dialog"]:has-text("Premium"), [class*="premium"]',
  },

  // ============================================
  // CAPTCHA & Security
  // ============================================
  security: {
    captchaIframe: 'iframe[src*="captcha"]',
    recaptchaIframe: 'iframe[src*="recaptcha"]',
    securityChallenge: '[class*="challenge"]',
    verificationPage: '.checkpoint-challenge',
  },

  // ============================================
  // Rate Limiting & Restrictions
  // ============================================
  restrictions: {
    limitReachedBanner: '.ip-fuse-limit-alert',
    restrictedMessage: '[class*="restricted"]',
    commercialLimitModal: '.commercial-use-limit',
  },

  // ============================================
  // Navigation
  // ============================================
  navigation: {
    homeLink: 'a[href*="/feed/"], button:has-text("Strona główna"), button:has-text("Home")',
    myNetworkLink: 'a[href*="/mynetwork/"], button:has-text("Moja sieć"), button:has-text("My Network")',
    messagingLink: 'a[href*="/messaging/"], button:has-text("Wiadomości"), button:has-text("Messaging")',
    profileLink: 'a[href*="/in/"]',
    navBar: 'nav, header, [role="banner"]',
  },

  // ============================================
  // General
  // ============================================
  general: {
    loadingIndicator: '.artdeco-loader',
    skeleton: '.artdeco-skeleton',
    errorMessage: '.artdeco-inline-feedback--error',
  },
};

// Helper to try multiple selectors
export function trySelectors(selectors: string[]): string {
  // Returns CSS selector that matches any of the provided selectors
  return selectors.join(', ');
}
