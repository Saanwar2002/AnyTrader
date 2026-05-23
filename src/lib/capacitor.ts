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
  const androidKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY_ANDROID;
  const webKey = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY;

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

  // If we are running inside native Capacitor, check and prefer the Android/Native API key first,
  // since the Web API key is usually restricted to web referrers which would fail inside WebViews.
  if (Capacitor.isNativePlatform() && isValid(androidKey)) {
    return androidKey.trim();
  }

  if (isValid(webKey)) {
    return webKey.trim();
  }
  if (isValid(androidKey)) {
    return androidKey.trim();
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

import { TextToSpeech } from '@capacitor-community/text-to-speech';

export const speakText = async (text: string, volume: number = 1.0) => {
  if (volume <= 0 || !text) return;

  if (isCapacitor()) {
    try {
      await TextToSpeech.speak({
        text: text,
        lang: 'en-GB',
        rate: 1.0,
        pitch: 1.0,
        volume: volume,
        category: 'ambient',
      });
    } catch (e) {
      console.warn('Capacitor TTS failed', e);
    }
  } else if ("speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-GB";
      utterance.rate = 1.0;
      utterance.volume = volume;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Web TTS failed', e);
    }
  }
};
