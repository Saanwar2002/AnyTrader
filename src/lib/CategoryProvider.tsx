import React, { createContext, useContext, useEffect, useState } from "react";
import { db, collection, onSnapshot } from "@/src/firebase";

interface Category {
  id: number;
  name: string;
  icon: string;
  subcategories: string[];
  requiredCertifications?: string[];
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
}

const CategoryContext = createContext<CategoryContextType>({
  categories: [],
  loading: true,
});

export const useCategories = () => useContext(CategoryContext);

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "platform_categories"), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const cat = doc.data() as any;
        return { 
          ...cat, 
          docId: doc.id,
          name: cat.originalName || cat.name.replace(/-/g, ' / ') 
        };
      });
      
      // Deduplicate by ID to prevent React key errors if stale data exists in Firestore
      const uniqueData = Array.from(new Map(data.map(item => [item.id, item])).values());
      
      setCategories(uniqueData.sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return (
    <CategoryContext.Provider value={{ categories, loading }}>
      {children}
    </CategoryContext.Provider>
  );
};
