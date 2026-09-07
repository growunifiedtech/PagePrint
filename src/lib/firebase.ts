import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, 
  query, where, orderBy, getDocs, getDoc, limit, serverTimestamp 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { Order, Shop } from '@/types';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDZsw6IvuK-Jkk9rhs0oYnu5-IYdgBeB9c",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "pageprint-a9b08.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "pageprint-a9b08",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "pageprint-a9b08.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "480032925417",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:480032925417:web:143bf8a29ef84522f07278",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-Y16MQYH2QV"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// -------------------------------------------------------------
// REAL CLOUD FIRESTORE FUNCTIONS
// -------------------------------------------------------------

/**
 * Fetch a shop from Firestore by its unique slug (e.g. "krishna-xerox")
 */
export async function getShopBySlugFromCloud(slug: string): Promise<Shop | null> {
  try {
    const q = query(collection(db, 'shops'), where('slug', '==', slug), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Shop;
    }
    return null;
  } catch (error) {
    console.error('Error fetching shop by slug:', error);
    return null;
  }
}

/**
 * Fetch shop owned by a specific Firebase Auth user UID
 */
export async function getShopByOwnerIdFromCloud(ownerId: string): Promise<Shop | null> {
  try {
    const q = query(collection(db, 'shops'), where('ownerId', '==', ownerId), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docSnap = querySnapshot.docs[0];
      return { id: docSnap.id, ...docSnap.data() } as Shop;
    }
    return null;
  } catch (error) {
    console.error('Error fetching shop by owner ID:', error);
    return null;
  }
}

/**
 * Create a new real shop in Firestore
 */
export async function createShopInCloud(shopData: Omit<Shop, 'id' | 'createdAt'> & { ownerId: string; createdAt?: string }): Promise<Shop> {
  const shopRef = doc(collection(db, 'shops'));
  const newShop: Shop = {
    id: shopRef.id,
    ...shopData,
    createdAt: shopData.createdAt || new Date().toISOString()
  };
  await setDoc(shopRef, newShop);
  return newShop;
}

/**
 * Update an existing shop in Firestore
 */
export async function updateShopInCloud(shopId: string, updates: Partial<Shop>): Promise<void> {
  const shopRef = doc(db, 'shops', shopId);
  await updateDoc(shopRef, updates);
}

function removeUndefined<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Create a new real customer order in Firestore
 */
export async function createOrderInCloud(orderData: Omit<Order, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string; updatedAt?: string }): Promise<Order> {
  const orderRef = orderData.id ? doc(db, 'orders', orderData.id) : doc(collection(db, 'orders'));
  const newOrder: Order = {
    id: orderRef.id,
    ...orderData,
    createdAt: orderData.createdAt || new Date().toISOString(),
    updatedAt: orderData.updatedAt || new Date().toISOString()
  };
  const cleanData = removeUndefined(newOrder);
  await setDoc(orderRef, cleanData);
  return newOrder;
}

/**
 * Update order status (e.g. PRINTED, PAID) in Firestore
 */
export async function updateOrderStatusInCloud(orderId: string, updates: Partial<Order>): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  const cleanUpdates = removeUndefined(updates);
  await updateDoc(orderRef, {
    ...cleanUpdates,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Sync or upsert an order to Cloud Firestore
 */
export async function syncOrderToCloud(order: Order): Promise<void> {
  try {
    const orderRef = doc(db, 'orders', order.id);
    const cleanData = removeUndefined(order);
    await setDoc(orderRef, { ...cleanData, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.error('Error syncing order to cloud:', error);
  }
}

/**
 * Delete an order from Cloud Firestore (for shopkeeper reject / cancel)
 */
export async function deleteOrderFromCloud(orderId: string): Promise<void> {
  try {
    const orderRef = doc(db, 'orders', orderId);
    await deleteDoc(orderRef);
  } catch (error) {
    console.error('Error deleting order from cloud:', error);
  }
}

/**
 * Alias for updateOrderStatusInCloud
 */
export const updateCloudOrderStatus = updateOrderStatusInCloud;

/**
 * Real-time listener for all orders belonging to a shop
 */
export function subscribeToShopOrdersRealtime(shopId: string, onUpdate: (orders: Order[]) => void) {
  // Query by shopId without requiring a Firebase composite index
  const q = query(
    collection(db, 'orders'),
    where('shopId', '==', shopId)
  );

  return onSnapshot(q, (snapshot) => {
    const orders: Order[] = [];
    snapshot.forEach((docSnap) => {
      orders.push({ id: docSnap.id, ...docSnap.data() } as Order);
    });
    // Sort in memory (newest first) so it works instantly with zero Firestore index errors
    orders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    onUpdate(orders);
  }, (err) => {
    console.error('Realtime orders listener error:', err);
  });
}

/**
 * Real-time listener for a single order by ID (for customer tracking token)
 */
export function subscribeToSingleOrderRealtime(orderId: string, onUpdate: (order: Order | null) => void) {
  const orderRef = doc(db, 'orders', orderId);
  return onSnapshot(orderRef, (docSnap) => {
    if (docSnap.exists()) {
      onUpdate({ id: docSnap.id, ...docSnap.data() } as Order);
    } else {
      onUpdate(null);
    }
  }, (err) => {
    console.error('Realtime single order listener error:', err);
  });
}

// -------------------------------------------------------------
// REAL FILE UPLOAD TO CLOUD STORAGE
// -------------------------------------------------------------

/**
 * Upload a document directly to Firebase Storage with progress tracking
 */
export function uploadDocumentToStorage(
  file: File, 
  shopId: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `shops/${shopId}/orders/${Date.now()}_${cleanFileName}`;
    const storageRef = ref(storage, storagePath);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(Math.round(progress));
      },
      (error) => {
        console.error('Upload to Firebase Storage failed:', error);
        reject(error);
      },
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadUrl);
      }
    );
  });
}
