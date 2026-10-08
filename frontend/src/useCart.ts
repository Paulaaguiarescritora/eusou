import { useState, useEffect } from 'react';
import { CartItem } from './types';

const CART_KEY = 'eusou_cart_items';

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save cart to localStorage', e);
    }
  }, [items]);

  const addItem = (item: CartItem) => {
    setItems((prev) => {
      const index = prev.findIndex(
        (i) => i.productId === item.productId && i.variantId === item.variantId,
      );
      if (index >= 0) {
        const next = [...prev];
        next[index] = {
          ...next[index],
          quantity: next[index].quantity + item.quantity,
        };
        return next;
      }
      return [...prev, item];
    });
  };

  const updateQuantity = (productId: string, variantId: string | null | undefined, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.productId === productId && i.variantId === variantId
          ? { ...i, quantity }
          : i,
      ),
    );
  };

  const removeItem = (productId: string, variantId: string | null | undefined) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.productId === productId && i.variantId === variantId),
      ),
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  return {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    totalItems,
    subtotal,
  };
}
