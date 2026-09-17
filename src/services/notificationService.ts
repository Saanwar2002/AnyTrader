import { auth } from "../firebase";

export async function distributeJobNotifications(
  jobId: string,
  category: string,
  postcode: string,
  urgency: string,
  isBoosted: boolean
) {
  try {
    const currentUser = auth.currentUser;
    const token = currentUser ? await currentUser.getIdToken().catch(() => null) : null;

    if (!token) {
      console.warn("[distributeJobNotifications] No authenticated user token available.");
      return;
    }

    const res = await fetch(`/api/jobs/${jobId}/distribute-leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        category,
        postcode,
        urgency,
        isBoosted
      })
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    } else {
      const err = await res.json().catch(() => ({}));
      console.warn("[distributeJobNotifications] Server returned error:", err);
    }
  } catch (err) {
    console.error("Error distributing notifications via server API:", err);
  }
}

