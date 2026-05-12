import { useState, useEffect } from 'react';

type BusinessTab = "properties" | "field_services" | "consultancy";

let currentTab: BusinessTab = "properties";
const listeners = new Set<(tab: BusinessTab) => void>();

export const getBusinessTab = () => currentTab;

export const setBusinessTab = (tab: BusinessTab) => {
  currentTab = tab;
  listeners.forEach(listener => listener(tab));
};

export const useBusinessTab = () => {
  const [tab, setTab] = useState<BusinessTab>(currentTab);

  useEffect(() => {
    const handleTabChange = (newTab: BusinessTab) => setTab(newTab);
    listeners.add(handleTabChange);
    return () => {
      listeners.delete(handleTabChange);
    };
  }, []);

  return { activeTab: tab, setActiveTab: setBusinessTab };
};
