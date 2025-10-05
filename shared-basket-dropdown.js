// shared-basket-dropdown.js
// Unified basket dropdown rendering for all product pages

(function () {
  // Global fallback remover to guarantee minus works even if listeners fail
  if (!window.__removeBasketItem) {
    window.__removeBasketItem = async function(buttonEl) {
      // Prevent accidental double handling
      if (buttonEl && buttonEl.__removing) return;
      if (buttonEl) buttonEl.__removing = true;
      try {
        const btn = buttonEl && buttonEl.closest ? buttonEl.closest('.basket-minus-btn') : null;
        if (!btn) return;
        const row = btn.closest('.basket-row');
        const rawId = btn.getAttribute('data-id');
        const id = rawId || (row ? (row.getAttribute('data-id') || (row.querySelector('div[style*="font-family"]')?.textContent || '').trim()) : null);
        const idxAttr = btn.getAttribute('data-index');

        // Prefer Firebase cart when authenticated
        if (window.FitRightFirebase && typeof window.FitRightFirebase.isLoggedIn === 'function' && window.FitRightFirebase.isLoggedIn()) {
          const items = (window.FitRightFirebase.getCartItems && window.FitRightFirebase.getCartItems()) || [];
          const found = items.find((it) => (it.id || it.productId || it.name) == id);
          const currentQty = found ? (found.quantity || 1) : 1;
          if (currentQty > 1 && window.FitRightFirebase.updateQuantity) {
            await window.FitRightFirebase.updateQuantity(found?.id || found?.productId || id, currentQty - 1);
          } else if (window.FitRightFirebase.removeFromCart) {
            await window.FitRightFirebase.removeFromCart(found?.id || found?.productId || id);
          }
        } else if (window.BasketAuthManager && typeof window.BasketAuthManager.isLoggedIn === 'function' && window.BasketAuthManager.isLoggedIn()) {
          const user = window.BasketAuthManager.getCurrentUser();
          const key = `basket_${user?.uid}`;
          const raw = localStorage.getItem(key) || '[]';
          const basket = JSON.parse(raw);
          let idx = -1;
          if (idxAttr) idx = parseInt(idxAttr, 10);
          if (Number.isNaN(idx) || idx < 0) idx = basket.findIndex((it) => (it.id || it.productId || it.name) == id);
          if (idx >= 0 && basket[idx]) {
            const qty = basket[idx].quantity || 1;
            if (qty > 1) basket[idx].quantity = qty - 1;
            else basket.splice(idx, 1);
            localStorage.setItem(key, JSON.stringify(basket));
          }
        } else {
          const raw = localStorage.getItem('basket');
          const basket = raw ? JSON.parse(raw) : [];
          let idx = -1;
          if (idxAttr) idx = parseInt(idxAttr, 10);
          if (Number.isNaN(idx) || idx < 0) idx = basket.findIndex((it) => (it.id || it.productId || it.name) == id);
          if (idx >= 0 && basket[idx]) {
            const qty = basket[idx].quantity || 1;
            if (qty > 1) basket[idx].quantity = qty - 1;
            else basket.splice(idx, 1);
            localStorage.setItem('basket', JSON.stringify(basket));
          }
        }
      } catch (_) {}

      try { window.dispatchEvent(new CustomEvent('cartUpdated')); } catch (_) {}
      if (window.SharedBasketDropdown && typeof window.SharedBasketDropdown.refresh === 'function') {
        try { window.SharedBasketDropdown.refresh(); } catch (_) {}
      }
      if (buttonEl) setTimeout(() => { buttonEl.__removing = false; }, 150);
    }
  }
  const log = (...args) => console.log('[SharedBasket]', ...args);

  function isLoggedIn() {
    try {
      return !!(window.FitRightFirebase && typeof window.FitRightFirebase.isLoggedIn === 'function' && window.FitRightFirebase.isLoggedIn());
    } catch (_) {
      return false;
    }
  }

  function formatPrice(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `£${(value / 100).toFixed(2)}`;
    }
    if (typeof value === 'string') {
      if (value.includes('£')) return value;
      const n = parseFloat(value);
      if (!Number.isNaN(n)) return `£${n.toFixed(2)}`;
    }
    return '£0.00';
  }

  function getField(obj, path, fallback) {
    try {
      const value = path.split('.').reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
      return value !== undefined && value !== null ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  async function getItems() {
    if (isLoggedIn() && window.FitRightFirebase) {
      try {
        if (typeof window.FitRightFirebase.loadCart === 'function') {
          await window.FitRightFirebase.loadCart();
        }
      } catch (_) {}
      try {
        const items = window.FitRightFirebase.getCartItems() || [];
        log('Using Firebase items:', items.length);
        return items;
      } catch (e) {
        log('Firebase getCartItems failed, falling back to localStorage', e);
      }
    }
    try {
      const ls = localStorage.getItem('basket');
      const parsed = ls ? JSON.parse(ls) : [];
      const items = Array.isArray(parsed) ? parsed : [];
      log('Using localStorage items:', items.length);
      return items;
    } catch (e) {
      console.warn('[SharedBasket] Corrupted localStorage basket, resetting to empty.');
      localStorage.removeItem('basket');
      return [];
    }
  }

  function updateCounters(count) {
    const els = [
      document.getElementById('basketCount'),
      document.getElementById('basketCountMobile')
    ];
    els.forEach((el) => {
      if (!el) return;
      el.textContent = String(count);
      el.style.display = count > 0 ? 'inline-block' : 'none';
    });
  }

  function buildHTML(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return '<div style="text-align:center;color:#888;">Your basket is empty.</div>';
    }

    return items
      .map((item, idx) => {
        const docData = typeof item.data === 'function' ? item.data() : null;
        const name = docData?.productName || item.productName || item.name || item.title || 'Product';
        const priceRaw =
          docData?.productPrice ??
          item.productPrice ??
          (typeof item.price === 'number' ? item.price : undefined) ??
          item.price ??
          item.newPrice ??
          '£0.00';
        const img = docData?.productImage || item.productImage || item.image || item.imgUrl || '';
        const qty = docData?.quantity ?? item.quantity ?? 1;
        const id = (docData ? item.id : item.id) || item.productId || name || idx;
        const formatted = formatPrice(priceRaw);

        return `
          <div class="basket-row" data-index="${idx}" data-id="${id}" style="display:flex;align-items:center;margin-bottom:12px;padding-bottom:8px;position:relative;">
            <div style="width:48px;height:48px;background:#fafafa;border-radius:10px;margin-right:12px;display:flex;align-items:center;justify-content:center;">
              <img src="${img}" alt="${name}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;color:#999;font-size:12px;text-align:center;line-height:1.2;">📦</div>
            </div>
            <div style="flex:1;">
              <div style="font-family:'Special Elite',monospace;font-size:1em;">${name}</div>
              <div style="font-size:1em;font-weight:bold;">${formatted}</div>
              <div style="font-size:0.95em;color:#555;">Qty: <span class="basket-qty" data-id="${id}">${qty}</span></div>
            </div>
            <button class="basket-minus-btn" data-index="${idx}" data-id="${id}" onclick="__removeBasketItem(this)">&minus;</button>
          </div>
        `;
      })
      .join('');
  }

  function bindMinusHandlers(container, items) {
    if (!container) return;
    container.querySelectorAll('.basket-minus-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const itemId = btn.getAttribute('data-id');
        const idx = parseInt(btn.getAttribute('data-index'), 10) || 0;
        const row = btn.closest('.basket-row');
        const qtyEl = row ? row.querySelector('.basket-qty') : null;
        const currentQty = parseInt(qtyEl?.textContent || '1', 10) || 1;

        try {
          if (window.FitRightFirebase && typeof window.FitRightFirebase.isLoggedIn === 'function' && window.FitRightFirebase.isLoggedIn()) {
            // Firebase mode: decrement or remove using resolved id
            let items = (typeof window.FitRightFirebase.getCartItems === 'function') ? window.FitRightFirebase.getCartItems() : [];
            if (!items || items.length === 0) {
              if (typeof window.FitRightFirebase.loadCart === 'function') await window.FitRightFirebase.loadCart();
              items = (typeof window.FitRightFirebase.getCartItems === 'function') ? window.FitRightFirebase.getCartItems() : [];
            }
            const item = items.find((it) => (it.id || it.productId || it.name) == itemId) || items[idx];
            if (item) {
              const docId = item.id || item.productId || itemId;
              if ((item.quantity || currentQty) > 1 && typeof window.FitRightFirebase.updateQuantity === 'function') {
                await window.FitRightFirebase.updateQuantity(docId, (item.quantity || currentQty) - 1);
              } else if (typeof window.FitRightFirebase.removeFromCart === 'function') {
                if (row) row.classList.add('basket-fade-out');
                setTimeout(async () => { await window.FitRightFirebase.removeFromCart(docId); }, 250);
              }
            }
          } else {
            // Guest/local mode
            const basket = JSON.parse(localStorage.getItem('basket') || '[]');
            if (basket[idx] && (basket[idx].quantity || 1) > 1) {
              basket[idx].quantity = (basket[idx].quantity || 1) - 1;
            } else if (basket[idx]) {
              if (row) row.classList.add('basket-fade-out');
              setTimeout(() => { basket.splice(idx, 1); }, 250);
            }
            localStorage.setItem('basket', JSON.stringify(basket));
          }
        } finally {
          try { window.dispatchEvent(new CustomEvent('cartUpdated')); } catch (_) {}
          if (window.SharedBasketDropdown && typeof window.SharedBasketDropdown.refresh === 'function') {
            try { window.SharedBasketDropdown.refresh(); } catch (_) {}
          }
        }
      });
    });
  }

  async function render() {
    const items = await getItems();
    const count = items.reduce((sum, it) => sum + (typeof it.data === 'function' ? (it.data().quantity || 0) : (it.quantity || 1)), 0);
    updateCounters(count);

    const html = buildHTML(items);
    const desktop = document.getElementById('basketDropdownContent');
    const mobile = document.getElementById('basketDropdownContentMobile');
    if (desktop) desktop.innerHTML = html;
    if (mobile) mobile.innerHTML = html;
    bindMinusHandlers(desktop, items);
    bindMinusHandlers(mobile, items);
  }

  function bindToggles() {
    const toggle = (btnId, ddId) => {
      const btn = document.getElementById(btnId);
      const dd = document.getElementById(ddId);
      if (!btn || !dd) return;
      const handler = async (e) => {
        e.stopPropagation();
        try {
          await render();
        } catch (err) {
          console.warn('[SharedBasket] Render failed, opening dropdown anyway', err);
        }
        dd.classList.toggle('show');
      };
      btn.addEventListener('click', handler);
      btn.addEventListener('touchend', handler);
    };
    toggle('basketDropdownBtn', 'basketDropdown');
    toggle('basketDropdownBtnMobile', 'basketDropdownMobile');

    document.addEventListener('click', (e) => {
      if (
        !e.target.closest('#basketDropdownBtn') &&
        !e.target.closest('#basketDropdownBtnMobile') &&
        !e.target.closest('#basketDropdown') &&
        !e.target.closest('#basketDropdownMobile')
      ) {
        document.getElementById('basketDropdown')?.classList.remove('show');
        document.getElementById('basketDropdownMobile')?.classList.remove('show');
      }
    });
  }

  function bindEvents() {
    window.addEventListener('cartUpdated', render);
    window.addEventListener('authStateChanged', render);
  }

  function init() {
    // Ensure we always wire up toggles for both desktop and mobile buttons
    try { bindToggles(); } catch (_) {}
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

// shared-basket-dropdown.js
// Shared basket dropdown functionality that works across all pages
// Properly handles authentication state changes

console.log('Shared Basket Dropdown: Initializing...');

class SharedBasketDropdown {
  constructor() {
    this.elements = {};
    this.isInitialized = false;
    
    // Always wait for DOM to be fully loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        // Add a small delay to ensure all elements are rendered
        setTimeout(() => this.init(), 100);
      });
    } else {
      // DOM is already loaded, but add a small delay to ensure all elements are rendered
      setTimeout(() => this.init(), 100);
    }
  }

  init() {
    console.log('Shared Basket Dropdown: Initializing...');
    
    // Find basket elements
    this.elements = {
      basketDropdownBtn: document.getElementById('basketDropdownBtn'),
      basketDropdownBtnMobile: document.getElementById('basketDropdownBtnMobile'),
      basketDropdown: document.getElementById('basketDropdown'),
      basketDropdownMobile: document.getElementById('basketDropdownMobile'),
      basketDropdownContent: document.getElementById('basketDropdownContent'),
      basketDropdownContentMobile: document.getElementById('basketDropdownContentMobile'),
      basketCount: document.getElementById('basketCount'),
      basketCountMobile: document.getElementById('basketCountMobile'),
      basketDropdownFooter: document.getElementById('basketDropdownFooter'),
      basketDropdownFooterMobile: document.getElementById('basketDropdownFooterMobile')
    };

    // Fallback: if there is no dedicated mobile dropdown, reuse the desktop dropdown
    if (!this.elements.basketDropdownMobile) {
      this.elements.basketDropdownMobile = this.elements.basketDropdown;
    }

    console.log('DEBUG: All basket elements found:', {
      basketDropdownBtn: !!this.elements.basketDropdownBtn,
      basketDropdownBtnMobile: !!this.elements.basketDropdownBtnMobile,
      basketDropdown: !!this.elements.basketDropdown,
      basketDropdownMobile: !!this.elements.basketDropdownMobile,
      basketDropdownContent: !!this.elements.basketDropdownContent,
      basketDropdownContentMobile: !!this.elements.basketDropdownContentMobile,
      basketCount: !!this.elements.basketCount,
      basketCountMobile: !!this.elements.basketCountMobile,
      basketDropdownFooter: !!this.elements.basketDropdownFooter,
      basketDropdownFooterMobile: !!this.elements.basketDropdownFooterMobile
    });

    // Check if basket elements exist
    const hasBasketElements = this.elements.basketDropdownBtn || this.elements.basketDropdownBtnMobile;
    if (!hasBasketElements) {
      console.log('Shared Basket Dropdown: No basket elements found on this page, will retry in 500ms');
      // Retry after a delay in case elements are not yet rendered
      setTimeout(() => this.init(), 500);
      return;
    }

    console.log('Shared Basket Dropdown: Found basket elements', {
      desktop: !!this.elements.basketDropdownBtn,
      mobile: !!this.elements.basketDropdownBtnMobile,
      content: !!this.elements.basketDropdownContent
    });

    // Debug: Check all localStorage basket keys
    console.log('DEBUG: All localStorage basket keys:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key === 'basket' || key.startsWith('basket_'))) {
        console.log('  ', key, ':', localStorage.getItem(key));
      }
    }



    // Inject minus visibility styles (desktop hover, mobile always visible)
    this.injectMinusVisibilityStyles();

    // Set up event listeners
    this.setupEventListeners();
    
    // Initial update
    this.updateBasketDropdown();
    
    this.isInitialized = true;
    console.log('Shared Basket Dropdown: Initialized successfully');
  }

  injectMinusVisibilityStyles() {
    try {
      const STYLE_ID = 'shared-basket-minus-visibility-style';
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = `
        /* Desktop: minus hidden by default, shown on row hover. Pre-allocate layout to prevent flicker */
        #basketDropdown .basket-row { position: relative; }
        #basketDropdown .basket-minus-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          font-size: 1em;
          cursor: pointer;
          /* Keep in the layout but visually transparent to avoid pointer leave flicker */
          opacity: 0;
          pointer-events: none;
          transition: opacity 140ms ease-in-out;
        }
        #basketDropdown .basket-row:hover .basket-minus-btn,
        #basketDropdown .basket-minus-btn:hover,
        #basketDropdown .basket-minus-btn:focus,
        #basketDropdown .basket-minus-btn:active {
          opacity: 1;
          pointer-events: auto;
        }

        /* Mobile: minus always visible */
        #basketDropdownMobile .basket-minus-btn {
          position: absolute;
          top: 50%;
          right: 8px;
          transform: translateY(-50%);
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          font-size: 1.2em;
          cursor: pointer;
          opacity: 1 !important;
          pointer-events: auto !important;
        }
      `;
      document.head.appendChild(style);
    } catch (_) {}
  }

  setupEventListeners() {
    // Desktop basket button
    if (this.elements.basketDropdownBtn) {
      this.elements.basketDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleBasketDropdown('desktop');
      });
    }

    // Mobile basket button
    if (this.elements.basketDropdownBtnMobile) {
      this.elements.basketDropdownBtnMobile.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleBasketDropdown('mobile');
      });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.isClickInsideBasket(e)) {
        this.closeBasketDropdown();
      }
    });

    // Listen for basket auth state changes
    window.addEventListener('basketAuthStateChanged', (e) => {
      console.log('Shared Basket Dropdown: Auth state changed', e.detail);
      this.updateBasketDropdown();
    });

    // Listen for cart updates
    window.addEventListener('cartUpdated', (e) => {
      console.log('Shared Basket Dropdown: Cart updated', e.detail);
      this.updateBasketDropdown();
    });

    // Listen for storage changes (multi-tab support)
    window.addEventListener('storage', (e) => {
      if (e.key === 'basket' || e.key?.startsWith('basket_')) {
        console.log('Shared Basket Dropdown: localStorage basket changed', e.key);
        this.updateBasketDropdown();
      }
    });
  }

  toggleBasketDropdown(type) {
    const dropdown = type === 'mobile' ? this.elements.basketDropdownMobile : this.elements.basketDropdown;
    const isOpen = dropdown && dropdown.classList.contains('show');

    if (isOpen) {
      this.closeBasketDropdown();
    } else {
      this.openBasketDropdown(type);
    }
  }

  openBasketDropdown(type) {
    const dropdown = type === 'mobile' ? this.elements.basketDropdownMobile : this.elements.basketDropdown;
    
    if (dropdown) {
      dropdown.style.display = 'block';
      setTimeout(() => {
        dropdown.classList.add('show');
      }, 10);
    }
  }

  closeBasketDropdown() {
    const dropdowns = [this.elements.basketDropdown, this.elements.basketDropdownMobile];
    
    dropdowns.forEach(dropdown => {
      if (dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        setTimeout(() => {
          dropdown.style.display = 'none';
        }, 300);
      }
    });
  }

  isClickInsideBasket(event) {
    const basketElements = [
      this.elements.basketDropdownBtn,
      this.elements.basketDropdownBtnMobile,
      this.elements.basketDropdown,
      this.elements.basketDropdownMobile
    ];

    return basketElements.some(element => 
      element && (element === event.target || element.contains(event.target))
    );
  }

  updateBasketDropdown() {
    if (!this.isInitialized) return;

    console.log('DEBUG: updateBasketDropdown called');

    // Get current basket data
    const basket = this.getCurrentBasket();
    const basketCount = basket.reduce((sum, item) => sum + (item.quantity || 1), 0);

    console.log('DEBUG: Basket data in updateBasketDropdown:', {
      basket: basket,
      basketLength: basket.length,
      basketCount: basketCount,
      isLoggedIn: window.BasketAuthManager?.isLoggedIn() || false
    });

    // Update basket counters
    this.updateBasketCounters(basketCount);

    // Update basket content
    this.updateBasketContent(basket);

    // Update clear basket buttons
    this.updateClearBasketButtons(basketCount > 0);
  }

  getCurrentBasket() {
    // Prefer Firebase integration when logged in
    try {
      if (window.FitRightFirebase && typeof window.FitRightFirebase.isLoggedIn === 'function' && window.FitRightFirebase.isLoggedIn()) {
        return (window.FitRightFirebase.getCartItems && window.FitRightFirebase.getCartItems()) || [];
      }
    } catch (_) {}
    // Fallback to BasketAuthManager-managed localStorage per-user basket
    if (window.BasketAuthManager) {
      return window.BasketAuthManager.getCurrentBasket();
    }
    // Guest basket
    return JSON.parse(localStorage.getItem('basket') || '[]');
  }

  updateBasketCounters(count) {
    // Update desktop counter
    if (this.elements.basketCount) {
      this.elements.basketCount.textContent = count;
      this.elements.basketCount.style.display = count > 0 ? 'inline-block' : 'none';
    }

    // Update mobile counter
    if (this.elements.basketCountMobile) {
      this.elements.basketCountMobile.textContent = count;
      this.elements.basketCountMobile.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  updateBasketContent(basket) {
    console.log('DEBUG: updateBasketContent called with basket:', basket);
    
    const emptyMessage = '<div style="text-align:center;color:#888;">Your basket is empty.</div>';

    if (basket.length === 0) {
      console.log('DEBUG: Basket is empty, showing empty message');
      // Show empty message
      if (this.elements.basketDropdownContent) {
        this.elements.basketDropdownContent.innerHTML = emptyMessage;
      }
      if (this.elements.basketDropdownContentMobile) {
        this.elements.basketDropdownContentMobile.innerHTML = emptyMessage;
      }
      return;
    }

    console.log('DEBUG: Basket has items, generating HTML');
    // Generate basket HTML
    const basketHTML = this.generateBasketHTML(basket);
    console.log('DEBUG: Generated basket HTML:', basketHTML);

    // Update desktop content
    if (this.elements.basketDropdownContent) {
      console.log('DEBUG: Updating desktop basket content');
      this.elements.basketDropdownContent.innerHTML = basketHTML;
      this.addBasketEventListeners(this.elements.basketDropdownContent);
    }

    // Update mobile content
    if (this.elements.basketDropdownContentMobile) {
      console.log('DEBUG: Updating mobile basket content');
      this.elements.basketDropdownContentMobile.innerHTML = basketHTML;
      this.addBasketEventListeners(this.elements.basketDropdownContentMobile);
    }
  }

  generateBasketHTML(basket) {
    return basket.map((item, idx) => {
      // Handle different field name variations
      const itemName = item.name || item.productName || 'Product';
      const itemPrice = item.newPrice || item.price || item.cost || '£0.00';
      const itemImage = item.imgUrl || item.image || item.productImage || '';
      const itemSize = item.size || item.selectedSize || '';
      const itemQuantity = item.quantity || 1;
      const itemId = item.id || item.productId || itemName;
      
      return `
        <div class="basket-row" data-index="${idx}" data-id="${itemId}" style="display:flex;align-items:center;margin-bottom:12px;padding-bottom:8px;position:relative;">
          <div style="width:48px;height:48px;background:#fafafa;border-radius:10px;margin-right:12px;display:flex;align-items:center;justify-content:center;">
            <img src="${itemImage}" alt="${itemName}" style="width:100%;height:100%;object-fit:contain;border-radius:10px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
            <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;color:#999;font-size:12px;text-align:center;line-height:1.2;">📦</div>
          </div>
          <div style="flex:1;text-align:left;">
            <div style="font-family:'Special Elite',monospace;font-size:1em;text-transform:uppercase;">${itemName}</div>
            <div style="font-size:1em;font-weight:bold;font-family:'Special Elite',monospace;">${itemPrice}</div>
            <div style="font-size:0.95em;color:#555;font-family:'Special Elite',monospace;text-transform:uppercase;">QTY: <span class="basket-qty" data-id="${itemId}">${itemQuantity}</span></div>
            ${itemSize ? `<div style="font-size:0.95em;color:#555;font-family:'Special Elite',monospace;text-transform:uppercase;">SIZE: ${itemSize}</div>` : ''}
          </div>
          <button class="basket-minus-btn" data-index="${idx}" data-id="${itemId}">&minus;</button>
        </div>
      `;
    }).join('');
  }

  addBasketEventListeners(container) {
    if (!container || container.__minusBound) return;
    container.__minusBound = true;

    // Prevent outside-click closer from stealing the event
    container.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    // Unified handler for mouse + touch + pen
    container.addEventListener('pointerup', async (e) => {
      const btn = e.target.closest('.basket-minus-btn');
      if (!btn || !container.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();
      await this.handleRemoveItem(btn);
    }, { passive: false });
  }

  async handleRemoveItem(button) {
    const idx = parseInt(button.getAttribute('data-index'));
    const row = button.closest('.basket-row');
    
    try {
      // Prefer Firebase when authenticated
      if (window.FitRightFirebase && typeof window.FitRightFirebase.isLoggedIn === 'function' && window.FitRightFirebase.isLoggedIn()) {
        const items = (window.FitRightFirebase.getCartItems && window.FitRightFirebase.getCartItems()) || [];
        const item = items[idx];
        if (!item) { this.updateBasketDropdown(); return; }
        const currentQty = item.quantity || 1;
        if (currentQty > 1 && window.FitRightFirebase.updateQuantity) {
          await window.FitRightFirebase.updateQuantity(item.id || item.productId, currentQty - 1);
        } else if (window.FitRightFirebase.removeFromCart) {
          if (row) row.classList.add('basket-fade-out');
          setTimeout(async () => {
            await window.FitRightFirebase.removeFromCart(item.id || item.productId);
            this.updateBasketDropdown();
          }, 300);
          return;
        }
        this.updateBasketDropdown();
        return;
      }

      if (window.BasketAuthManager && window.BasketAuthManager.isLoggedIn()) {
        // Logged-in fallback to per-user localStorage basket
        const basket = this.getCurrentBasket();
        const item = basket[idx];
        if (item && item.quantity > 1) {
          item.quantity -= 1;
          const user = window.BasketAuthManager.getCurrentUser();
          localStorage.setItem(`basket_${user.uid}`, JSON.stringify(basket));
          const qtySpan = row.querySelector('.basket-qty');
          if (qtySpan) qtySpan.textContent = item.quantity;
          this.updateBasketCounters(basket.reduce((sum, item) => sum + (item.quantity || 1), 0));
        } else {
          if (row) row.classList.add('basket-fade-out');
          setTimeout(() => {
            basket.splice(idx, 1);
            const user = window.BasketAuthManager.getCurrentUser();
            localStorage.setItem(`basket_${user.uid}`, JSON.stringify(basket));
            this.updateBasketDropdown();
          }, 300);
        }
        return;
      }

      // Guest user - localStorage
      const basket = this.getCurrentBasket();
      if (basket[idx] && basket[idx].quantity > 1) {
        basket[idx].quantity -= 1;
        localStorage.setItem('basket', JSON.stringify(basket));
        const qtySpan = row.querySelector('.basket-qty');
        if (qtySpan) qtySpan.textContent = basket[idx].quantity;
        this.updateBasketCounters(basket.reduce((sum, item) => sum + (item.quantity || 1), 0));
      } else if (basket[idx]) {
        if (row) row.classList.add('basket-fade-out');
        setTimeout(() => {
          basket.splice(idx, 1);
          localStorage.setItem('basket', JSON.stringify(basket));
          this.updateBasketDropdown();
        }, 300);
      }
    } catch (error) {
      console.error('Shared Basket Dropdown: Error removing item', error);
    }
  }

  updateClearBasketButtons(show) {
    // Update desktop clear button
    if (this.elements.basketDropdownFooter) {
      this.elements.basketDropdownFooter.style.display = show ? 'block' : 'none';
    }

    // Update mobile clear button
    if (this.elements.basketDropdownFooterMobile) {
      this.elements.basketDropdownFooterMobile.style.display = show ? 'block' : 'none';
    }
  }

  // Public API methods
  refresh() {
    this.updateBasketDropdown();
  }

  getBasketCount() {
    return this.getCurrentBasket().reduce((sum, item) => sum + (item.quantity || 1), 0);
  }
}

// Create global instance
window.SharedBasketDropdown = new SharedBasketDropdown();

// Export for module usage
export default window.SharedBasketDropdown; 