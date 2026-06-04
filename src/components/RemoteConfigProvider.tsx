import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  initRemoteConfig, 
  RemoteConfigValues, 
  REMOTE_CONFIG_DEFAULTS, 
  getSavedOverrides, 
  saveSimOverrides, 
  clearSimOverrides 
} from "../services/remoteConfigService";

interface RemoteConfigContextType {
  values: RemoteConfigValues;
  loading: boolean;
  refresh: () => Promise<void>;
  updateSimulationOverrides: (newOverrides: Partial<RemoteConfigValues>) => void;
  resetToDefaults: () => void;
  isOverridden: boolean;
}

const RemoteConfigContext = createContext<RemoteConfigContextType>({
  values: REMOTE_CONFIG_DEFAULTS,
  loading: true,
  refresh: async () => {},
  updateSimulationOverrides: () => {},
  resetToDefaults: () => {},
  isOverridden: false
});

export const useRemoteConfig = () => useContext(RemoteConfigContext);

export const RemoteConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [values, setValues] = useState<RemoteConfigValues>(REMOTE_CONFIG_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [isOverridden, setIsOverridden] = useState(false);

  const fetchAndLoadConfig = async () => {
    setLoading(true);
    try {
      const activeValues = await initRemoteConfig();
      setValues(activeValues);
      
      const savedOverrides = getSavedOverrides();
      setIsOverridden(Object.keys(savedOverrides).length > 0);
    } catch (err) {
      console.error("Failed to load Firebase Remote Config:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAndLoadConfig();
  }, []);

  const updateSimulationOverrides = (newOverrides: Partial<RemoteConfigValues>) => {
    const currentSaved = getSavedOverrides();
    const mergedSaved = { ...currentSaved, ...newOverrides };
    
    // Clean keys that match defaults to prevent unnecessary overrides
    Object.keys(mergedSaved).forEach((key) => {
      const k = key as keyof RemoteConfigValues;
      if (mergedSaved[k] === undefined) {
        delete mergedSaved[k];
      }
    });

    saveSimOverrides(mergedSaved);
    setIsOverridden(Object.keys(mergedSaved).length > 0);
    
    // Reload merged values immediately inside provider state
    setValues((prev) => ({
      ...prev,
      ...newOverrides
    }));
  };

  const resetToDefaults = () => {
    clearSimOverrides();
    setIsOverridden(false);
    fetchAndLoadConfig();
  };

  return (
    <RemoteConfigContext.Provider value={{
      values,
      loading,
      refresh: fetchAndLoadConfig,
      updateSimulationOverrides,
      resetToDefaults,
      isOverridden
    }}>
      {children}
    </RemoteConfigContext.Provider>
  );
};
