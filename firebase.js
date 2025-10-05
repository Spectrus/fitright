// firebase.js

// 1) Import the Firebase functions you'll use (from the CDN, v11.4.0):
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// 👉 New: Cloud Functions SDK
import {
  getFunctions,
  httpsCallable
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-functions.js";

// 2) Your web app's Firebase configuration (from the console)
const firebaseConfig = {
  apiKey: "AIzaSyAKTXJib8ODPEfPeVokjuDRTQ8QhvLdnp0",
  authDomain: "mark-1-3a013.firebaseapp.com",
  projectId: "mark-1-3a013",
  storageBucket: "mark-1-3a013.appspot.com",
  messagingSenderId: "744206606605",
  appId: "1:744206606605:web:5753beddbfcc4bcaf8d044",
  measurementId: "G-FCLTX0NB85"
};

// 3) Initialize Firebase
const app = initializeApp(firebaseConfig);

// 4) Create references for Auth, Firestore, and Functions
const auth = getAuth(app);
const db = getFirestore(app);
// Initialize Functions in your deployed region
const functions = getFunctions(app, "europe-west3");

// 👉 New: References to backend Cloud Functions
// Wrap createOrder to always return the data payload
async function createOrder(payload) {
  const call = httpsCallable(functions, "createOrder");
  const result = await call(payload);
  return result.data;
}
const updateStatus = httpsCallable(functions, "updateStatus");

// 5) Set auth persistence for "stay signed in" behavior
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Auth persistence set to browser local");
  })
  .catch((error) => {
    console.warn("Could not set auth persistence:", error);
  });

// 6) Log a confirmation to the console
console.log("Firebase initialized:", app.name);

// 7) Helper function for password reset
async function resetUserPassword(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log("Password reset email sent to:", email);
  } catch (error) {
    console.error("Error sending password reset email:", error.message);
  }
}

// 8) Export all necessary functions and objects
export {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  resetUserPassword,
  updateProfile,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch,
  setPersistence,
  browserLocalPersistence,
  // 👉 New Cloud Functions exports
  functions,
  createOrder,
  updateStatus,
  signInAnonymously
};

// Debug: Log what we're exporting
console.log("Firebase.js exports:", {
  auth,
  db,
  functions,
  createOrder,
  updateStatus
});

// 👉 Orders utilities: realtime subscription and listing
/**
 * Subscribe to orders collection.
 * @param {(orders: any[]) => void} callback
 * @param {{ limitCount?: number, customerId?: string }} [options]
 * @returns {() => void} unsubscribe
 */
export function onOrdersSnapshot(callback, options = {}) {
  try {
    const ordersCol = collection(db, "orders");
    const constraints = [];
    if (options && options.customerId) constraints.push(where("customerId", "==", options.customerId));
    constraints.push(orderBy("createdAt", "desc"));
    if (options && options.limitCount) constraints.push(limit(options.limitCount));
    const qRef = query(ordersCol, ...constraints);
    return onSnapshot(qRef, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      try { callback(rows); } catch (e) { console.error("onOrdersSnapshot callback error:", e); }
    });
  } catch (e) {
    console.error("onOrdersSnapshot failed:", e);
    return () => {};
  }
}

/**
 * List recent orders (default 100).
 * @param {number} limitCount
 * @param {{ customerId?: string }} [options]
 */
export async function listOrders(limitCount = 100, options = {}) {
  try {
    const ordersCol = collection(db, "orders");
    const constraints = [];
    if (options && options.customerId) constraints.push(where("customerId", "==", options.customerId));
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(limitCount));
    const qRef = query(ordersCol, ...constraints);
    const snap = await getDocs(qRef);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("listOrders failed:", e);
    return [];
  }
}

// Expose a lightweight API on window for pages that consume global hooks
try {
  if (typeof window !== "undefined") {
    window.FitRightFirebase = window.FitRightFirebase || {};
    Object.assign(window.FitRightFirebase, {
      auth,
      onAuthStateChanged,
      signInAnonymously,
      onOrdersSnapshot,
      listOrders,
      getOrders: listOrders
    });
  }
} catch {}
