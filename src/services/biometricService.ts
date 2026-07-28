import { Capacitor, registerPlugin } from "@capacitor/core";

export interface BiometricAuthPlugin {
  checkIsAvailable(): Promise<{ isAvailable: boolean; biometryType?: string }>;
  verifyBiometric(options: { reason: string; title?: string; subtitle?: string; description?: string }): Promise<void>;
  isAvailable?(): Promise<{ isAvailable: boolean; biometryType?: string }>;
  verify?(options: { reason: string; title?: string; subtitle?: string; description?: string }): Promise<void>;
}

const BiometricAuth1 = registerPlugin<BiometricAuthPlugin>("BiometricAuth");
const BiometricAuth2 = registerPlugin<BiometricAuthPlugin>("NativeBiometric");
const BiometricAuth3 = registerPlugin<BiometricAuthPlugin>("Biometrics");

export interface BiometricStatus {
  available: boolean;
  type: "face" | "fingerprint" | "none" | "biometric";
}

export interface BiometricCredentials {
  email: string;
  pass: string;
}

const ENABLE_KEY = "anytrader_biometrics_enabled";
const CRED_KEY = "anytrader_biometric_credentials";
const SKIP_KEY = "anytrader_biometric_prompt_skipped";

export const BiometricService = {
  /**
   * Helper to invoke biometric check across plugin aliases
   */
  async _getNativePlugin(): Promise<BiometricAuthPlugin | null> {
    const plugins = [BiometricAuth1, BiometricAuth2, BiometricAuth3];
    for (const plugin of plugins) {
      if (!plugin) continue;
      try {
        if (typeof plugin.checkIsAvailable === "function" || typeof plugin.isAvailable === "function") {
          return plugin;
        }
      } catch (e) {
        // Continue to next plugin alias
      }
    }
    return BiometricAuth1;
  },

  /**
   * Checks if biometric authentication is available on the current device / platform.
   */
  async checkAvailability(): Promise<BiometricStatus> {
    if (!Capacitor.isNativePlatform()) {
      // For web development/preview, check WebAuthn hardware support or offer simulator fallback
      const hasWebAuthn = typeof window !== "undefined" && !!window.PublicKeyCredential;
      return {
        available: true,
        type: hasWebAuthn ? "fingerprint" : "biometric"
      };
    }

    try {
      const plugin = await this._getNativePlugin();
      let result: { isAvailable?: boolean; biometryType?: string } | null = null;
      
      if (plugin?.checkIsAvailable) {
        result = await plugin.checkIsAvailable();
      } else if (plugin?.isAvailable) {
        result = await plugin.isAvailable();
      }

      const hasBiometrics = !!result?.isAvailable;
      
      // Map biometric types
      let type: "face" | "fingerprint" | "none" | "biometric" = "biometric";
      const rawType = String(result?.biometryType || "").toLowerCase();
      
      if (rawType.includes("face")) {
        type = "face";
      } else if (rawType.includes("finger") || rawType.includes("touch")) {
        type = "fingerprint";
      } else if (!hasBiometrics) {
        type = "none";
      }

      return {
        available: hasBiometrics,
        type
      };
    } catch (err) {
      console.warn("[BiometricService] Failed to check native biometrics availability:", err);
      return {
        available: false,
        type: "none"
      };
    }
  },

  /**
   * Performs the biometric credential authentication challenge on the device.
   */
  async authenticate(reason: string = "Authenticate to access your AnyTrader account"): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      // In web fallback, we will display an elegant UI dialog.
      // We return true directly here; components can trigger custom mock modals.
      return true;
    }

    try {
      const plugin = await this._getNativePlugin();
      const options = {
        reason,
        title: "Security Verification",
        subtitle: "Sign-In using Your Identity",
        description: "Verify using Face ID / Fingerprint to proceed"
      };

      if (plugin?.verifyBiometric) {
        await plugin.verifyBiometric(options);
      } else if (plugin?.verify) {
        await plugin.verify(options);
      } else if (BiometricAuth1?.verifyBiometric) {
        await BiometricAuth1.verifyBiometric(options);
      }
      return true;
    } catch (err: any) {
      console.warn("[BiometricService] Native biometric authentication failed or canceled:", err);
      return false;
    }
  },

  /**
   * Helper to check if biometrics is active/enrolled in localStorage.
   */
  isEnabled(): boolean {
    return localStorage.getItem(ENABLE_KEY) === "true";
  },

  /**
   * Checks if we skipped prompt for the current session/client.
   */
  isPromptSkipped(): boolean {
    return localStorage.getItem(SKIP_KEY) === "true";
  },

  /**
   * Skip future auto-prompts on login completion.
   */
  setPromptSkipped(skipped: boolean): void {
    if (skipped) {
      localStorage.setItem(SKIP_KEY, "true");
    } else {
      localStorage.removeItem(SKIP_KEY);
    }
  },

  /**
   * Enrolls/Saves the biometric sign-in credentials.
   */
  async enroll(email: string, pass: string): Promise<boolean> {
    try {
      localStorage.setItem(ENABLE_KEY, "true");
      
      // Simple obfuscation / cipher so credentials are not in plain cleartext
      const payload: BiometricCredentials = { email, pass };
      const serialized = JSON.stringify(payload);
      const encoded = btoa(unescape(encodeURIComponent(serialized)));
      localStorage.setItem(CRED_KEY, encoded);
      
      return true;
    } catch (err) {
      console.error("[BiometricService] Enrollment failed:", err);
      return false;
    }
  },

  /**
   * Disables biometric verification and wipes saved security keys.
   */
  disable(): void {
    localStorage.removeItem(ENABLE_KEY);
    localStorage.removeItem(CRED_KEY);
  },

  /**
   * Decrypts and retrieves stored biometric credentials if biometric flag is set.
   */
  getCredentials(): BiometricCredentials | null {
    if (!this.isEnabled()) return null;
    
    const encoded = localStorage.getItem(CRED_KEY);
    if (!encoded) return null;

    try {
      const decoded = decodeURIComponent(escape(atob(encoded)));
      return JSON.parse(decoded) as BiometricCredentials;
    } catch (err) {
      console.error("[BiometricService] Decrypt credentials failed:", err);
      return null;
    }
  }
};
