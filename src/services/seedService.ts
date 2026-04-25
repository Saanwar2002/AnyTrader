import { collection, doc, setDoc, serverTimestamp, db, handleFirestoreError, OperationType } from "../firebase";

export const seedMockTraders = async () => {
  const mockTraders = [
    {
      uid: "mock-trader-1",
      email: "jake.plumbing@example.com",
      name: "Jake M.",
      firstName: "Jake",
      lastName: "M.",
      role: "tradesperson",
      trades: ["Plumbing", "Heating", "Boilers"],
      services: ["Boiler Install", "Emergency Callout", "Pipe repair", "Gas Certs"],
      tierId: "Pro",
      subscriptionStatus: "active",
      verificationStatus: "verified",
      postcode: "SW1A 1AA",
      bio: "Qualified gas engineer with 8 years experience. Specialise in boiler installs, servicing & emergency repairs... Friendly, always clean up after myself.",
      rating: 4.8,
      totalReviews: 124,
      totalJobsDone: 247,
      trustScore: 96,
      responseRate: 98,
      isAcceptingRequests: true,
      isAvailableForEmergency: true,
      createdAt: serverTimestamp(),
      avatarUrl: "https://i.pravatar.cc/150?u=jake.plumbing",
      searchFeedBadges: ["pro_trader", "top_rated"],
    },
    {
      uid: "mock-trader-2",
      email: "sarah.electric@example.com",
      name: "Sarah T.",
      firstName: "Sarah",
      lastName: "T.",
      role: "tradesperson",
      trades: ["Electrician", "Smart Home"],
      services: ["Rewiring", "Smart Lighting", "Fuse Box", "EV Charger Install"],
      tierId: "Enterprise",
      subscriptionStatus: "active",
      verificationStatus: "verified",
      postcode: "E1 6SJ",
      bio: "NICEIC approved electrician. Specialize in full house rewires and smart home integrations (Hue, Nest, Ring). 10+ years of experience.",
      rating: 4.9,
      totalReviews: 89,
      totalJobsDone: 156,
      trustScore: 99,
      responseRate: 100,
      isAcceptingRequests: true,
      isAvailableForEmergency: false,
      createdAt: serverTimestamp(),
      avatarUrl: "https://i.pravatar.cc/150?u=sarah.electric",
      searchFeedBadges: ["verified", "fast_reply"],
    },
    {
      uid: "mock-trader-3",
      email: "mike.builders@example.com",
      name: "Mike R.",
      firstName: "Mike",
      lastName: "R.",
      role: "tradesperson",
      trades: ["Builder", "Carpenter"],
      services: ["Extensions", "Loft Conversions", "Kitchen Fitting"],
      tierId: "Basic",
      subscriptionStatus: "active",
      verificationStatus: "unverified",
      postcode: "SE1 9SG",
      bio: "Honest and reliable builder with a small team. We do everything from small kitchen fits to full loft conversions.",
      rating: 4.5,
      totalReviews: 42,
      totalJobsDone: 68,
      trustScore: 85,
      responseRate: 75,
      isAcceptingRequests: true,
      isAvailableForEmergency: false,
      createdAt: serverTimestamp(),
      avatarUrl: "https://i.pravatar.cc/150?u=mike.builder",
      searchFeedBadges: [],
    }
  ];

  try {
    for (const trader of mockTraders) {
      await setDoc(doc(db, "users", trader.uid), trader);
    }
    console.log("Mock traders seeded successfully!");
    alert("3 Mock traders generated successfully!");
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, "users");
  }
};
