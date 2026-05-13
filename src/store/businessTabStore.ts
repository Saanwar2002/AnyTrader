import { useState, useEffect } from 'react';

type BusinessTab = "properties" | "field_services" | "consultancy";
type BusinessSubTab = "work_hub" | "hire_b2b";

let currentTab: BusinessTab = "properties";
let currentSubTab: BusinessSubTab = "work_hub";

const listeners = new Set<(tab: BusinessTab, subTab: BusinessSubTab) => void>();

export const getBusinessTab = () => currentTab;
export const getBusinessSubTab = () => currentSubTab;

export const setBusinessTab = (tab: BusinessTab) => {
  currentTab = tab;
  listeners.forEach(listener => listener(tab, currentSubTab));
};

export const setBusinessSubTab = (subTab: BusinessSubTab) => {
  currentSubTab = subTab;
  listeners.forEach(listener => listener(currentTab, subTab));
};

export const useBusinessTab = () => {
  const [state, setState] = useState({ tab: currentTab, subTab: currentSubTab });

  useEffect(() => {
    const handleStateChange = (tab: BusinessTab, subTab: BusinessSubTab) => setState({ tab, subTab });
    listeners.add(handleStateChange);
    return () => {
      listeners.delete(handleStateChange);
    };
  }, []);

  return { 
    activeTab: state.tab, 
    setActiveTab: setBusinessTab,
    activeSubTab: state.subTab,
    setActiveSubTab: setBusinessSubTab
  };
};
