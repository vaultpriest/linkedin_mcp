// LinkedIn CSS Selectors
// IMPORTANT: LinkedIn frequently changes UI - update selectors here when needed

export const SELECTORS = {
  // ============================================
  // Search Page
  // ============================================
  search: {
    // Main search input (top bar)
    input: 'input.search-global-typeahead__input',
    inputAlternative: 'input[placeholder="Search"]',

    // Search results container
    resultsContainer: '.search-results-container',
    resultsList: '.reusable-search__entity-result-list',

    // Individual result item
    resultItem: '.entity-result',
    resultItemAlternative: 'li.reusable-search__result-container',

    // Result item details
    resultName: '.entity-result__title-text a span[aria-hidden="true"]',
    resultNameAlternative: '.entity-result__title-text a',
    resultHeadline: '.entity-result__primary-subtitle',
    resultLocation: '.entity-result__secondary-subtitle',
    resultImage: '.entity-result__image img',
    resultConnectionDegree: '.entity-result__badge-text',

    // Pagination / Load more
    loadMoreButton: 'button.scaffold-finite-scroll__load-button',
    nextPageButton: 'button[aria-label="Next"]',

    // Filters
    filterContainer: '.search-reusables__filters-bar',
    locationFilter: 'button[aria-label="Locations filter"]',
    locationFilterAlternative: 'button:has-text("Locations")',
    filterInput: 'input[placeholder="Add a location"]',
    applyFilterButton: 'button[data-test-reusables-filter-apply-button]',

    // No results
    noResults: '.search-reusable-search-no-results',
  },

  // ============================================
  // Profile Page
  // ============================================
  profile: {
    // Main info
    name: 'h1.text-heading-xlarge',
    nameAlternative: '.pv-text-details__left-panel h1',
    headline: '.text-body-medium.break-words',
    headlineAlternative: '.pv-text-details__left-panel .text-body-medium',
    location: '.text-body-small.inline.t-black--light.break-words',
    locationAlternative: '.pv-text-details__left-panel span.text-body-small',

    // About section
    aboutSection: '#about',
    aboutContent: '#about ~ .display-flex .pv-shared-text-with-see-more span[aria-hidden="true"]',
    aboutSeeMore: '#about ~ .display-flex button.inline-show-more-text__button',

    // Experience section
    experienceSection: '#experience',
    experienceList: '#experience ~ .pvs-list__outer-container ul.pvs-list',
    experienceItem: '.pvs-entity',
    experienceTitle: '.t-bold span[aria-hidden="true"]',
    experienceCompany: '.t-normal span[aria-hidden="true"]',
    experienceDuration: '.pvs-entity__caption-wrapper span[aria-hidden="true"]',

    // Contact info
    contactInfoButton: '#top-card-text-details-contact-info',
    contactInfoModal: '.pv-contact-info',
    contactEmail: '.pv-contact-info__contact-type.ci-email a',
    contactPhone: '.pv-contact-info__contact-type.ci-phone span',
    contactWebsite: '.pv-contact-info__contact-type.ci-websites a',

    // Connection degree
    connectionDegree: '.dist-value',
    connectionDegreeAlternative: '.pv-text-details__right-panel span.dist-value',

    // Profile image
    profileImage: '.pv-top-card-profile-picture__image',
  },

  // ============================================
  // Connection Actions
  // ============================================
  connection: {
    // Connect button variations
    connectButton: 'button[aria-label*="Invite"][aria-label*="to connect"]',
    connectButtonAlt1: 'button:has-text("Connect")',
    connectButtonAlt2: '.pvs-profile-actions button:has-text("Connect")',
    moreButton: 'button[aria-label="More actions"]',
    connectInDropdown: 'div[aria-label="Invite"][role="button"]',

    // Send invitation modal
    invitationModal: '.send-invite',
    addNoteButton: 'button[aria-label="Add a note"]',
    noteTextarea: 'textarea[name="message"]',
    noteTextareaAlt: '#custom-message',
    sendButton: 'button[aria-label="Send invitation"]',
    sendButtonAlt: 'button:has-text("Send")',

    // Already connected / pending
    messageButton: 'button[aria-label*="Message"]',
    pendingButton: 'button[aria-label*="Pending"]',
    followingButton: 'button[aria-label*="Following"]',
  },

  // ============================================
  // Modals & Popups
  // ============================================
  modals: {
    overlay: '.artdeco-modal-overlay',
    container: '.artdeco-modal',
    closeButton: 'button[aria-label="Dismiss"]',
    closeButtonAlt: 'button.artdeco-modal__dismiss',

    // Specific modals
    joinModal: '[data-test-modal-id="join-now-modal"]',
    signInModal: '[data-test-modal-id="sign-in-modal"]',
    premiumModal: '.premium-upsell-modal',
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
    homeLink: 'a[href*="/feed/"]',
    myNetworkLink: 'a[href*="/mynetwork/"]',
    messagingLink: 'a[href*="/messaging/"]',
    profileLink: 'a[href*="/in/"]',
    navBar: '.global-nav',
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
