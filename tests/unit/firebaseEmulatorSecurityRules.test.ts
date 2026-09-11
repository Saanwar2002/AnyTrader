import { describe, it, beforeAll, afterAll, beforeEach, expect } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
} from "firebase/firestore";
import {
  ref,
  getBytes,
  uploadBytes,
  deleteObject,
} from "firebase/storage";
import * as fs from "fs";
import * as path from "path";

describe("Comprehensive Firebase Security Rules Regression Suite (Firestore & Storage)", () => {
  let testEnv: RulesTestEnvironment;
  const PROJECT_ID = "demo-anytrader";
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf-8");
  const storageRules = fs.readFileSync(path.resolve(process.cwd(), "storage.rules"), "utf-8");

  beforeAll(async () => {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: firestoreRules,
          host: "127.0.0.1",
          port: 8080,
        },
        storage: {
          rules: storageRules,
          host: "127.0.0.1",
          port: 9199,
        },
      });
    } catch (err) {
      console.error("FATAL ERROR: Failed to initialize Firebase emulator test environment!", err);
      throw err; // Fail the process
    }
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    if (!testEnv) {
      throw new Error("FATAL ERROR: Firebase testEnv not initialized!");
    }
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
  });

  // ==========================================
  // CATEGORY 1: FIRESTORE JOB SECURITY & PRIVACY
  // ==========================================
  describe("Category 1: Firestore Private Jobs Security & Privacy", () => {
    const seedPrivateJob = async (jobId: string, homeownerId: string, traderId?: string) => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "jobs", jobId), {
          id: jobId,
          homeownerId: homeownerId,
          userId: homeownerId,
          title: "Private Boiler Repair",
          description: "Secret Home details at 123 High Street",
          fullAddress: "123 High Street, London, SW1A 1AA",
          postcode: "SW1A 1AA",
          status: "open",
          acceptedTradespersonId: traderId || null,
          tradespersonId: traderId || null,
          payoutStatus: "pending",
          payoutTransferred: false,
          budget: 500,
        });
      });
    };

    it("1. Anonymous access to private Jobs fails", async () => {
      await seedPrivateJob("job_private_1", "user_alice");
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, "jobs", "job_private_1")));
    });

    it("2. Anonymous listing of private Jobs fails", async () => {
      await seedPrivateJob("job_private_1", "user_alice");
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDocs(collection(unauthDb, "jobs")));
    });

    it("3. User A cannot read User B's Job", async () => {
      await seedPrivateJob("job_private_b", "user_bob");
      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      await assertFails(getDoc(doc(userADb, "jobs", "job_private_b")));
    });

    it("4. User A cannot list User B's Jobs", async () => {
      await seedPrivateJob("job_private_b1", "user_bob");
      await seedPrivateJob("job_private_b2", "user_bob");
      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      const q = query(collection(userADb, "jobs"), where("homeownerId", "==", "user_bob"));
      await assertFails(getDocs(q));
    });

    it("5. Job owner can read their Job", async () => {
      await seedPrivateJob("job_private_a", "user_alice");
      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      await assertSucceeds(getDoc(doc(userADb, "jobs", "job_private_a")));
    });

    it("6. Authorized tradesperson can read assigned Job", async () => {
      await seedPrivateJob("job_assigned_trader", "user_alice", "trader_tom");
      const traderDb = testEnv.authenticatedContext("trader_tom").firestore();
      await assertSucceeds(getDoc(doc(traderDb, "jobs", "job_assigned_trader")));
    });

    it("7. Unauthorized tradesperson cannot read Job", async () => {
      await seedPrivateJob("job_assigned_trader", "user_alice", "trader_tom");
      const unauthTraderDb = testEnv.authenticatedContext("trader_eve").firestore();
      await assertFails(getDoc(doc(unauthTraderDb, "jobs", "job_assigned_trader")));
    });

    it("8. Admin access works on private jobs", async () => {
      await seedPrivateJob("job_private_a", "user_alice");
      const adminDb = testEnv.authenticatedContext("admin_user", { role: "admin", isAdmin: true }).firestore();
      await assertSucceeds(getDoc(doc(adminDb, "jobs", "job_private_a")));
      await assertSucceeds(getDocs(collection(adminDb, "jobs")));
    });

    it("9. Public job projection is readable anonymously", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "public_job_cards", "pub_card_1"), {
          id: "pub_card_1",
          title: "Public Plumbing Discovery",
          category: "Plumbing",
          postcodeArea: "SW1A",
          status: "open",
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(unauthDb, "public_job_cards", "pub_card_1")));
      await assertSucceeds(getDocs(collection(unauthDb, "public_job_cards")));
    });

    it("10. Public job projection cannot be written by ordinary clients", async () => {
      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      await assertFails(
        setDoc(doc(userADb, "public_job_cards", "pub_card_forged"), {
          id: "pub_card_forged",
          title: "Forged Public Card",
          category: "Plumbing",
          homeownerId: "user_alice", // Prohibited PII field in public cards
        })
      );
    });

    it("11. Unauthorized ownership changes fail", async () => {
      await seedPrivateJob("job_owner_test", "user_alice");
      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      // Client cannot mutate homeownerId / userId
      await assertFails(
        updateDoc(doc(userADb, "jobs", "job_owner_test"), {
          homeownerId: "user_attacker",
        })
      );
    });

    it("12. Unauthorized participant changes fail", async () => {
      await seedPrivateJob("job_participant_test", "user_alice", "trader_tom");
      const traderEveDb = testEnv.authenticatedContext("trader_eve").firestore();
      await assertFails(
        updateDoc(doc(traderEveDb, "jobs", "job_participant_test"), {
          acceptedTradespersonId: "trader_eve",
        })
      );
    });

    it("13. Financial field tampering fails", async () => {
      await seedPrivateJob("job_financial_test", "user_alice", "trader_tom");
      const traderTomDb = testEnv.authenticatedContext("trader_tom").firestore();
      // Trader attempting to modify price or budget
      await assertFails(
        updateDoc(doc(traderTomDb, "jobs", "job_financial_test"), {
          budget: 99999,
          amount: 99999,
        })
      );
    });

    it("14. Payout field tampering fails", async () => {
      await seedPrivateJob("job_payout_test", "user_alice", "trader_tom");
      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      const traderTomDb = testEnv.authenticatedContext("trader_tom").firestore();

      // Neither homeowner nor trader can mark payoutStatus as transferred
      await assertFails(
        updateDoc(doc(userADb, "jobs", "job_payout_test"), {
          payoutStatus: "transferred",
          payoutTransferred: true,
        })
      );
      await assertFails(
        updateDoc(doc(traderTomDb, "jobs", "job_payout_test"), {
          payoutStatus: "transferred",
          payoutTransferred: true,
        })
      );
    });

    it("15. Verification/trust field tampering fails", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "users", "user_alice"), {
          id: "user_alice",
          name: "Alice",
          role: "customer",
          verified: false,
          isAdmin: false,
        });
      });

      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      // User cannot escalate verification or admin status
      await assertFails(
        updateDoc(doc(userADb, "users", "user_alice"), {
          verified: true,
          isAdmin: true,
          role: "admin",
        })
      );
    });
  });

  // ==========================================
  // CATEGORY 2: FIRESTORE PROPERTY SECURITY
  // ==========================================
  describe("Category 2: Firestore Private Properties Security & Privacy", () => {
    const seedPrivateProperty = async (propertyId: string, ownerId: string, tenantEmail?: string) => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "properties", propertyId), {
          id: propertyId,
          ownerId: ownerId,
          userId: ownerId,
          name: "Private Manor",
          address: {
            line1: "42 Secret Lane",
            postcode: "NW1 4NP",
            city: "London",
          },
          tenantEmail: tenantEmail || null,
          componentRegistry: {
            stopcockLocation: "Behind kitchen kickboard",
            fuseboxLocation: "Basement under stairs",
          },
          insurancePolicy: "POL-999-SECRET",
        });
      });
    };

    it("16. Property private access works only for authorized users", async () => {
      await seedPrivateProperty("prop_auth_1", "user_alice");
      const ownerDb = testEnv.authenticatedContext("user_alice").firestore();
      await assertSucceeds(getDoc(doc(ownerDb, "properties", "prop_auth_1")));
    });

    it("17. Anonymous private Property access fails", async () => {
      await seedPrivateProperty("prop_anon_fail", "user_alice");
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(unauthDb, "properties", "prop_anon_fail")));
      await assertFails(getDocs(collection(unauthDb, "properties")));
    });

    it("18. Cross-user Property access fails", async () => {
      await seedPrivateProperty("prop_alice_secret", "user_alice");
      const attackerDb = testEnv.authenticatedContext("user_attacker").firestore();
      await assertFails(getDoc(doc(attackerDb, "properties", "prop_alice_secret")));
      const q = query(collection(attackerDb, "properties"), where("ownerId", "==", "user_alice"));
      await assertFails(getDocs(q));
    });

    it("19. Public Property projection is readable if intended", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "public_properties", "pub_prop_1"), {
          id: "pub_prop_1",
          name: "Public Verified Property",
          propertyType: "Flat",
          postcodeArea: "NW1",
          epcRating: "B",
          isPublicPassport: true,
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(unauthDb, "public_properties", "pub_prop_1")));
      await assertSucceeds(getDocs(collection(unauthDb, "public_properties")));
    });

    it("20. Public Property projection cannot be forged by normal clients", async () => {
      const userADb = testEnv.authenticatedContext("user_alice").firestore();
      // Client cannot write directly with prohibited private keys or unauthorized docs
      await assertFails(
        setDoc(doc(userADb, "public_properties", "pub_prop_forged"), {
          id: "pub_prop_forged",
          name: "Forged Passport",
          ownerId: "user_alice", // Prohibited PII field in public projection
        })
      );
    });
  });

  // ==========================================
  // CATEGORY 3: FIREBASE STORAGE SECURITY
  // ==========================================
  describe("Category 3: Firebase Storage Media Security & Isolation", () => {
    const mockFileBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

    beforeEach(async () => {
      // Seed job and property records in Firestore so Storage rules' firestore.get() queries resolve
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "jobs", "job_media_100"), {
          id: "job_media_100",
          homeownerId: "user_alice",
          userId: "user_alice",
          acceptedTradespersonId: "trader_tom",
          status: "in_progress",
        });
        await setDoc(doc(adminDb, "properties", "prop_media_100"), {
          id: "prop_media_100",
          ownerId: "user_alice",
          userId: "user_alice",
        });
      });
    });

    it("21. Anonymous private Job media read fails", async () => {
      const unauthStorage = testEnv.unauthenticatedContext().storage();
      const storageRef = ref(unauthStorage, "jobs/job_media_100/private_invoice.png");
      await assertFails(getBytes(storageRef));
    });

    it("22. Cross-user private Job media read fails", async () => {
      const attackerStorage = testEnv.authenticatedContext("user_attacker").storage();
      const storageRef = ref(attackerStorage, "jobs/job_media_100/photos/damage.png");
      await assertFails(getBytes(storageRef));
    });

    it("23. Authorized Job owner can read media", async () => {
      // Upload as owner first
      const ownerStorage = testEnv.authenticatedContext("user_alice").storage();
      const storageRef = ref(ownerStorage, "jobs/job_media_100/photos/damage.png");
      await assertSucceeds(uploadBytes(storageRef, mockFileBytes, { contentType: "image/png" }));
      await assertSucceeds(getBytes(storageRef));
    });

    it("24. Authorized tradesperson can read permitted media", async () => {
      // Seed media as job owner first
      const ownerStorage = testEnv.authenticatedContext("user_alice").storage();
      const ownerRef = ref(ownerStorage, "jobs/job_media_100/photos/damage.png");
      await assertSucceeds(uploadBytes(ownerRef, mockFileBytes, { contentType: "image/png" }));

      const traderStorage = testEnv.authenticatedContext("trader_tom").storage();
      const storageRef = ref(traderStorage, "jobs/job_media_100/photos/damage.png");
      await assertSucceeds(getBytes(storageRef));
    });

    it("25. Unauthorized upload to another user's Job fails", async () => {
      const attackerStorage = testEnv.authenticatedContext("user_attacker").storage();
      const storageRef = ref(attackerStorage, "jobs/job_media_100/malicious_payload.png");
      await assertFails(uploadBytes(storageRef, mockFileBytes, { contentType: "image/png" }));
    });

    it("26. Authorized upload succeeds", async () => {
      const ownerStorage = testEnv.authenticatedContext("user_alice").storage();
      const storageRef = ref(ownerStorage, "jobs/job_media_100/repair_evidence.png");
      await assertSucceeds(uploadBytes(storageRef, mockFileBytes, { contentType: "image/png" }));
    });

    it("27. Public media is readable from explicit public path", async () => {
      // Upload to public path as owner
      const ownerStorage = testEnv.authenticatedContext("user_alice").storage();
      const pubRef = ref(ownerStorage, "public_job_media/job_media_100/showcase.png");
      await assertSucceeds(uploadBytes(pubRef, mockFileBytes, { contentType: "image/png" }));

      // Read anonymously
      const unauthStorage = testEnv.unauthenticatedContext().storage();
      const unauthPubRef = ref(unauthStorage, "public_job_media/job_media_100/showcase.png");
      await assertSucceeds(getBytes(unauthPubRef));
    });

    it("28. Private media is not exposed through alternate nested paths", async () => {
      const attackerStorage = testEnv.authenticatedContext("user_attacker").storage();
      const deepNestedRef = ref(attackerStorage, "jobs/job_media_100/sub/deep/nested/private.png");
      await assertFails(getBytes(deepNestedRef));
      await assertFails(uploadBytes(deepNestedRef, mockFileBytes, { contentType: "image/png" }));
    });
  });

  // ==========================================
  // CATEGORY 4: ADMIN / PRIVILEGE & ENUMERATION TESTS
  // ==========================================
  describe("Category 4: Admin, Privilege & Collection Enumeration Protection", () => {
    it("29. Normal user cannot impersonate admin", async () => {
      const normalUserDb = testEnv.authenticatedContext("user_bob").firestore();
      // Cannot read or write /admins collection
      await assertFails(getDoc(doc(normalUserDb, "admins", "user_bob")));
      await assertFails(
        setDoc(doc(normalUserDb, "admins", "user_bob"), {
          role: "admin",
          grantedAt: new Date().toISOString(),
        })
      );
    });

    it("30. Normal user cannot modify admin-only fields on support tickets or system records", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "support_tickets", "ticket_1"), {
          id: "ticket_1",
          userId: "user_bob",
          subject: "Issue with app",
          priority: "low",
          internalNotes: "Admin only note",
        });
      });

      const bobDb = testEnv.authenticatedContext("user_bob").firestore();
      // Bob cannot mutate priority or internalNotes
      await assertFails(
        updateDoc(doc(bobDb, "support_tickets", "ticket_1"), {
          priority: "urgent_p0",
          internalNotes: "Tampered note",
        })
      );
    });

    it("31. Normal user cannot grant another user access or transfer ownership without authorization", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        const adminDb = context.firestore();
        await setDoc(doc(adminDb, "properties", "prop_strict_1"), {
          id: "prop_strict_1",
          ownerId: "user_alice",
          userId: "user_alice",
          name: "Strict Property",
        });
      });

      const attackerDb = testEnv.authenticatedContext("user_attacker").firestore();
      // Attacker cannot change ownerId or grant themselves access
      await assertFails(
        updateDoc(doc(attackerDb, "properties", "prop_strict_1"), {
          ownerId: "user_attacker",
        })
      );
    });

    it("32. ENUMERATION: Collection-level listing on sensitive collections fails for unauthorized users", async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      const normalUserDb = testEnv.authenticatedContext("user_bob").firestore();

      // List on /admins fails for unauthenticated and normal users
      await assertFails(getDocs(collection(unauthDb, "admins")));
      await assertFails(getDocs(collection(normalUserDb, "admins")));

      // List on /conversations fails for unauthenticated
      await assertFails(getDocs(collection(unauthDb, "conversations")));

      // List on /invoices fails for unauthenticated
      await assertFails(getDocs(collection(unauthDb, "invoices")));

      // List on /recurring_schedules without participant filter fails for unauthenticated
      await assertFails(getDocs(collection(unauthDb, "recurring_schedules")));
    });
  });

  describe("Category 5: Adversarial Remediation & Regression Tests (Confirmed Findings 1-10)", () => {
    it("33. FINDING 1: Attacker cannot overwrite or delete another user's public job card or public property projection", async () => {
      // Seed job and property owned by alice
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "jobs/job_alice_public"), {
          homeownerId: "user_alice",
          title: "Fix leak",
        });
        await setDoc(doc(context.firestore(), "public_job_cards/job_alice_public"), {
          title: "Public Leak Fix",
          category: "Plumbing",
        });
        await setDoc(doc(context.firestore(), "properties/prop_alice_public"), {
          ownerId: "user_alice",
          nickname: "Alice Cottage",
          isPublicPassport: true,
        });
        await setDoc(doc(context.firestore(), "public_properties/prop_alice_public"), {
          nickname: "Public Alice Cottage",
        });
      });

      const attackerDb = testEnv.authenticatedContext("attacker_bob").firestore();
      const aliceDb = testEnv.authenticatedContext("user_alice").firestore();

      // Attacker cannot update or delete Alice's public job card
      await assertFails(updateDoc(doc(attackerDb, "public_job_cards/job_alice_public"), { title: "Defaced Title" }));
      await assertFails(deleteDoc(doc(attackerDb, "public_job_cards/job_alice_public")));

      // Attacker cannot update or delete Alice's public property
      await assertFails(updateDoc(doc(attackerDb, "public_properties/prop_alice_public"), { nickname: "Defaced Property" }));
      await assertFails(deleteDoc(doc(attackerDb, "public_properties/prop_alice_public")));

      // Under V8.0, normal clients CANNOT write directly to public projections
      await assertFails(updateDoc(doc(aliceDb, "public_job_cards/job_alice_public"), { title: "Updated Leak Fix" }));
      await assertFails(updateDoc(doc(aliceDb, "public_properties/prop_alice_public"), { nickname: "Updated Alice Cottage" }));

      // Admins CAN update public projections
      const adminDb = testEnv.authenticatedContext("admin_user", { role: "admin", isAdmin: true }).firestore();
      await assertSucceeds(updateDoc(doc(adminDb, "public_job_cards/job_alice_public"), { title: "Admin Updated Leak Fix" }));
      await assertSucceeds(updateDoc(doc(adminDb, "public_properties/prop_alice_public"), { nickname: "Admin Updated Alice Cottage" }));
    });

    it("34. FINDING 2: Unassigned driver cannot eavesdrop or write to ride chat or hijack in-progress rides", async () => {
      // Seed driver profiles and ride
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users/driver_assigned"), {
          role: "driver",
          isDriver: true,
        });
        await setDoc(doc(context.firestore(), "users/driver_unassigned"), {
          role: "driver",
          isDriver: true,
        });
        await setDoc(doc(context.firestore(), "ride_requests/ride_trip_99"), {
          passengerId: "passenger_charlie",
          driverId: "driver_assigned",
          status: "in_progress",
        });
        await setDoc(doc(context.firestore(), "ride_requests/ride_trip_99/chat/msg_1"), {
          senderId: "passenger_charlie",
          text: "I am waiting at the gate",
        });
      });

      const unassignedDriverDb = testEnv.authenticatedContext("driver_unassigned").firestore();
      const assignedDriverDb = testEnv.authenticatedContext("driver_assigned").firestore();

      // Unassigned driver cannot read ride chat
      await assertFails(getDoc(doc(unassignedDriverDb, "ride_requests/ride_trip_99/chat/msg_1")));

      // Unassigned driver cannot send messages in ride chat
      await assertFails(setDoc(doc(unassignedDriverDb, "ride_requests/ride_trip_99/chat/msg_2"), {
        senderId: "driver_unassigned",
        text: "Intercepted",
      }));

      // Unassigned driver cannot update in-progress ride
      await assertFails(updateDoc(doc(unassignedDriverDb, "ride_requests/ride_trip_99"), {
        status: "cancelled",
      }));

      // Assigned driver can read ride chat and send message
      await assertSucceeds(getDoc(doc(assignedDriverDb, "ride_requests/ride_trip_99/chat/msg_1")));
      await assertSucceeds(setDoc(doc(assignedDriverDb, "ride_requests/ride_trip_99/chat/msg_3"), {
        senderId: "driver_assigned",
        text: "I have arrived at the pickup location",
      }));
    });

    it("35. FINDING 3: User cannot create an invoice with forged paid or transferred status", async () => {
      const traderDb = testEnv.authenticatedContext("trader_dave").firestore();

      // Forged paid invoice creation fails
      await assertFails(setDoc(doc(traderDb, "invoices/inv_forged_paid"), {
        traderId: "trader_dave",
        amount: 500,
        paid: true,
        status: "paid",
      }));

      // Forged payoutTransferred invoice creation fails
      await assertFails(setDoc(doc(traderDb, "invoices/inv_forged_payout"), {
        traderId: "trader_dave",
        amount: 500,
        payoutTransferred: true,
        payoutStatus: "transferred",
      }));

      // Legitimate unpaid draft invoice creation succeeds
      await assertSucceeds(setDoc(doc(traderDb, "invoices/inv_legit_draft"), {
        traderId: "trader_dave",
        amount: 500,
        paid: false,
        status: "draft",
        payoutTransferred: false,
        payoutStatus: "unpaid",
      }));
    });

    it("36. FINDING 4: Client cannot directly set quote status to accepted or modify financial fields", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "jobs/job_roof_quote"), {
          homeownerId: "user_alice",
          title: "Roof repair",
        });
        await setDoc(doc(context.firestore(), "jobs/job_roof_quote/quotes/quote_1"), {
          tradespersonId: "trader_dave",
          homeownerId: "user_alice",
          price: 450,
          status: "pending",
          details: "Fix 5 tiles",
        });
      });

      const aliceDb = testEnv.authenticatedContext("user_alice").firestore();
      const daveDb = testEnv.authenticatedContext("trader_dave").firestore();

      // Alice cannot directly set quote to accepted (escrow bypass)
      await assertFails(updateDoc(doc(aliceDb, "jobs/job_roof_quote/quotes/quote_1"), {
        status: "accepted",
      }));

      // Dave cannot set payoutTransferred on quote
      await assertFails(updateDoc(doc(daveDb, "jobs/job_roof_quote/quotes/quote_1"), {
        payoutTransferred: true,
      }));

      // Dave can update legitimate notes on his quote
      await assertSucceeds(updateDoc(doc(daveDb, "jobs/job_roof_quote/quotes/quote_1"), {
        details: "Fix 5 tiles including weather sealing",
      }));
    });

    it("37. FINDING 5: Homeowner cannot directly mutate payment status or accepted trader on Job", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "jobs/job_garden_fix"), {
          homeownerId: "user_alice",
          title: "Garden fencing",
          paymentStatus: "unpaid",
          funded: false,
        });
      });

      const aliceDb = testEnv.authenticatedContext("user_alice").firestore();

      // Alice cannot mutate paymentStatus or funded
      await assertFails(updateDoc(doc(aliceDb, "jobs/job_garden_fix"), {
        paymentStatus: "paid",
      }));
      await assertFails(updateDoc(doc(aliceDb, "jobs/job_garden_fix"), {
        funded: true,
      }));

      // Alice cannot set acceptedTraderId directly
      await assertFails(updateDoc(doc(aliceDb, "jobs/job_garden_fix"), {
        acceptedTraderId: "trader_dave",
      }));

      // Alice can update legitimate job description
      await assertSucceeds(updateDoc(doc(aliceDb, "jobs/job_garden_fix"), {
        description: "Updated fencing measurements",
      }));
    });

    it("38. FINDING 6: User cannot forge rating, trustScore, or verification status on public profile", async () => {
      const bobDb = testEnv.authenticatedContext("user_bob").firestore();

      // Bob cannot create public profile with forged trustScore or verification
      await assertFails(setDoc(doc(bobDb, "public_profiles/user_bob"), {
        displayName: "Bob",
        trustScore: 100,
        rating: 5.0,
        verifiedTrader: true,
      }));

      // Bob can create legitimate base public profile
      await assertSucceeds(setDoc(doc(bobDb, "public_profiles/user_bob"), {
        displayName: "Bob Builder",
        bio: "Experienced carpenter",
      }));

      // Bob cannot subsequently update profile to inject rating or verification
      await assertFails(updateDoc(doc(bobDb, "public_profiles/user_bob"), {
        rating: 5.0,
      }));
      await assertFails(updateDoc(doc(bobDb, "public_profiles/user_bob"), {
        verifiedTrader: true,
      }));
      await assertFails(updateDoc(doc(bobDb, "public_profiles/user_bob"), {
        trustScore: 98,
      }));

      // Bob can update his bio
      await assertSucceeds(updateDoc(doc(bobDb, "public_profiles/user_bob"), {
        bio: "Experienced master carpenter with 10 years experience",
      }));
    });

    it("39. FINDING 7: Tenant with unverified email cannot read private property", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "properties/prop_tenant_test"), {
          ownerId: "user_alice",
          tenantEmail: "tenant@example.com",
          address: "10 Secret Way",
        });
      });

      // Tenant with unverified email fails
      const unverifiedTenantDb = testEnv.authenticatedContext("user_tenant_unverified", {
        email: "tenant@example.com",
        email_verified: false,
      }).firestore();
      await assertFails(getDoc(doc(unverifiedTenantDb, "properties/prop_tenant_test")));

      // Tenant with verified email succeeds
      const verifiedTenantDb = testEnv.authenticatedContext("user_tenant_verified", {
        email: "tenant@example.com",
        email_verified: true,
      }).firestore();
      await assertSucceeds(getDoc(doc(verifiedTenantDb, "properties/prop_tenant_test")));
    });

    it("40. FINDING 8: Ordinary user cannot read Driver profile from /users collection", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "users/driver_steve"), {
          role: "driver",
          phoneNumber: "+447700900000",
          licenseNumber: "DRV12345",
        });
        await setDoc(doc(context.firestore(), "users/trader_steve"), {
          role: "tradesperson",
          trade: "Electrician",
        });
      });

      const aliceDb = testEnv.authenticatedContext("user_alice").firestore();
      const steveDriverDb = testEnv.authenticatedContext("driver_steve").firestore();

      // Alice cannot read Steve's private driver document in /users
      await assertFails(getDoc(doc(aliceDb, "users/driver_steve")));

      // Steve can read his own driver document
      await assertSucceeds(getDoc(doc(steveDriverDb, "users/driver_steve")));

      // Alice can read public trader document in /users
      await assertSucceeds(getDoc(doc(aliceDb, "users/trader_steve")));
    });

    it("41. FINDING 9: User cannot create a review without an associated job they participated in", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "jobs/job_verified_review"), {
          homeownerId: "user_alice",
          acceptedTraderId: "trader_dave",
        });
      });

      const bobDb = testEnv.authenticatedContext("user_bob").firestore();
      const aliceDb = testEnv.authenticatedContext("user_alice").firestore();

      // Bob (unrelated stranger) cannot create a review for trader_dave without job
      await assertFails(setDoc(doc(bobDb, "reviews/rev_fake_1"), {
        reviewerId: "user_bob",
        traderId: "trader_dave",
        rating: 1,
        comment: "Terrible service",
      }));

      // Bob cannot create review for a job he did not participate in
      await assertFails(setDoc(doc(bobDb, "reviews/rev_fake_2"), {
        reviewerId: "user_bob",
        traderId: "trader_dave",
        jobId: "job_verified_review",
        rating: 1,
        comment: "Fake review",
      }));

      // Alice (job participant) can create a review with valid associated job
      await assertSucceeds(setDoc(doc(aliceDb, "reviews/rev_legit_alice"), {
        reviewerId: "user_alice",
        traderId: "trader_dave",
        jobId: "job_verified_review",
        rating: 5,
        comment: "Excellent service!",
      }));
    });

    it("42. FINDING 10: Pending property transfer claimer cannot escalate privileges", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "properties/prop_transfer_esc"), {
          ownerId: "user_alice",
          transferStatus: "pending",
          pendingTransferToUid: "user_claim_buyer",
          verifiedByAdmin: false,
        });
      });

      const buyerDb = testEnv.authenticatedContext("user_claim_buyer").firestore();

      // Buyer cannot set verifiedByAdmin during claim
      await assertFails(updateDoc(doc(buyerDb, "properties/prop_transfer_esc"), {
        ownerId: "user_claim_buyer",
        userId: "user_claim_buyer",
        transferStatus: "claimed",
        verifiedByAdmin: true,
      }));

      // Buyer can claim transfer updating only allowed ownership fields
      await assertSucceeds(updateDoc(doc(buyerDb, "properties/prop_transfer_esc"), {
        ownerId: "user_claim_buyer",
        userId: "user_claim_buyer",
        transferStatus: "claimed",
      }));
    });

    it("43. Direct/targeted job card cannot be pushed to public_job_cards with target trader PII", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "jobs/direct_job_sec_1"), {
          homeownerId: "user_alice",
          targetTradespersonId: "trader_tom",
          status: "posted",
        });
      });

      const aliceDb = testEnv.authenticatedContext("user_alice").firestore();

      // Alice cannot create a public job card for a direct/targeted job
      await assertFails(setDoc(doc(aliceDb, "public_job_cards/direct_job_sec_1"), {
        title: "Leaky Pipe Repair",
        category: "Plumbing",
        targetTradespersonId: "trader_tom",
      }));
    });

    it("44. Non-public property passport cannot be published to public_properties", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "properties/prop_private_sec_1"), {
          ownerId: "user_alice",
          isPublicPassport: false,
        });
      });

      const aliceDb = testEnv.authenticatedContext("user_alice").firestore();

      // Alice cannot publish a non-public property to public_properties
      await assertFails(setDoc(doc(aliceDb, "public_properties/prop_private_sec_1"), {
        name: "Private Residence",
        postcodeArea: "SW1A",
      }));
    });

    it("45. REGRESSION A: Unauthenticated user cannot create public_job_cards", async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertFails(setDoc(doc(unauthDb, "public_job_cards", "reg_card_1"), {
        title: "Test Job",
        category: "Plumbing",
      }));
    });

    it("46. REGRESSION B: Authenticated homeowner cannot create/update/delete public_job_cards", async () => {
      const homeownerDb = testEnv.authenticatedContext("homeowner_alice", { role: "customer" }).firestore();
      
      await assertFails(setDoc(doc(homeownerDb, "public_job_cards", "reg_card_2"), {
        title: "Test Job 2",
        category: "Electrical",
      }));

      // Assuming doc exists from disabled security rules seeding
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "public_job_cards/reg_card_2_seed"), {
          title: "Seeded Job",
          category: "Electrical",
        });
      });

      await assertFails(updateDoc(doc(homeownerDb, "public_job_cards", "reg_card_2_seed"), {
        title: "Updated Job",
      }));

      await assertFails(deleteDoc(doc(homeownerDb, "public_job_cards", "reg_card_2_seed")));
    });

    it("47. REGRESSION C: Authenticated tradesperson cannot create/update/delete public_job_cards", async () => {
      const traderDb = testEnv.authenticatedContext("trader_bob", { role: "tradesperson" }).firestore();

      await assertFails(setDoc(doc(traderDb, "public_job_cards", "reg_card_3"), {
        title: "Test Job 3",
        category: "Carpentry",
      }));

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "public_job_cards/reg_card_3_seed"), {
          title: "Seeded Job 3",
          category: "Carpentry",
        });
      });

      await assertFails(updateDoc(doc(traderDb, "public_job_cards", "reg_card_3_seed"), {
        title: "Updated Job 3",
      }));

      await assertFails(deleteDoc(doc(traderDb, "public_job_cards", "reg_card_3_seed")));
    });

    it("48. REGRESSION D: Unauthenticated user cannot create/update/delete public_properties", async () => {
      const unauthDb = testEnv.unauthenticatedContext().firestore();

      await assertFails(setDoc(doc(unauthDb, "public_properties", "reg_prop_1"), {
        name: "Unauthenticated Prop",
        postcodeArea: "SW1A",
      }));

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "public_properties/reg_prop_1_seed"), {
          name: "Seeded Prop",
          postcodeArea: "SW1A",
        });
      });

      await assertFails(updateDoc(doc(unauthDb, "public_properties", "reg_prop_1_seed"), {
        name: "Updated Name",
      }));

      await assertFails(deleteDoc(doc(unauthDb, "public_properties", "reg_prop_1_seed")));
    });

    it("49. REGRESSION E: Authenticated property owner cannot create/update/delete public_properties", async () => {
      const ownerDb = testEnv.authenticatedContext("owner_charlie", { role: "customer" }).firestore();

      await assertFails(setDoc(doc(ownerDb, "public_properties", "reg_prop_2"), {
        name: "Charlie Prop",
        postcodeArea: "SW1A",
      }));

      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "public_properties/reg_prop_2_seed"), {
          name: "Seeded Prop 2",
          postcodeArea: "SW1A",
        });
      });

      await assertFails(updateDoc(doc(ownerDb, "public_properties", "reg_prop_2_seed"), {
        name: "Updated Name 2",
      }));

      await assertFails(deleteDoc(doc(ownerDb, "public_properties", "reg_prop_2_seed")));
    });

    it("50. REGRESSION F: Unauthenticated users CAN still read/list public_job_cards", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "public_job_cards/reg_card_f"), {
          title: "Public Discovery",
          category: "Plumbing",
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(unauthDb, "public_job_cards", "reg_card_f")));
      await assertSucceeds(getDocs(collection(unauthDb, "public_job_cards")));
    });

    it("51. REGRESSION G: Unauthenticated users CAN still read/list public_properties when those documents exist", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await setDoc(doc(context.firestore(), "public_properties/reg_prop_g"), {
          name: "Public Property Discovery",
          postcodeArea: "SW1A",
        });
      });

      const unauthDb = testEnv.unauthenticatedContext().firestore();
      await assertSucceeds(getDoc(doc(unauthDb, "public_properties", "reg_prop_g")));
      await assertSucceeds(getDocs(collection(unauthDb, "public_properties")));
    });
  });
});
