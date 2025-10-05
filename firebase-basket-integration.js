// firebase-basket-integration.js
// Comprehensive Firebase basket integration for all pages
// Provides unified basket management with Firebase backend and localStorage fallback

console.log('Firebase Basket Integration: Loading...');

// Import Firebase functions
import { 
  auth, 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc,
  onAuthStateChanged,
  serverTimestamp 
} from './firebase.js';

// Global basket manager
class FirebaseBasketIntegration {
  constructor() {
    this.currentUser = null;
    this.isInitialized = false;
    this.basketUpdateCallbacks = [];
    
    // Initialize auth listener
    this.initAuthListener();
    
    // Initialize event listeners
    this.initEventListeners();
    
    console.log('FirebaseBasketIntegration: Initialized');
  }
  
  initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
      console.log('FirebaseBasketIntegration: Auth state changed', { 
        user: user ? user.uid : null, 
        previousUser: this.currentUser 
      });
      
      const previousUser = this.currentUser;
      this.currentUser = user;
      
      if (user) {
        // User signed in
        await this.handleUserSignIn(user, previousUser);
      } else {
        // User signed out
        await this.handleUserSignOut(previousUser);
      }
      
      // Update all basket UIs
      this.updateAllBasketUIs();
    });
  }
  
  async handleUserSignIn(user, previousUser) {
    console.log('FirebaseBasketIntegration: User signed in', user.uid);
    
    try {
      // 1. Save current guest cart to separate storage
      const guestCart = JSON.parse(localStorage.getItem('basket') || '[]');
      if (guestCart.length > 0) {
        localStorage.setItem('guestBasket', JSON.stringify(guestCart));
        console.log('FirebaseBasketIntegration: Saved guest cart', guestCart.length, 'items');
      }
      
      // 2. Clear the main basket localStorage key
      localStorage.removeItem('basket');
      console.log('FirebaseBasketIntegration: Cleared main basket localStorage');
      
      // 3. Load user's Firestore cart and populate localStorage
      await this.loadUserCartToLocalStorage(user.uid);
      
    } catch (error) {
      console.error('FirebaseBasketIntegration: Error handling sign in', error);
    }
  }
  
  async handleUserSignOut(previousUser) {
    console.log('FirebaseBasketIntegration: User signed out');
    
    try {
      // 1. Clear user-specific basket
      if (previousUser) {
        localStorage.removeItem(`basket_${previousUser.uid}`);
      }
      
      // 2. Restore guest basket if it exists
      const guestCart = JSON.parse(localStorage.getItem('guestBasket') || '[]');
      if (guestCart.length > 0) {
        localStorage.setItem('basket', JSON.stringify(guestCart));
        console.log('FirebaseBasketIntegration: Restored guest cart', guestCart.length, 'items');
      } else {
        // Ensure basket is empty for new guest
        localStorage.setItem('basket', '[]');
      }
      
    } catch (error) {
      console.error('FirebaseBasketIntegration: Error handling sign out', error);
    }
  }
  
  async loadUserCartToLocalStorage(userId) {
    try {
      console.log('FirebaseBasketIntegration: Loading user cart for userId:', userId);
      
      // Load user's cart from Firestore
      const cartQuery = query(
        collection(db, 'carts'), 
        where('userId', '==', userId)
      );
      
      const querySnapshot = await getDocs(cartQuery);
      const cartItems = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        cartItems.push({
          id: doc.id,
          name: data.productName || data.name,
          newPrice: data.price ? `£${(data.price / 100).toFixed(2)}` : '£0.00',
          imgUrl: data.productImage || data.image || '',
          quantity: data.quantity || 1,
          selectedSize: data.selectedSize || null,
          selectedColor: data.selectedColor || null
        });
      });
      
      // Store in localStorage with user-specific key
      localStorage.setItem(`basket_${userId}`, JSON.stringify(cartItems));
      
      console.log('FirebaseBasketIntegration: Loaded user cart', cartItems.length, 'items');
      
    } catch (error) {
      console.error('FirebaseBasketIntegration: Error loading user cart', error);
      // Fallback to empty cart for user
      localStorage.setItem(`basket_${userId}`, '[]');
    }
  }
  
  async addToBasket(productData) {
    if (this.currentUser) {
      // Add to Firebase when logged in
      try {
        const cartData = {
          userId: this.currentUser.uid,
          productName: productData.name,
          price: parseFloat(productData.price.replace('£', '')) * 100, // Convert to cents
          productImage: productData.imgUrl,
          quantity: productData.quantity || 1,
          selectedSize: productData.selectedSize || null,
          selectedColor: productData.selectedColor || null,
          timestamp: serverTimestamp()
        };
        
        await addDoc(collection(db, 'carts'), cartData);
        console.log('FirebaseBasketIntegration: Product added to Firebase cart');
        
        // Update localStorage
        await this.loadUserCartToLocalStorage(this.currentUser.uid);
        
      } catch (error) {
        console.error('FirebaseBasketIntegration: Error adding to Firebase cart', error);
        // Fallback to localStorage
        this.addToBasketLocal(productData);
      }
    } else {
      // Add to localStorage when not logged in
      this.addToBasketLocal(productData);
    }
    
    // Update all basket UIs
    this.updateAllBasketUIs();
  }
  
  addToBasketLocal(productData) {
    let basket = JSON.parse(localStorage.getItem("basket") || '[]');
    const existingIndex = basket.findIndex(item => item.name === productData.name);
    
    if (existingIndex !== -1) {
      basket[existingIndex].quantity = (basket[existingIndex].quantity || 1) + 1;
    } else {
      basket.push({
        name: productData.name,
        newPrice: productData.price,
        imgUrl: productData.imgUrl,
        quantity: productData.quantity || 1
      });
    }
    
    localStorage.setItem("basket", JSON.stringify(basket));
    console.log('FirebaseBasketIntegration: Product added to local cart');
  }
  
  async removeFromBasket(productName) {
    if (this.currentUser) {
      // Remove from Firebase when logged in
      try {
        const cartQuery = query(
          collection(db, 'carts'), 
          where('userId', '==', this.currentUser.uid),
          where('productName', '==', productName)
        );
        
        const querySnapshot = await getDocs(cartQuery);
        if (!querySnapshot.empty) {
          const docToDelete = querySnapshot.docs[0];
          await deleteDoc(doc(db, 'carts', docToDelete.id));
          console.log('FirebaseBasketIntegration: Product removed from Firebase cart');
          
          // Update localStorage
          await this.loadUserCartToLocalStorage(this.currentUser.uid);
        }
        
      } catch (error) {
        console.error('FirebaseBasketIntegration: Error removing from Firebase cart', error);
        // Fallback to localStorage
        this.removeFromBasketLocal(productName);
      }
    } else {
      // Remove from localStorage when not logged in
      this.removeFromBasketLocal(productName);
    }
    
    // Update all basket UIs
    this.updateAllBasketUIs();
  }
  
  removeFromBasketLocal(productName) {
    let basket = JSON.parse(localStorage.getItem("basket") || '[]');
    const productIndex = basket.findIndex(item => item.name === productName);
    
    if (productIndex !== -1) {
      if (basket[productIndex].quantity > 1) {
        basket[productIndex].quantity--;
      } else {
        basket.splice(productIndex, 1);
      }
      localStorage.setItem("basket", JSON.stringify(basket));
      console.log('FirebaseBasketIntegration: Product removed from local cart');
    }
  }
  
  async clearBasket() {
    if (this.currentUser) {
      // Clear Firebase cart when logged in
      try {
        const cartQuery = query(
          collection(db, 'carts'), 
          where('userId', '==', this.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(cartQuery);
        const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        
        // Clear localStorage for this user
        localStorage.removeItem(`basket_${this.currentUser.uid}`);
        
        console.log('FirebaseBasketIntegration: Basket cleared for user');
      } catch (error) {
        console.error('FirebaseBasketIntegration: Error clearing basket', error);
        // Fallback to localStorage
        localStorage.removeItem(`basket_${this.currentUser.uid}`);
      }
    } else {
      // Clear localStorage when not logged in
      localStorage.removeItem("basket");
      console.log('FirebaseBasketIntegration: Guest basket cleared');
    }
    
    // Update all basket UIs
    this.updateAllBasketUIs();
  }
  
  getCurrentBasket() {
    if (this.currentUser) {
      // Return user's basket from user-specific localStorage key
      const userKey = `basket_${this.currentUser.uid}`;
      const userBasket = JSON.parse(localStorage.getItem(userKey) || '[]');
      return userBasket;
    } else {
      // Return guest basket
      const guestBasket = JSON.parse(localStorage.getItem('basket') || '[]');
      return guestBasket;
    }
  }
  
  getCurrentBasketCount() {
    const basket = this.getCurrentBasket();
    return basket.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }
  
  updateAllBasketUIs() {
    const basket = this.getCurrentBasket();
    const count = this.getCurrentBasketCount();
    
    console.log('FirebaseBasketIntegration: Updating basket UIs', {
      user: this.currentUser?.uid || 'guest',
      count: count,
      items: basket.length
    });
    
    // Dispatch custom event for all basket UIs to update
    window.dispatchEvent(new CustomEvent('basketAuthStateChanged', {
      detail: {
        user: this.currentUser,
        isLoggedIn: !!this.currentUser,
        basket: basket,
        count: count
      }
    }));
    
    // Also dispatch the existing cartUpdated event for compatibility
    window.dispatchEvent(new CustomEvent('cartUpdated', {
      detail: {
        items: basket,
        count: count
      }
    }));
  }
  
  initEventListeners() {
    // Listen for basket changes from other parts of the app
    window.addEventListener('storage', (e) => {
      if (e.key === 'basket' || e.key?.startsWith('basket_')) {
        console.log('FirebaseBasketIntegration: localStorage basket changed', e.key);
        this.updateAllBasketUIs();
      }
    });
    
    // Listen for manual basket updates
    window.addEventListener('basketItemAdded', () => {
      console.log('FirebaseBasketIntegration: Item added to basket');
      this.updateAllBasketUIs();
    });
    
    window.addEventListener('basketItemRemoved', () => {
      console.log('FirebaseBasketIntegration: Item removed from basket');
      this.updateAllBasketUIs();
    });
  }
  
  // Public API methods
  isLoggedIn() {
    return !!this.currentUser;
  }
  
  getCurrentUser() {
    return this.currentUser;
  }
  
  // Method to manually trigger basket sync (for debugging)
  async syncBasket() {
    if (this.currentUser) {
      await this.loadUserCartToLocalStorage(this.currentUser.uid);
      this.updateAllBasketUIs();
    }
  }
}

// Create global instance
window.FirebaseBasketIntegration = new FirebaseBasketIntegration();

// Override the global addToBasket function to use the new integration
window.addToBasket = async function(name, price, imgUrl, showMessage = true) {
  console.log('Global addToBasket called with:', { name, price, imgUrl, showMessage });
  
  if (window.FirebaseBasketIntegration) {
    const productData = {
      name: name,
      price: price,
      imgUrl: imgUrl,
      quantity: 1
    };
    
    await window.FirebaseBasketIntegration.addToBasket(productData);
    
    if (showMessage) {
      // Use showToast if available, otherwise use alert
      if (typeof showToast === 'function') {
        showToast("Product added to basket!");
      } else {
        alert("Product added to basket!");
      }
    }
    
    console.log('Product added to basket via FirebaseBasketIntegration:', name);
  } else {
    // Fallback to localStorage
    let basket = JSON.parse(localStorage.getItem("basket") || '[]');
    const existingIndex = basket.findIndex(item => item.name === name);
    
    if (existingIndex !== -1) {
      basket[existingIndex].quantity = (basket[existingIndex].quantity || 1) + 1;
    } else {
      basket.push({ name, newPrice: price, imgUrl, quantity: 1 });
    }
    
    localStorage.setItem("basket", JSON.stringify(basket));
    
    if (showMessage) {
      if (typeof showToast === 'function') {
        showToast("Product added to basket!");
      } else {
        alert("Product added to basket!");
      }
    }
  }
};

// Override the global removeFromBasket function
window.removeFromBasket = async function(productName) {
  if (window.FirebaseBasketIntegration) {
    await window.FirebaseBasketIntegration.removeFromBasket(productName);
    console.log('Product removed from basket via FirebaseBasketIntegration:', productName);
  } else {
    // Fallback to localStorage
    let basket = JSON.parse(localStorage.getItem("basket") || '[]');
    const productIndex = basket.findIndex(item => item.name === productName);
    
    if (productIndex !== -1) {
      if (basket[productIndex].quantity > 1) {
        basket[productIndex].quantity--;
      } else {
        basket.splice(productIndex, 1);
      }
      localStorage.setItem("basket", JSON.stringify(basket));
    }
  }
};

// Override the global clearBasket function
window.clearBasket = async function() {
  if (window.FirebaseBasketIntegration) {
    await window.FirebaseBasketIntegration.clearBasket();
    console.log('Basket cleared via FirebaseBasketIntegration');
  } else {
    // Fallback to localStorage
    localStorage.removeItem("basket");
  }
};

// Export for module usage
export default window.FirebaseBasketIntegration; 