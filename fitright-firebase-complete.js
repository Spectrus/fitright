// fitright-firebase-complete.js
// ARQUIVO ÚNICO COM TODAS AS FUNCIONALIDADES FIREBASE PARA FITRIGHT
// Inclui: Configuração, Usuários, Carrinho e Produtos
// Project ID: mark-1-3a013

// ============================================================================
// 1. IMPORTAÇÕES DO FIREBASE (USANDO firebase.js)
// ============================================================================

import { auth, db } from "./firebase.js";
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  serverTimestamp,
  writeBatch,
  and
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Inicializar Storage (se necessário)
const storage = getStorage();

// Habilitar persistência offline
if (typeof window !== 'undefined') {
  import('firebase/firestore').then(({ enablePersistence }) => {
    enablePersistence(db, { synchronizeTabs: true }).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('Persistência falhou: múltiplas abas abertas');
      } else if (err.code === 'unimplemented') {
        console.warn('Persistência não suportada neste browser');
      }
    });
  });
}

// ============================================================================
// 2. GERENCIAMENTO DE USUÁRIOS
// ============================================================================

class UserManager {
  constructor() {
    this.currentUser = null;
    this.userData = null;
    this.isLoading = false;
    
    // Monitorar mudanças de autenticação
    onAuthStateChanged(auth, async (user) => {
      this.currentUser = user;
      if (user) {
        await this.loadUserData();
      } else {
        this.userData = null;
      }
    });
  }

  // Registrar novo usuário
  async registerUser(email, password, additionalData = {}) {
    this.isLoading = true;
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (additionalData.displayName) {
        await updateProfile(user, { displayName: additionalData.displayName });
      }

      const userData = {
        email: user.email,
        displayName: additionalData.displayName || '',
        photoURL: additionalData.photoURL || '',
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        preferences: {
          language: 'en-GB',
          currency: 'GBP',
          notifications: { email: true, push: false, sms: false },
          privacy: { showProfile: false, shareData: false }
        },
        fittingRoomSettings: {
          lastUsedFilters: {},
          savedOutfits: [],
          measurementProfile: {},
          viewPreferences: {
            backgroundType: 'studio',
            lightingMode: 'natural',
            viewAngle: 'front'
          }
        }
      };

      await setDoc(doc(db, 'users', user.uid), userData);
      await sendEmailVerification(user);

      console.log('Usuário registrado com sucesso:', user.uid);
      return { uid: user.uid, email: user.email, displayName: user.displayName };
    } catch (error) {
      console.error('Erro ao registrar usuário:', error);
      throw this.handleAuthError(error);
    } finally {
      this.isLoading = false;
    }
  }

  // Fazer login
  async loginUser(email, password) {
    this.isLoading = true;
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await this.updateLastLogin();
      console.log('Usuário logado com sucesso:', user.uid);
      return { uid: user.uid, email: user.email, displayName: user.displayName };
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      throw this.handleAuthError(error);
    } finally {
      this.isLoading = false;
    }
  }

  // Fazer logout
  async logoutUser() {
    try {
      await signOut(auth);
      this.currentUser = null;
      this.userData = null;
      console.log('Usuário deslogado com sucesso');
      return true;
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
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
        return this.userData;
      } else {
        await this.createUserDocument();
        return this.userData;
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      throw error;
    }
  }

  // Atualizar configurações da sala de prova
  async updateFittingRoomSettings(settings) {
    if (!this.currentUser) throw new Error('Usuário não autenticado');
    try {
      const currentSettings = this.userData?.fittingRoomSettings || {};
      const updatedSettings = { ...currentSettings, ...settings };
      await this.updateUserData({ fittingRoomSettings: updatedSettings });
      console.log('Configurações da sala de prova atualizadas');
      return true;
    } catch (error) {
      console.error('Erro ao atualizar configurações da sala de prova:', error);
      throw error;
    }
  }

  // Atualizar dados do usuário
  async updateUserData(updates) {
    if (!this.currentUser) throw new Error('Usuário não autenticado');
    try {
      const userRef = doc(db, 'users', this.currentUser.uid);
      await updateDoc(userRef, { ...updates, updatedAt: serverTimestamp() });
      this.userData = { ...this.userData, ...updates };
      console.log('Dados do usuário atualizados');
      return true;
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
      throw error;
    }
  }

  // Verificar se usuário está autenticado
  isAuthenticated() {
    return this.currentUser !== null;
  }

  // Obter configurações da sala de prova
  getFittingRoomSettings() {
    return this.userData?.fittingRoomSettings || {
      lastUsedFilters: {},
      savedOutfits: [],
      measurementProfile: {},
      viewPreferences: {
        backgroundType: 'studio',
        lightingMode: 'natural',
        viewAngle: 'front'
      }
    };
  }

  // Métodos auxiliares
  async createUserDocument() {
    if (!this.currentUser) return;
    const userData = {
      email: this.currentUser.email,
      displayName: this.currentUser.displayName || '',
      photoURL: this.currentUser.photoURL || '',
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      preferences: {
        language: 'en-GB',
        currency: 'GBP',
        notifications: { email: true, push: false, sms: false },
        privacy: { showProfile: false, shareData: false }
      },
      fittingRoomSettings: {
        lastUsedFilters: {},
        savedOutfits: [],
        measurementProfile: {},
        viewPreferences: {
          backgroundType: 'studio',
          lightingMode: 'natural',
          viewAngle: 'front'
        }
      }
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
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde',
      'auth/network-request-failed': 'Erro de conexão. Verifique sua internet'
    };
    const message = errorMessages[error.code] || 'Erro desconhecido';
    return new Error(message);
  }
}

