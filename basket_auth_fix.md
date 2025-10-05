---
noteId: "93a6acf0698b11f09a4425c01eb6b8f5"
tags: []

---

# Basket Authentication Fix

## Problem Summary

The basket system had a critical flaw where guest cart items would persist when users signed in, causing the first authenticated user to inherit guest items in their mini-cart. This happened because:

1. **Single localStorage key**: Both guest and authenticated users used the same `localStorage.basket` key
2. **No auth state handling**: The basket system didn't properly handle authentication state changes
3. **Delayed cart loading**: User carts were only loaded when navigating to checkout, not immediately on login

## Solution Overview

The fix implements a comprehensive basket authentication management system that:

1. **Resets localStorage.basket on login** - Immediately clears guest cart when user signs in
2. **Uses separate storage keys** - Guest carts under `guestBasket`, user carts under `basket_{uid}`
3. **Listens for auth changes globally** - Proper auth state change handling across all pages
4. **Provides shared basket management** - Consistent basket behavior across all pages

## New Files Created

### 1. `basket-auth-manager.js`
**Purpose**: Global basket management that handles authentication state changes

**Key Features**:
- Monitors Firebase auth state changes
- Saves guest cart to separate storage before login
- Loads user's Firestore cart to localStorage on login
- Restores guest cart on logout
- Dispatches events for UI updates

**Core Methods**:
```javascript
// Handle user sign in
async handleUserSignIn(user, previousUser) {
  // 1. Save guest cart to separate storage
  // 2. Clear main basket localStorage
  // 3. Load user's Firestore cart
  // 4. Update all basket UIs
}

// Handle user sign out  
async handleUserSignOut(previousUser) {
  // 1. Clear user-specific basket
  // 2. Restore guest basket
  // 3. Update all basket UIs
}
```

### 2. `shared-basket-dropdown.js`
**Purpose**: Consistent basket dropdown functionality across all pages

**Key Features**:
- Works with BasketAuthManager for proper auth handling
- Handles both guest and authenticated users
- Consistent UI updates across all pages
- Proper event handling for basket changes

**Core Methods**:
```javascript
// Get current basket (guest or user)
getCurrentBasket() {
  if (window.BasketAuthManager) {
    return window.BasketAuthManager.getCurrentBasket();
  } else {
    return JSON.parse(localStorage.getItem('basket') || '[]');
  }
}

// Update basket UI
updateBasketDropdown() {
  const basket = this.getCurrentBasket();
  const count = basket.reduce((sum, item) => sum + (item.quantity || 1), 0);
  // Update counters and content
}
```

### 3. `test-basket-auth.html`
**Purpose**: Test page to verify the basket authentication system works correctly

**Features**:
- Real-time authentication status display
- Basket management testing
- Debug information panel
- Manual login/logout testing

## Implementation Details

### Authentication Flow

1. **Guest Mode**:
   - Items stored in `localStorage.basket`
   - Mini-cart shows guest items
   - No Firebase integration

2. **User Signs In**:
   - Guest cart saved to `localStorage.guestBasket`
   - `localStorage.basket` cleared
   - User's Firestore cart loaded to `localStorage.basket`
   - Mini-cart updates to show user's items

3. **User Signs Out**:
   - User-specific basket cleared
   - Guest cart restored from `localStorage.guestBasket`
   - Mini-cart updates to show guest items

### Storage Strategy

```javascript
// Guest mode
localStorage.basket = [guest items]

// User signs in
localStorage.guestBasket = [saved guest items]
localStorage.basket = [user's Firestore items]
localStorage.basket_{userId} = [user's Firestore items]

// User signs out
localStorage.basket = [restored guest items]
localStorage.guestBasket = [guest items]
```

### Event System

The system dispatches custom events for UI updates:

```javascript
// Auth state changes
window.dispatchEvent(new CustomEvent('basketAuthStateChanged', {
  detail: { user, isLoggedIn, basket }
}));

// Cart updates
window.dispatchEvent(new CustomEvent('cartUpdated', {
  detail: { items, count }
}));
```

## Updated Pages

### `index.html`
- Added BasketAuthManager and SharedBasketDropdown scripts
- Removed old basket dropdown logic
- Now uses shared basket management

### `page3.html`
- Added BasketAuthManager and SharedBasketDropdown scripts
- Removed old basket dropdown logic
- Maintains checkout-specific functionality

## Testing

Use `test-basket-auth.html` to verify:

1. **Guest Mode**: Add items as guest, verify they appear in basket
2. **Login**: Sign in, verify guest items are cleared and user's cart loads
3. **Logout**: Sign out, verify guest items are restored
4. **Multiple Users**: Test with different accounts to ensure no cross-contamination

## Benefits

1. **No More Guest Cart Leakage**: Guest items never persist into authenticated sessions
2. **Consistent Behavior**: All pages use the same basket management logic
3. **Proper Auth Handling**: Immediate cart updates on login/logout
4. **Better User Experience**: Users see their correct cart immediately
5. **Maintainable Code**: Centralized basket logic reduces duplication

## Migration Notes

- Existing pages will continue to work with the new system
- Old basket logic has been removed from updated pages
- New pages should include both `basket-auth-manager.js` and `shared-basket-dropdown.js`
- The system is backward compatible with existing localStorage.basket usage

## Future Enhancements

1. **Cart Merging**: Option to merge guest cart with user cart on login
2. **Persistent Guest Cart**: Save guest cart across browser sessions
3. **Multi-device Sync**: Real-time cart sync across devices for authenticated users
4. **Cart Analytics**: Track cart behavior for optimization 