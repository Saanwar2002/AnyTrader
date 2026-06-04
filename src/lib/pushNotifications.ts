import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export async function registerForPushNotifications(userId: string) {
  if (!Capacitor.isNativePlatform()) {
    console.log("Push notifications are only available on native platforms.");
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn("User denied push notification permissions");
      return;
    }

    await PushNotifications.register();

    // Register listeners
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Save FCM token to the user's Firestore document
      try {
        await setDoc(doc(db, 'users', userId), {
          fcmToken: token.value,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log("FCM Token saved to user profile.");
      } catch (err) {
        console.error("Failed to save FCM token to Firestore:", err);
      }
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Error on push registration: ', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push action performed: ', notification);
    });

  } catch (error) {
    console.error("Failed to initialize push notifications:", error);
  }
}
