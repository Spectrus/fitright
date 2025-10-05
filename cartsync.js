// cartSync.js
// ——————————————————————————————————————————————————————————————

// 1) Imports
import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

let localCart = [];

// 2) When user signs in, load their cart in real-time
onAuthStateChanged(auth, user => {
  if (!user) return;
  const cartRef = doc(db, 'users', user.uid, 'cart', 'current');
  onSnapshot(cartRef, snap => {
    localCart = snap.data()?.items || [];
    renderCart(localCart);
  });
});

// 3) Helper to push your changes back to Firestore
async function saveCart() {
  const cartRef = doc(db, 'users', auth.currentUser.uid, 'cart', 'current');
  await setDoc(cartRef, {
    items: localCart,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// 4) Exposed functions to call from your buttons
export function addToCart(item) {
  const existing = localCart.find(i => i.sku === item.sku);
  if (existing) {
    existing.qty++;
  } else {
    localCart.push({ ...item, qty: 1 });
  }
  renderCart(localCart);
  saveCart();
}

export function removeFromCart(sku) {
  localCart = localCart.filter(i => i.sku !== sku);
  renderCart(localCart);
  saveCart();
}

// 5) Example render function — adapt to your HTML structure
export function renderCart(items) {
  const container = document.getElementById('cartContainer');
  if (!container) return;
  container.innerHTML = items.map(i =>
    `<div class="cart-item">
       ${i.sku} × ${i.qty}
       <button onclick="removeFromCart('${i.sku}')">×</button>
     </div>`
  ).join('');
}
