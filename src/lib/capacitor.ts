import { Haptics, ImpactStyle } from '@capacitor/haptics';
export { ImpactStyle };
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { App } from '@capacitor/app';

export const isCapacitor = () => {
  return (window as any).Capacitor !== undefined;
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
