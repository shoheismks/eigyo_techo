import { useMemo, useState } from 'react';

const STORAGE_KEY = 'eigyo-techo-products';

const defaultProduct = {
  name: '',
  category: '',
  description: '',
  cost: '',
  sellingPrice: '',
  grossMarginRate: '',
  memo: '',
};

function normalizeProduct(product) {
  return {
    ...defaultProduct,
    ...product,
    id: product.id ?? crypto.randomUUID(),
    createdAt: product.createdAt ?? new Date().toISOString(),
    updatedAt: product.updatedAt ?? new Date().toISOString(),
  };
}

function readLocalProducts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).map(normalizeProduct) : [];
  } catch {
    return [];
  }
}

function saveLocalProducts(products) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
}

export function useProducts() {
  const [products, setProducts] = useState(readLocalProducts);

  const sortedProducts = useMemo(
    () =>
      [...products].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [products],
  );

  function addProduct(product) {
    setProducts((current) => {
      const nextProducts = [
        normalizeProduct({
          ...product,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }),
        ...current,
      ];
      saveLocalProducts(nextProducts);
      return nextProducts;
    });
  }

  function updateProduct(id, updates) {
    setProducts((current) => {
      const nextProducts = current.map((product) =>
        product.id === id
          ? normalizeProduct({ ...product, ...updates, updatedAt: new Date().toISOString() })
          : product,
      );
      saveLocalProducts(nextProducts);
      return nextProducts;
    });
  }

  function removeProduct(id) {
    setProducts((current) => {
      const nextProducts = current.filter((product) => product.id !== id);
      saveLocalProducts(nextProducts);
      return nextProducts;
    });
  }

  return {
    products: sortedProducts,
    addProduct,
    updateProduct,
    removeProduct,
  };
}
