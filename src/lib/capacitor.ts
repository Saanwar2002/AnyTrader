import { Haptics, ImpactStyle } from '@capacitor/haptics';
export { ImpactStyle };
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const isCapacitor = () => {
  return Capacitor.isNativePlatform();
};

export const getGoogleMapsApiKey = (): string => {
  const env = (import.meta as any).env;
  const androidKey = env.VITE_GOOGLE_MAPS_API_KEY_ANDROID;
  const webKey = env.VITE_GOOGLE_MAPS_API_KEY;

  const isValid = (key?: string) => {
    if (!key) return false;
    const clean = key.trim();
    return (
      clean !== "" &&
      clean !== "your_google_maps_android_key" &&
      clean !== "your_google_maps_key" &&
      !clean.startsWith("your_") &&
      !clean.includes("placeholder")
    );
  };

  if (Capacitor.isNativePlatform() && isValid(androidKey)) {
    return androidKey!.trim();
  }
  if (isValid(webKey)) {
    return webKey!.trim();
  }
  return "";
};

export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
  if (isCapacitor()) {
    try {
      await Haptics.impact({ style });
    } catch (e) {
      console.warn('Haptics failed', e);
    }
  }
};

export const setNativeStatusBar = async (isDark: boolean) => {
  if (isCapacitor()) {
    try {
      await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    } catch (e) {
       // Ignore
    }
  }
};

export const hideNativeKeyboard = async () => {
  if (isCapacitor()) {
    try {
      await Keyboard.hide();
    } catch (e) {
       // Ignore
    }
  }
};
