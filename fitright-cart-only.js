// fitright-cart-only.js
// CÓDIGO SIMPLIFICADO - APENAS CARRINHO + AUTENTICAÇÃO
// SEM COLEÇÃO PRODUCTS - Pega dados do HTML
// Project ID: mark-1-3a013

console.log('fitright-cart-only.js: Starting to load...');

// ============================================================================
// 1. IMPORTAÇÕES DO FIREBASE (apenas do seu firebase.js)
// ============================================================================

console.log('fitright-cart-only.js: About to import from firebase.js...');

import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
  setPersistence,
  browserLocalPersistence
} from "./firebase.js";

console.log('fitright-cart-only.js: Successfully imported from firebase.js');
console.log('fitright-cart-only.js: deleteDoc available:', typeof deleteDoc);

// ============================================================================
// 2. GERENCIAMENTO DE USUÁRIOS (SIMPLIFICADO)
// ============================================================================

class UserManager {
  constructor() {
    this.currentUser = null;
    this.userData = null;
    
    // Monitorar mudanças de autenticação
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      if (user) {
        await this.loadUserData();
        // Do not merge guest cart into Firebase on login
        console.log('fitright-cart-only.js: Logged in - keeping guest cart separate (no merge)');
      } else {
        this.userData = null;
      }
      
      // Disparar evento para UI reagir
      window.dispatchEvent(new CustomEvent('authStateChanged', { 
        detail: { user: user, isLoggedIn: !!user } 
      }));
    });
  }

  // Registrar novo usuário
  async registerUser(email, password, displayName = '') {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (displayName) {
        await updateProfile(user, { displayName: displayName });
      }

      // Criar documento do usuário
      const userData = {
        email: user.email,
        displayName: displayName || '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };

      await setDoc(doc(db, 'users', user.uid), userData);
      console.log('Usuário registrado:', user.uid);
      return { uid: user.uid, email: user.email, displayName: displayName };
    } catch (error) {
      console.error('Erro ao registrar:', error);
      throw this.handleAuthError(error);
    }
  }

  // Fazer login
  async loginUser(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await this.updateLastLogin();
      console.log('Login realizado:', user.uid);
      return { uid: user.uid, email: user.email, displayName: user.displayName };
    } catch (error) {
      console.error('Erro no login:', error);
      throw this.handleAuthError(error);
    }
  }

  // Fazer logout
  async logoutUser() {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.userData = null;
      console.log('Logout realizado');
      return true;
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  // Carregar dados do usuário
  async loadUserData() {
    if (!this.currentUser) return null;
    try {
      const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
      if (userDoc.exists()) {
        this.userData = userDoc.data();
      } else {
        await this.createUserDocument();
      }
      return this.userData;
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      throw error;
    }
  }

  // Verificar se está autenticado
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Merge guest cart with user cart
  async mergeGuestCart() {
    if (!this.currentUser) return;
    
    try {
      const guestCart = JSON.parse(localStorage.getItem('basket')) || [];
      if (guestCart.length === 0) return;

      // Filter out problematic items before merging
      const cleanedGuestCart = guestCart.filter(item => {
        return item.name !== "PURPLE WOOL FELT TRILBY HAT" && item.name !== "OVERSIZED GRADIENT";
      });
      
      if (cleanedGuestCart.length !== guestCart.length) {
        console.log('fitright-cart-only.js: Filtered out problematic items from guest cart before merging');
        // Update the basket with cleaned data
        localStorage.setItem('basket', JSON.stringify(cleanedGuestCart));
      }

      // Load user's current cart
      await cartManager.loadCart();
      
      // Add guest items to user cart (using cleaned cart)
      for (const guestItem of cleanedGuestCart) {
        const productData = {
          id: guestItem.name, // Use name as ID for guest items
          name: guestItem.name,
          price: parseInt(guestItem.newPrice?.replace(/[^\d]/g, '') || '0'),
          image: guestItem.imgUrl || '',
          category: 'general',
          selectedSize: guestItem.selectedSize || null,
          selectedColor: guestItem.selectedColor || null
        };
        
        await cartManager.addToCart(productData, guestItem.quantity || 1);
      }
      
      // Clear guest cart
      localStorage.removeItem('basket');
      console.log('Guest cart merged with user cart (cleaned)');
      
    } catch (error) {
      console.error('Error merging guest cart:', error);
    }
  }

  // Métodos auxiliares
  async createUserDocument() {
    if (!this.currentUser) return;
    const userData = {
      email: this.currentUser.email,
      displayName: this.currentUser.displayName || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    };
    await setDoc(doc(db, 'users', this.currentUser.uid), userData);
    this.userData = userData;
  }

  async updateLastLogin() {
    if (!this.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', this.currentUser.uid), {
        lastLogin: serverTimestamp()
      });
    } catch (error) {
      console.warn('Erro ao atualizar último login:', error);
    }
  }

  handleAuthError(error) {
    const errorMessages = {
      'auth/email-already-in-use': 'Este email já está em uso',
      'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres',
      'auth/invalid-email': 'Email inválido',
      'auth/user-not-found': 'Usuário não encontrado',
      'auth/wrong-password': 'Senha incorreta',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde'
    };
    const message = errorMessages[error.code] || 'Erro desconhecido';
    return new Error(message);
  }
}

