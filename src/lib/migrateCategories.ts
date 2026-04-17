import { db, collection, getDocs, setDoc, doc, deleteDoc } from "@/src/firebase";
import { TRADE_CATEGORIES } from "@/src/constants";

export const migrateCategories = async () => {
  const categoriesRef = collection(db, "platform_categories");
  
  console.log("Starting category migration/update...");
  
  // 1. Get all current categories from Firestore
  const snapshot = await getDocs(categoriesRef);
  const existingDocIds = snapshot.docs.map(doc => doc.id);
  
  // 2. Determine which categories to keep/update
  const newSafeNames = TRADE_CATEGORIES.map(cat => cat.name.replace(/\s*\/\s*/g, '-'));
  
  // 3. Delete categories that are no longer in the constants
  for (const docId of existingDocIds) {
    if (!newSafeNames.includes(docId)) {
      console.log(`Deleting obsolete category: ${docId}`);
      await deleteDoc(doc(db, "platform_categories", docId));
    }
  }

  // 4. Upsert current categories
  for (const cat of TRADE_CATEGORIES) {
    const safeName = cat.name.replace(/\s*\/\s*/g, '-');
    await setDoc(doc(db, "platform_categories", safeName), { 
      ...cat, 
      originalName: cat.name,
      name: safeName 
    });
  }
  console.log("Migration/update complete.");
  return true;
};