// ============================================================================
// 3. GERENCIAMENTO DO CARRINHO
// ============================================================================

class CartManager {
  constructor() {
    this.userId = null;
    this.cartItems = [];
    this.isLoading = false;
    
    // Monitorar mudanças de autenticação
    auth.onAuthStateChanged((user) => {
      if (user) {
        this.userId = user.uid;
        this.loadCart();
      } else {
        this.userId = null;
        this.cartItems = [];
      }
    });
  }

  // Adicionar item ao carrinho
  async addToCart(productId, quantity = 1, options = {}) {
    if (!this.userId) throw new Error('Usuário não autenticado');
    if (!productId || quantity <= 0) throw new Error('Dados inválidos para adicionar ao carrinho');

    this.isLoading = true;
    try {
      // Verificar se o produto existe e está disponível
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (!productDoc.exists()) throw new Error('Produto não encontrado');

      const productData = productDoc.data();
      if (!productData.available) throw new Error('Produto não disponível');

      // Verificar se o item já existe no carrinho
      const existingItem = await this.findCartItem(productId, options);
      
      if (existingItem) {
        return await this.updateCartItemQuantity(existingItem.id, existingItem.quantity + quantity);
      } else {
        const cartItem = {
          productId: productId,
          quantity: quantity,
          price: productData.price,
          addedAt: serverTimestamp(),
          selectedSize: options.size || null,
          selectedColor: options.color || null,
          customizations: options.customizations || {},
          notes: options.notes || '',
          savedForLater: false,
          giftWrap: options.giftWrap || false,
          giftMessage: options.giftMessage || ''
        };

        const cartRef = collection(db, 'users', this.userId, 'cart');
        const docRef = await addDoc(cartRef, cartItem);
        
        this.cartItems.push({
          id: docRef.id,
          ...cartItem,
          productData: productData
        });

        console.log('Item adicionado ao carrinho:', docRef.id);
        return true;
      }
    } catch (error) {
      console.error('Erro ao adicionar item ao carrinho:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Remover item do carrinho
  async removeFromCart(cartItemId) {
    if (!this.userId) throw new Error('Usuário não autenticado');
    this.isLoading = true;
    try {
      await deleteDoc(doc(db, 'users', this.userId, 'cart', cartItemId));
      this.cartItems = this.cartItems.filter(item => item.id !== cartItemId);
      console.log('Item removido do carrinho:', cartItemId);
      return true;
    } catch (error) {
      console.error('Erro ao remover item do carrinho:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Atualizar quantidade
  async updateCartItemQuantity(cartItemId, newQuantity) {
    if (!this.userId) throw new Error('Usuário não autenticado');
    if (newQuantity <= 0) return await this.removeFromCart(cartItemId);

    this.isLoading = true;
    try {
      await updateDoc(doc(db, 'users', this.userId, 'cart', cartItemId), {
        quantity: newQuantity
      });

      const itemIndex = this.cartItems.findIndex(item => item.id === cartItemId);
      if (itemIndex !== -1) {
        this.cartItems[itemIndex].quantity = newQuantity;
      }

      console.log('Quantidade atualizada:', cartItemId, newQuantity);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Carregar carrinho
  async loadCart() {
    if (!this.userId) {
      this.cartItems = [];
      return [];
    }

    this.isLoading = true;
    try {
      const cartRef = collection(db, 'users', this.userId, 'cart');
      const q = query(cartRef, orderBy('addedAt', 'desc'));
      const querySnapshot = await getDocs(q);

      this.cartItems = [];
      for (const docSnap of querySnapshot.docs) {
        const cartItem = { id: docSnap.id, ...docSnap.data() };
        
        try {
          const productDoc = await getDoc(doc(db, 'products', cartItem.productId));
          if (productDoc.exists()) {
            cartItem.productData = productDoc.data();
          }
        } catch (error) {
          console.warn('Erro ao carregar dados do produto:', cartItem.productId);
        }

        this.cartItems.push(cartItem);
      }

      console.log('Carrinho carregado:', this.cartItems.length, 'itens');
      return this.cartItems;
    } catch (error) {
      console.error('Erro ao carregar carrinho:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Limpar carrinho
  async clearCart() {
    if (!this.userId) throw new Error('Usuário não autenticado');
    this.isLoading = true;
    try {
      const batch = writeBatch(db);
      this.cartItems.forEach(item => {
        const docRef = doc(db, 'users', this.userId, 'cart', item.id);
        batch.delete(docRef);
      });
      await batch.commit();
      this.cartItems = [];
      console.log('Carrinho limpo');
      return true;
    } catch (error) {
      console.error('Erro ao limpar carrinho:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Calcular total
  calculateTotal() {
    let subtotal = 0;
    let totalItems = 0;

    this.cartItems.forEach(item => {
      const itemPrice = item.price || 0;
      const itemQuantity = item.quantity || 0;
      subtotal += itemPrice * itemQuantity;
      totalItems += itemQuantity;
    });

    const deliveryFee = subtotal > 10000 ? 0 : 500;
    const tax = Math.round(subtotal * 0.05);
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
    return this.cartItems.reduce((total, item) => total + (item.quantity || 0), 0);
  }

  // Encontrar item no carrinho
  async findCartItem(productId, options = {}) {
    const cartRef = collection(db, 'users', this.userId, 'cart');
    const q = query(cartRef, where('productId', '==', productId));
    const querySnapshot = await getDocs(q);

    for (const doc of querySnapshot.docs) {
      const item = doc.data();
      if (item.selectedSize === (options.size || null) &&
          item.selectedColor === (options.color || null)) {
        return { id: doc.id, ...item };
      }
    }
    return null;
  }

  // Formatar preço
  formatPrice(priceInCents) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(priceInCents / 100);
  }
}

// ============================================================================
// 4. GERENCIAMENTO DE PRODUTOS
// ============================================================================

class ProductManager {
  constructor() {
    this.products = [];
    this.categories = [];
    this.isLoading = false;
    this.lastDocument = null;
    this.hasMore = true;
  }

  // Carregar produtos por categoria
  async loadProductsByCategory(category, pageSize = 20, reset = false) {
    this.isLoading = true;
    try {
      if (reset) {
        this.lastDocument = null;
        this.hasMore = true;
        this.products = [];
      }

      if (!this.hasMore) return this.products;

      const productsRef = collection(db, 'products');
      let q;

      if (category === 'all') {
        q = query(
          productsRef,
          where('available', '==', true),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      } else if (category === 'bargains') {
        q = query(
          productsRef,
          and(
            where('available', '==', true),
            where('salePrice', '>', 0)
          ),
          orderBy('salePrice', 'asc'),
          limit(pageSize)
        );
      } else {
        q = query(
          productsRef,
          and(
            where('category', '==', category),
            where('available', '==', true)
          ),
          orderBy('createdAt', 'desc'),
          limit(pageSize)
        );
      }

      if (this.lastDocument) {
        q = query(q, startAfter(this.lastDocument));
      }

      const querySnapshot = await getDocs(q);
      const newProducts = [];

      querySnapshot.forEach((doc) => {
        newProducts.push({ id: doc.id, ...doc.data() });
      });

      this.lastDocument = querySnapshot.docs[querySnapshot.docs.length - 1];
      this.hasMore = querySnapshot.docs.length === pageSize;

      if (reset) {
        this.products = newProducts;
      } else {
        this.products = [...this.products, ...newProducts];
      }

      console.log(`Carregados ${newProducts.length} produtos da categoria: ${category}`);
      return this.products;
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Obter produto por ID
  async getProductById(productId) {
    try {
      const productDoc = await getDoc(doc(db, 'products', productId));
      if (productDoc.exists()) {
        return { id: productDoc.id, ...productDoc.data() };
      } else {
        console.warn('Produto não encontrado:', productId);
        return null;
      }
    } catch (error) {
      console.error('Erro ao obter produto:', error);
      throw error;
    }
  }

  // Buscar produtos
  async searchProducts(searchTerm, category = null) {
    this.isLoading = true;
    try {
      const productsRef = collection(db, 'products');
      const searchTermLower = searchTerm.toLowerCase();
      let q;
      
      if (category && category !== 'all') {
        q = query(
          productsRef,
          and(
            where('category', '==', category),
            where('available', '==', true),
            where('tags', 'array-contains', searchTermLower)
          ),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      } else {
        q = query(
          productsRef,
          and(
            where('available', '==', true),
            where('tags', 'array-contains', searchTermLower)
          ),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
      }

      const querySnapshot = await getDocs(q);
      const searchResults = [];

      querySnapshot.forEach((doc) => {
        const product = { id: doc.id, ...doc.data() };
        if (product.name.toLowerCase().includes(searchTermLower) ||
            product.description?.toLowerCase().includes(searchTermLower)) {
          searchResults.push(product);
        }
      });

      console.log(`Encontrados ${searchResults.length} produtos para: ${searchTerm}`);
      return searchResults;
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // Formatar preço
  formatPrice(priceInCents) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(priceInCents / 100);
  }

  // Verificar se está em promoção
  isOnSale(product) {
    return product.salePrice && product.salePrice > 0 && product.salePrice < product.price;
  }

  // Calcular desconto
  getDiscountPercentage(product) {
    if (!this.isOnSale(product)) return 0;
    const discount = ((product.price - product.salePrice) / product.price) * 100;
    return Math.round(discount);
  }
}

// ============================================================================
// 5. INSTÂNCIAS GLOBAIS E FUNÇÕES DE CONVENIÊNCIA
// ============================================================================

// Criar instâncias globais
export const userManager = new UserManager();
export const cartManager = new CartManager();
export const productManager = new ProductManager();

// Funções de conveniência para uso direto no HTML
window.FitRightFirebase = {
  // Autenticação
  async login(email, password) {
    return await userManager.loginUser(email, password);
  },
  
  async register(email, password, displayName = '') {
    return await userManager.registerUser(email, password, { displayName });
  },
  
  async logout() {
    return await userManager.logoutUser();
  },
  
  isLoggedIn() {
    return userManager.isAuthenticated();
  },
  
  // Carrinho
  async addToCart(productId, quantity = 1, options = {}) {
    return await cartManager.addToCart(productId, quantity, options);
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
  
  async loadCart() {
    return await cartManager.loadCart();
  },
  
  // Produtos
  async loadProducts(category = 'all', pageSize = 20) {
    return await productManager.loadProductsByCategory(category, pageSize, true);
  },
  
  async searchProducts(searchTerm, category = null) {
    return await productManager.searchProducts(searchTerm, category);
  },
  
  async getProduct(productId) {
    return await productManager.getProductById(productId);
  },
  
  formatPrice(priceInCents) {
    return productManager.formatPrice(priceInCents);
  },
  
  // Sala de prova
  async saveFittingRoomSettings(settings) {
    return await userManager.updateFittingRoomSettings(settings);
  },
  
  getFittingRoomSettings() {
    return userManager.getFittingRoomSettings();
  }
};

// Monitorar mudanças de autenticação e atualizar UI
auth.onAuthStateChanged((user) => {
  // Disparar evento customizado para a UI reagir
  window.dispatchEvent(new CustomEvent('authStateChanged', { 
    detail: { user: user, isLoggedIn: !!user } 
  }));
});

console.log('FitRight Firebase inicializado com sucesso!');
console.log('Use window.FitRightFirebase para acessar as funções');

