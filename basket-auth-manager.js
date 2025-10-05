// basket-auth-manager.js
// Simplified basket management - only handles basket switching and events
// Removes all overlaps with firebase.js and fitright-cart-only.js

console.log('Basket Auth Manager: Initializing (simplified)...');

class BasketAuthManager {
  constructor() {
    this.currentUser = null;
    
    // Listen for auth state changes from fitright-cart-only.js
    window.addEventListener('authStateChanged', (event) => {
      const { user, isLoggedIn } = event.detail;
      this.currentUser = user;
      this.handleAuthStateChange(user, isLoggedIn);
    });
    
    // Listen for cart updates from fitright-cart-only.js
    window.addEventListener('cartUpdated', () => {
      this.dispatchBasketUpdate();
    });
  }

  handleAuthStateChange(user, isLoggedIn) {
    console.log('Basket Auth Manager: Auth state changed', { 
      user: user ? user.uid : null, 
      isLoggedIn: isLoggedIn 
    });

    if (isLoggedIn && user) {
      // User signed in - switch to user basket
      this.switchToUserBasket(user.uid);
    } else {
      // User signed out - switch to guest basket
      this.switchToGuestBasket();
    }
  }

  switchToUserBasket(userId) {
    console.log('Basket Auth Manager: Switching to user basket for:', userId);
    
    // Set user mode
    localStorage.setItem('userMode', 'user');
    localStorage.setItem('userAuthenticated', 'true');
    localStorage.setItem('userID', userId);
    
    // Dispatch basket auth state change event
    this.dispatchBasketUpdate();
  }

  switchToGuestBasket() {
    console.log('Basket Auth Manager: Switching to guest basket');
    
    // Set guest mode
    localStorage.setItem('userMode', 'guest');
    localStorage.setItem('userAuthenticated', 'false');
    localStorage.removeItem('userID');
    localStorage.removeItem('userEmail');
    
    // Dispatch basket auth state change event
    this.dispatchBasketUpdate();
  }

  dispatchBasketUpdate() {
    const userMode = localStorage.getItem('userMode');
    const isAuthenticated = localStorage.getItem('userAuthenticated') === 'true';
    const currentUserID = localStorage.getItem('userID');
    
    console.log('Basket Auth Manager: Dispatching basket update', {
      userMode: userMode,
      isAuthenticated: isAuthenticated,
      currentUserID: currentUserID
    });
    
    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent('basketAuthStateChanged', {
      detail: {
        user: this.currentUser,
        isLoggedIn: !!this.currentUser,
        userMode: userMode,
        isAuthenticated: isAuthenticated,
        currentUserID: currentUserID
      }
    }));
  }

  // Get current basket (compatibility method for other files)
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

  // Get current basket count (compatibility method)
  getCurrentBasketCount() {
    const basket = this.getCurrentBasket();
    return basket.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }

  // Public API methods
  isLoggedIn() {
    return !!this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getUserMode() {
    return localStorage.getItem('userMode');
  }

  isAuthenticated() {
    return localStorage.getItem('userAuthenticated') === 'true';
  }
}

// Create global instance
window.BasketAuthManager = new BasketAuthManager();

// Export for module usage
export default window.BasketAuthManager; 