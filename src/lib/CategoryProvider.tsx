import React, { createContext, useContext, useEffect, useState } from "react";
import { db, collection, onSnapshot } from "@/src/firebase";
import { UNSORTED_TRADE_CATEGORIES } from "@/src/constants";
import { categoryRegistry } from "@/src/services/categoryRegistrySync";
import { syncCategoryRegistryWithServer } from "@/src/services/gemini";
import { getCategoryMetadata } from "@/src/lib/fuzzyMatch";

export interface Category {
  id: number;
  name: string;
  icon: string;
  subcategories: string[];
  requiredCertifications?: string[];
  synonyms?: string[];
  related_terms?: string[];
  relatedTerms?: string[];
  docId?: string;
  description?: string;
}

interface CategoryContextType {
  categories: Category[];
  loading: boolean;
  getCategoryMetadataByName: (categoryName: string) => { synonyms: string[]; related_terms: string[] };
}

const CategoryContext = createContext<CategoryContextType>({
  categories: [],
  loading: true,
  getCategoryMetadataByName: () => ({ synonyms: [], related_terms: [] }),
});

export const useCategories = () => useContext(CategoryContext);

export const CategoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "platform_categories"), (snapshot: any) => {
      if (snapshot.empty) {
        const baseline = [...UNSORTED_TRADE_CATEGORIES].map((cat: any) => {
          const meta = getCategoryMetadata(cat.name);
          const syns = Array.from(new Set([...(cat.synonyms || []), ...meta.synonyms]));
          const rels = Array.from(new Set([...(cat.related_terms || []), ...(cat.relatedTerms || []), ...meta.related_terms]));
          return {
            ...cat,
            synonyms: syns,
            related_terms: rels,
            relatedTerms: rels
          } as Category;
        }).sort((a, b) => a.name.localeCompare(b.name));

        setCategories(baseline);
        categoryRegistry.syncCategories(baseline);
        syncCategoryRegistryWithServer(baseline);
        setLoading(false);
        return;
      }
      
      const data = snapshot.docs.map((doc: any) => {
        const cat = doc.data() as any;
        const catName = cat.originalName || cat.name.replace(/-/g, ' / ');
        const meta = getCategoryMetadata(catName);
        const syns = Array.from(new Set([...(cat.synonyms || []), ...meta.synonyms]));
        const rels = Array.from(new Set([...(cat.related_terms || []), ...(cat.relatedTerms || []), ...meta.related_terms]));
        return { 
          ...cat, 
          docId: doc.id,
          name: catName,
          synonyms: syns,
          related_terms: rels,
          relatedTerms: rels
        };
      });
      
      // Combine hardcoded baseline categories with Firestore-stored categories
      const combinedMap = new Map<string, any>();
      UNSORTED_TRADE_CATEGORIES.forEach((cat: any) => {
        const meta = getCategoryMetadata(cat.name);
        const syns = Array.from(new Set([...(cat.synonyms || []), ...meta.synonyms]));
        const rels = Array.from(new Set([...(cat.related_terms || []), ...(cat.relatedTerms || []), ...meta.related_terms]));
        combinedMap.set(cat.name.toLowerCase(), { 
          ...cat,
          synonyms: syns,
          related_terms: rels,
          relatedTerms: rels
        });
      });
      data.forEach((item: any) => {
        if (item.name) {
          const key = item.name.toLowerCase();
          const existing = combinedMap.get(key) || {};
          const mergedSynonyms = Array.from(new Set([...(existing.synonyms || []), ...(item.synonyms || [])]));
          const mergedRelated = Array.from(new Set([...(existing.related_terms || []), ...(item.related_terms || []), ...(item.relatedTerms || [])]));
          combinedMap.set(key, { 
            ...existing, 
            ...item,
            synonyms: mergedSynonyms,
            related_terms: mergedRelated,
            relatedTerms: mergedRelated
          });
        }
      });
      
      const uniqueData = Array.from(combinedMap.values());
      const sortedData = (uniqueData as Category[]).sort((a: Category, b: Category) => a.name.localeCompare(b.name));
      
      setCategories(sortedData);
      categoryRegistry.syncCategories(sortedData);
      syncCategoryRegistryWithServer(sortedData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const getCategoryMetadataByName = (categoryName: string) => {
    const found = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (found) {
      return {
        synonyms: found.synonyms || [],
        related_terms: found.related_terms || found.relatedTerms || []
      };
    }
    return getCategoryMetadata(categoryName);
  };

  return (
    <CategoryContext.Provider value={{ categories, loading, getCategoryMetadataByName }}>
      {children}
    </CategoryContext.Provider>
  );
};