// ============================================================================
// 3. GERENCIAMENTO DO CARRINHO (HÍBRIDO - LOCALSTORAGE + FIREBASE)
// ============================================================================

class CartManager {
  constructor() {
    this.userId = null;
    this.cartItems = [];
    this.isLoading = false;
    
    // Monitorar mudanças de autenticação
    onAuthStateChanged(auth, (user) => {
      if (user) {
        this.userId = user.uid;
        this.loadCart();
      } else {
        this.userId = null;
        this.cartItems = [];
        // Switch back to localStorage for guest users
        this.dispatchCartUpdate();
      }
    });
  }

  // Adicionar item ao carrinho (HÍBRIDO)
  async addToCart(productData, quantity = 1) {
    if (!productData || quantity <= 0) throw new Error('Dados inválidos');

    // If user is logged in, use Firebase
    if (this.userId) {
      return await this.addToFirebaseCart(productData, quantity);
    } else {
      // If guest user, use localStorage
      return this.addToLocalCart(productData, quantity);
    }
  }

  // Adicionar ao Firebase (usuários logados) - ESTRUTURA CORRIGIDA
  async addToFirebaseCart(productData, quantity = 1) {
    if (!this.userId) throw new Error('Usuário não autenticado');

    this.isLoading = true;
    try {
      // Verificar se item já existe no carrinho
      const existingItem = this.cartItems.find(item => 
        item.productId === productData.id &&
        item.selectedSize === (productData.selectedSize || null) &&
        item.selectedColor === (productData.selectedColor || null)
      );
      
      if (existingItem) {
        // Atualizar quantidade
        return await this.updateCartItemQuantity(existingItem.id, existingItem.quantity + quantity);
      } else {
        // Criar container do carrinho primeiro (se não existir)
        await setDoc(
          doc(db, "users", this.userId, "cart", "current"),
          { updatedAt: serverTimestamp() },
          { merge: true }
        );

        // Adicionar novo item
        const cartItem = {
          productId: productData.id,
          productName: productData.name,
          productPrice: productData.price,
          productImage: productData.image || '',
          productCategory: productData.category || '',
          quantity: quantity,
          selectedSize: productData.selectedSize || null,
          selectedColor: productData.selectedColor || null,
          addedAt: serverTimestamp()
        };

        // Usar estrutura correta: /users/{uid}/cart/current/items
        const itemsRef = collection(db, 'users', this.userId, 'cart', 'current', 'items');
        const docRef = await addDoc(itemsRef, cartItem);
        
        this.cartItems.push({
          id: docRef.id,
          ...cartItem
        });

        console.log('Item adicionado ao carrinho Firebase:', docRef.id);
        this.dispatchCartUpdate();
        return true;
      }
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho Firebase:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Adicionar ao localStorage (usuários guest)
  addToLocalCart(productData, quantity = 1) {
    try {
      let basket = JSON.parse(localStorage.getItem('basket')) || [];
      const existingIndex = basket.findIndex(item => 
        item.name === productData.name &&
        item.selectedSize === (productData.selectedSize || null) &&
        item.selectedColor === (productData.selectedColor || null)
      );
      
      if (existingIndex !== -1) {
        // Update existing item quantity
        basket[existingIndex].quantity = (basket[existingIndex].quantity || 0) + quantity;
      } else {
        // Add new item
        basket.push({
          name: productData.name,
          newPrice: this.formatPriceForDisplay(productData.price),
          imgUrl: productData.image || '',
          quantity: quantity,
          selectedSize: productData.selectedSize || null,
          selectedColor: productData.selectedColor || null
        });
      }
      
      localStorage.setItem('basket', JSON.stringify(basket));
      console.log('Item adicionado ao carrinho localStorage');
      this.dispatchCartUpdate();
      return true;
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho localStorage:', error);
      throw error;
    }
  }

  // Remover item do carrinho
  async removeFromCart(cartItemId) {
    if (this.userId) {
      return await this.removeFromFirebaseCart(cartItemId);
    } else {
      return this.removeFromLocalCart(cartItemId);
    }
  }

  // Remover do Firebase - ESTRUTURA CORRIGIDA
  async removeFromFirebaseCart(cartItemId) {
    if (!this.userId) throw new Error('Usuário não autenticado');
    this.isLoading = true;
    try {
      // Usar estrutura correta: /users/{uid}/cart/current/items/{itemId}
      await deleteDoc(doc(db, 'users', this.userId, 'cart', 'current', 'items', cartItemId));
      this.cartItems = this.cartItems.filter(item => item.id !== cartItemId);
      console.log('Item removido do Firebase:', cartItemId);
      this.dispatchCartUpdate();
      return true;
    } catch (error) {
      console.error('Erro ao remover item do Firebase:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Remover do localStorage
  removeFromLocalCart(cartItemId) {
    try {
      let basket = JSON.parse(localStorage.getItem('basket')) || [];
      basket = basket.filter((item, index) => index !== cartItemId);
      localStorage.setItem('basket', JSON.stringify(basket));
      console.log('Item removido do localStorage');
      this.dispatchCartUpdate();
      return true;
    } catch (error) {
      console.error('Erro ao remover item do localStorage:', error);
      throw error;
    }
  }

  // Atualizar quantidade
  async updateCartItemQuantity(cartItemId, newQuantity) {
    if (newQuantity <= 0) return await this.removeFromCart(cartItemId);

    if (this.userId) {
      return await this.updateFirebaseCartQuantity(cartItemId, newQuantity);
    } else {
      return this.updateLocalCartQuantity(cartItemId, newQuantity);
    }
  }

  // Atualizar quantidade no Firebase - ESTRUTURA CORRIGIDA
  async updateFirebaseCartQuantity(cartItemId, newQuantity) {
    if (!this.userId) throw new Error('Usuário não autenticado');
    this.isLoading = true;
    try {
      // Usar estrutura correta: /users/{uid}/cart/current/items/{itemId}
      await updateDoc(doc(db, 'users', this.userId, 'cart', 'current', 'items', cartItemId), {
        quantity: newQuantity
      });

      const itemIndex = this.cartItems.findIndex(item => item.id === cartItemId);
      if (itemIndex !== -1) {
        this.cartItems[itemIndex].quantity = newQuantity;
      }

      console.log('Quantidade atualizada no Firebase:', cartItemId, newQuantity);
      this.dispatchCartUpdate();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar quantidade no Firebase:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Atualizar quantidade no localStorage
  updateLocalCartQuantity(cartItemId, newQuantity) {
    try {
      let basket = JSON.parse(localStorage.getItem('basket')) || [];
      if (basket[cartItemId]) {
        basket[cartItemId].quantity = newQuantity;
        localStorage.setItem('basket', JSON.stringify(basket));
        console.log('Quantidade atualizada no localStorage:', cartItemId, newQuantity);
        this.dispatchCartUpdate();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Erro ao atualizar quantidade no localStorage:', error);
      throw error;
    }
  }

  // Carregar carrinho
  async loadCart() {
    if (this.userId) {
      return await this.loadFirebaseCart();
    } else {
      return this.loadLocalCart();
    }
  }

  // Carregar carrinho do Firebase - ESTRUTURA CORRIGIDA
  async loadFirebaseCart() {
    if (!this.userId) {
      this.cartItems = [];
      return [];
    }

    this.isLoading = true;
    try {
      // Usar estrutura correta: /users/{uid}/cart/current/items
      const itemsRef = collection(db, 'users', this.userId, 'cart', 'current', 'items');
      const q = query(itemsRef, orderBy('addedAt', 'desc'));
      const querySnapshot = await getDocs(q);

      this.cartItems = [];
      querySnapshot.forEach((doc) => {
        this.cartItems.push({ id: doc.id, ...doc.data() });
      });

      console.log('Carrinho Firebase carregado:', this.cartItems.length, 'itens');
      this.dispatchCartUpdate();
      return this.cartItems;
    } catch (error) {
      console.error('Erro ao carregar carrinho Firebase:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Carregar carrinho do localStorage
  loadLocalCart() {
    try {
      const basket = JSON.parse(localStorage.getItem('basket')) || [];
      console.log('Carrinho localStorage carregado:', basket.length, 'itens');
      this.dispatchCartUpdate();
      return basket;
    } catch (error) {
      console.error('Erro ao carregar carrinho localStorage:', error);
      return [];
    }
  }

  // Limpar carrinho
  async clearCart() {
    if (this.userId) {
      return await this.clearFirebaseCart();
    } else {
      return this.clearLocalCart();
    }
  }

  // Limpar carrinho Firebase - ESTRUTURA CORRIGIDA
  async clearFirebaseCart() {
    if (!this.userId) throw new Error('Usuário não autenticado');
    this.isLoading = true;
    try {
      const batch = writeBatch(db);
      this.cartItems.forEach(item => {
        // Usar estrutura correta: /users/{uid}/cart/current/items/{itemId}
        const docRef = doc(db, 'users', this.userId, 'cart', 'current', 'items', item.id);
        batch.delete(docRef);
      });
      await batch.commit();
      this.cartItems = [];
      console.log('Carrinho Firebase limpo');
      this.dispatchCartUpdate();
      return true;
    } catch (error) {
      console.error('Erro ao limpar carrinho Firebase:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Limpar carrinho localStorage
  clearLocalCart() {
    try {
      localStorage.removeItem('basket');
      console.log('Carrinho localStorage limpo');
      this.dispatchCartUpdate();
      return true;
    } catch (error) {
      console.error('Erro ao limpar carrinho localStorage:', error);
      throw error;
    }
  }

  // Calcular total
  calculateTotal() {
    let subtotal = 0;
    let totalItems = 0;

    if (this.userId) {
      // Firebase cart
      this.cartItems.forEach(item => {
        const itemPrice = item.productPrice || 0;
        const itemQuantity = item.quantity || 0;
        subtotal += itemPrice * itemQuantity;
        totalItems += itemQuantity;
      });
    } else {
      // localStorage cart
      const basket = JSON.parse(localStorage.getItem('basket')) || [];
      basket.forEach(item => {
        const itemPrice = parseInt(item.newPrice?.replace(/[^\d]/g, '') || '0');
        const itemQuantity = item.quantity || 1;
        subtotal += itemPrice * itemQuantity;
        totalItems += itemQuantity;
      });
    }

    const deliveryFee = subtotal > 10000 ? 0 : 500; // Free shipping above £100
    const tax = Math.round(subtotal * 0.05); // 5% de impostos
    const total = subtotal + deliveryFee + tax;

    return {
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      tax: tax,
      total: total,
      totalItems: totalItems,
      formattedSubtotal: this.formatPrice(subtotal),
      formattedDeliveryFee: this.formatPrice(deliveryFee),
      formattedTax: this.formatPrice(tax),
      formattedTotal: this.formatPrice(total)
    };
  }

  // Obter número de itens
  getItemCount() {
    if (this.userId) {
      return this.cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
    } else {
      const basket = JSON.parse(localStorage.getItem('basket')) || [];
      return basket.reduce((total, item) => total + (item.quantity || 1), 0);
    }
  }

  // Formatar preço
  formatPrice(priceInCents) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(priceInCents / 100);
  }

  // Formatar preço para display (localStorage)
  formatPriceForDisplay(priceInCents) {
    return `£${(priceInCents / 100).toFixed(2)}`;
  }

  // Disparar evento de atualização do carrinho
  dispatchCartUpdate() {
    window.dispatchEvent(new CustomEvent('cartUpdated', { 
      detail: { 
        items: this.userId ? this.cartItems : JSON.parse(localStorage.getItem('basket')) || [],
        count: this.getItemCount(),
        total: this.calculateTotal()
      } 
    }));
  }
}

// ============================================================================
// 4. FUNÇÕES AUXILIARES PARA EXTRAIR DADOS DO HTML
// ============================================================================

class ProductExtractor {
  // Extrair dados do produto da página atual
  static extractProductFromPage() {
    try {
      // Tentar diferentes seletores comuns
      const productData = {
        id: this.generateProductId(),
        name: this.extractProductName(),
        price: this.extractProductPrice(),
        image: this.extractProductImage(),
        category: this.extractProductCategory(),
        selectedSize: this.getSelectedSize(),
        selectedColor: this.getSelectedColor()
      };

      console.log('Dados do produto extraídos:', productData);
      return productData;
    } catch (error) {
      console.error('Erro ao extrair dados do produto:', error);
      throw new Error('Não foi possível extrair dados do produto da página');
    }
  }

  static extractProductName() {
    // Tentar diferentes seletores para o nome do produto
    const selectors = [
      'h1',
      '.product-title',
      '.product-name',
      '[data-product-name]',
      '.title'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return document.title || 'Produto sem nome';
  }

  static extractProductPrice() {
    // Tentar diferentes seletores para o preço
    const selectors = [
      '.price',
      '.product-price',
      '[data-price]',
      '.cost',
      '.value'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const priceText = element.textContent.trim();
        const priceMatch = priceText.match(/[\d.,]+/);
        if (priceMatch) {
          // Converter para centavos
          const price = parseFloat(priceMatch[0].replace(',', '.')) * 100;
          return Math.round(price);
        }
      }
    }

    return 0; // Preço padrão se não encontrar
  }

  static extractProductImage() {
    // Tentar diferentes seletores para a imagem
    const selectors = [
      '.product-image img',
      '.main-image img',
      '[data-product-image]',
      '.gallery img:first-child'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.src) {
        return element.src;
      }
    }

    return '';
  }

  static extractProductCategory() {
    // Extrair categoria da URL ou breadcrumb
    const url = window.location.pathname;
    
    if (url.includes('leather_jackets')) return 'leather_jackets';
    if (url.includes('belts')) return 'belts';
    if (url.includes('footwear')) return 'footwear';
    if (url.includes('sunglasses')) return 'sunglasses';
    if (url.includes('bags')) return 'bags';
    if (url.includes('wallets')) return 'wallets';
    if (url.includes('gloves')) return 'gloves';
    if (url.includes('scarves')) return 'scarves';
    if (url.includes('accessories')) return 'accessories';
    if (url.includes('bargains')) return 'bargains';

    return 'general';
  }

  static getSelectedSize() {
    const sizeSelector = document.querySelector('select[name="size"], .size-selector select, [data-size]');
    return sizeSelector ? sizeSelector.value : null;
  }

  static getSelectedColor() {
    const colorSelector = document.querySelector('select[name="color"], .color-selector select, [data-color]');
    return colorSelector ? colorSelector.value : null;
  }

  static generateProductId() {
    // Gerar ID baseado na URL e nome do produto
    const url = window.location.pathname;
    const name = this.extractProductName();
    return btoa(url + name).replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  }
}

// ============================================================================
// 5. INSTÂNCIAS GLOBAIS E FUNÇÕES DE CONVENIÊNCIA
// ============================================================================

// Criar instâncias globais
export const userManager = new UserManager();
export const cartManager = new CartManager();

// Funções globais para uso direto no HTML (COMPATIBILIDADE)
window.FitRightFirebase = {
  // Autenticação
  async login(email, password) {
    return await userManager.loginUser(email, password);
  },
  
  async register(email, password, displayName = '') {
    return await userManager.registerUser(email, password, displayName);
  },
  
  async logout() {
    return await userManager.logoutUser();
  },
  
  isLoggedIn() {
    return userManager.isAuthenticated();
  },
  
  // Carrinho (COMPATIBILIDADE COM CÓDIGO EXISTENTE)
  async addToCart(productId, quantity = 1, options = {}) {
    const productData = {
      id: productId,
      name: options.name || ProductExtractor.extractProductName(),
      price: options.price || ProductExtractor.extractProductPrice(),
      image: options.image || ProductExtractor.extractProductImage(),
      category: options.category || ProductExtractor.extractProductCategory(),
      selectedSize: options.size || ProductExtractor.getSelectedSize(),
      selectedColor: options.color || ProductExtractor.getSelectedColor()
    };
    return await cartManager.addToCart(productData, quantity);
  },
  
  async addProductToCart(productData, quantity = 1) {
    return await cartManager.addToCart(productData, quantity);
  },
  
  async removeFromCart(cartItemId) {
    return await cartManager.removeFromCart(cartItemId);
  },
  
  async updateQuantity(cartItemId, quantity) {
    return await cartManager.updateCartItemQuantity(cartItemId, quantity);
  },
  
  async clearCart() {
    return await cartManager.clearCart();
  },
  
  getCartCount() {
    return cartManager.getItemCount();
  },
  
  getCartTotal() {
    return cartManager.calculateTotal();
  },
  
  getCartItems() {
    return cartManager.userId ? cartManager.cartItems : JSON.parse(localStorage.getItem('basket')) || [];
  },
  
  async loadCart() {
    return await cartManager.loadCart();
  },
  
  formatPrice(priceInCents) {
    return cartManager.formatPrice(priceInCents);
  },

  // Utility function to clear corrupted cart data
  async clearCorruptedCart() {
    try {
      if (this.isLoggedIn()) {
        // Clear Firebase cart
        await this.clearCart();
        console.log('Firebase cart cleared');
      } else {
        // Clear localStorage cart
        localStorage.removeItem('basket');
        console.log('LocalStorage cart cleared');
      }
      
      // Dispatch cart update event
      window.dispatchEvent(new CustomEvent('cartUpdated'));
      
      return true;
    } catch (error) {
      console.error('Error clearing corrupted cart:', error);
      return false;
    }
  },

  // Utility function to check for corrupted cart items
  hasCorruptedItems() {
    try {
      const items = this.getCartItems();
      return items.some(item => {
        const data = typeof item.data === 'function' ? item.data() : (item.productData || item);
        const price = data.price || data.productPrice || 0;
        const name = data.productName || data.name || data.title || '';
        
        // Check for corrupted items (zero price or generic names)
        return price === 0 || 
               name === 'Produto sem nome' || 
               name === 'Untitled Product' ||
               name === 'Product' ||
               name.includes('RETRO ROUND BROWN') ||
               name.includes('MIDNIGHT MARCHER');
      });
    } catch (error) {
      console.error('Error checking for corrupted items:', error);
      return false;
    }
  }
};

// Função para atualizar contador do carrinho na UI
function updateCartCounter() {
  const counters = document.querySelectorAll('.cart-counter, [data-cart-count], #basketCount, #basketCountMobile');
  const count = cartManager.getItemCount();
  
  counters.forEach(counter => {
    counter.textContent = count;
    counter.style.display = count > 0 ? 'inline-block' : 'none';
  });
}

// Event listeners
window.addEventListener('cartUpdated', updateCartCounter);
window.addEventListener('authStateChanged', (event) => {
  const { isLoggedIn } = event.detail;
  
  // Mostrar/esconder elementos baseado no login
  const loginElements = document.querySelectorAll('.login-required');
  const logoutElements = document.querySelectorAll('.logout-required');
  
  loginElements.forEach(el => {
    el.style.display = isLoggedIn ? 'block' : 'none';
  });
  
  logoutElements.forEach(el => {
    el.style.display = isLoggedIn ? 'none' : 'block';
  });
  
  updateCartCounter();
});

// Inject global CSS to round product images consistently with modal image radius
function injectRoundedProductImageStyles() {
  try {
    if (document.getElementById('fitright-rounded-image-style')) return;

    // Default radius
    let desiredBorderRadius = '10px';

    // Try to read from modal image if present to match its rounding
    const modalImage = document.getElementById('modalProductImage');
    if (modalImage) {
      const computed = window.getComputedStyle(modalImage);
      if (computed && computed.borderRadius && computed.borderRadius !== '0px') {
        desiredBorderRadius = computed.borderRadius;
      }
    }

    const styleEl = document.createElement('style');
    styleEl.id = 'fitright-rounded-image-style';
    styleEl.textContent = `
      /* Rounded corners for all product images across pages */
      .product img,
      .products img,
      .product .image img,
      .product .image-container img,
      .products .product img {
        border-radius: ${desiredBorderRadius} !important;
        overflow: hidden;
      }
    `;
    document.head.appendChild(styleEl);
  } catch (_) {
    // no-op
  }
}

// Apply immediately if DOM is ready, otherwise wait
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  injectRoundedProductImageStyles();
} else {
  document.addEventListener('DOMContentLoaded', injectRoundedProductImageStyles);
}

// Update basket counter on page load
document.addEventListener('DOMContentLoaded', () => {
  updateCartCounter();
});

console.log('FitRight Cart inicializado com sucesso!');
console.log('Use window.FitRightFirebase para acessar as funções');

