'use client';

import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { useState, useEffect } from 'react';
import { auth, getShopByOwnerIdFromCloud, createShopInCloud } from './firebase';
import { Shop } from '@/types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userShop = await getShopByOwnerIdFromCloud(currentUser.uid);
        setShop(userShop);
      } else {
        setShop(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, shop, setShop, loading };
}

export async function loginUser(email: string, pass: string) {
  return signInWithEmailAndPassword(auth, email, pass);
}

export async function registerUserAndShop(
  email: string, 
  pass: string, 
  shopInfo: {
    name: string;
    ownerName: string;
    phone: string;
    upiId: string;
    address: string;
    printerBrand?: string;
  }
) {
  const cred = await createUserWithEmailAndPassword(auth, email, pass);
  const slug = shopInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'my-shop';

  const newShop = await createShopInCloud({
    ownerId: cred.user.uid,
    email,
    name: shopInfo.name,
    slug,
    ownerName: shopInfo.ownerName,
    phone: shopInfo.phone,
    upiId: shopInfo.upiId,
    address: shopInfo.address,
    autoPrintOnUpi: true,
    pricing: {
      bwSinglePaise: 200,
      bwDoublePaise: 300,
      colorSinglePaise: 1000,
      colorDoublePaise: 1800,
      paperSizeMultipliers: {
        A4: 1.0,
        A3: 2.0,
        A5: 0.75,
        LEGAL: 1.25,
        LETTER: 1.0,
        PHOTO_4X6: 2.5,
        B5: 1.0
      },
      bindingRatesPaise: { spiral: 3000, soft: 5000, lamination: 2000 }
    },
    activePrinters: [] // Real empty state until Windows Agent detects hardware or owner adds manually
  });

  return { user: cred.user, shop: newShop };
}

export async function logoutUser() {
  return signOut(auth);
}
