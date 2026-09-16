with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    content = f.read()

# Define the targets and replacements for the remaining blocks
replacements = [
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.status).toBe('succeeded');
        expect(snap.data()?.totalTokens).toBe(150);
  

    it('C2 — Negative metrics:""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.status).toBe('succeeded');
        expect(snap.data()?.totalTokens).toBe(150);
    });

    it('C2 — Negative metrics:"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c2',
              leaseId: 'lease_c2',
              durationMs: -500,
            },
            storeDb as any
          )
        ).rejects.toThrow();
  

    it('C3 — NaN and Infinity:""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c2',
              leaseId: 'lease_c2',
              durationMs: -500,
            },
            storeDb as any
          )
        ).rejects.toThrow();
    });

    it('C3 — NaN and Infinity:"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c3',
              leaseId: 'lease_c3',
              outputTokens: Infinity,
            },
            storeDb as any
          )
        ).rejects.toThrow();
  

    it('C4 — Token consistency:""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c3',
              leaseId: 'lease_c3',
              outputTokens: Infinity,
            },
            storeDb as any
          )
        ).rejects.toThrow();
    });

    it('C4 — Token consistency:"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c4',
              leaseId: 'lease_c4',
              inputTokens: 100,
              outputTokens: 50,
              totalTokens: 200,
            },
            storeDb as any
          )
        ).rejects.toThrow();
  

    it('C5 — Missing provider metrics:""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c4',
              leaseId: 'lease_c4',
              inputTokens: 100,
              outputTokens: 50,
              totalTokens: 200,
            },
            storeDb as any
          )
        ).rejects.toThrow();
    });

    it('C5 — Missing provider metrics:"""
    ),
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        const data = snap.data()!;
        expect(data.inputTokens).toBeUndefined();
        expect(data.outputTokens).toBeUndefined();
        expect(data.totalTokens).toBeUndefined();
  

    it('C6 — Pricing version:""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        const data = snap.data()!;
        expect(data.inputTokens).toBeUndefined();
        expect(data.outputTokens).toBeUndefined();
        expect(data.totalTokens).toBeUndefined();
    });

    it('C6 — Pricing version:"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c6',
              leaseId: 'lease_c6',
              pricingVersion: 'v2_custom_tier',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
  

    it('C7 — Historical cost:""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c6',
              leaseId: 'lease_c6',
              pricingVersion: 'v2_custom_tier',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
    });

    it('C7 — Historical cost:"""
    ),
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.estimatedCost).toBe(0.05);
  

    it('C8 — Timestamp integrity:""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.estimatedCost).toBe(0.05);
    });

    it('C8 — Timestamp integrity:"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c8',
              leaseId: 'lease_c8',
              finishedAt: finishedEarlier,
            },
            storeDb as any
          )
        ).rejects.toThrow();
  

    it('C9 — Duration integrity:""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c8',
              leaseId: 'lease_c8',
              finishedAt: finishedEarlier,
            },
            storeDb as any
          )
        ).rejects.toThrow();
    });

    it('C9 — Duration integrity:"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c9',
              leaseId: 'lease_c9',
              finishedAt,
              durationMs: 1000,
            },
            storeDb as any
          )
        ).rejects.toThrow();
  

    it('C10 — Error sanitization:""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_c9',
              leaseId: 'lease_c9',
              finishedAt,
              durationMs: 1000,
            },
            storeDb as any
          )
        ).rejects.toThrow();
    });

    it('C10 — Error sanitization:"""
    ),
    (
        """      expect(eventSnap.exists()).toBe(true);
      expect(eventSnap.data()?.eventType).toBe('QUALITY_REVIEW_APPLIED');
      expect(eventSnap.data()?.aggregateId).toBe('job_ch_t4');
  

    // TEST 5 — IDENTICAL QUALITY RETRY""",
        """      expect(eventSnap.exists()).toBe(true);
      expect(eventSnap.data()?.eventType).toBe('QUALITY_REVIEW_APPLIED');
      expect(eventSnap.data()?.aggregateId).toBe('job_ch_t4');
    });

    // TEST 5 — IDENTICAL QUALITY RETRY"""
    ),
    (
        """      expect(fetched).toBeDefined();
      expect(fetched?.qualityId).toBe(review.qualityId);
      expect(fetched?.targetId).toBe('prop_ch_t10');
      expect(fetched?.reviewerId).toBe('admin_reviewer_t10');
  

    // TEST 11 — FIRESTORE FAILURE FAIL-CLOSED""",
        """      expect(fetched).toBeDefined();
      expect(fetched?.qualityId).toBe(review.qualityId);
      expect(fetched?.targetId).toBe('prop_ch_t10');
      expect(fetched?.reviewerId).toBe('admin_reviewer_t10');
    });

    // TEST 11 — FIRESTORE FAILURE FAIL-CLOSED"""
    ),
    (
        """      expect(res1.qualityId).toBe(review.qualityId);
      expect(res2.qualityId).toBe(review.qualityId);

      const snap = await getDoc(doc(adminDb, 'intelligence_quality', review.qualityId));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.qualityId).toBe(review.qualityId);
  

    // TEST 13 — CONCURRENT CONFLICTING PERSISTENCE""",
        """      expect(res1.qualityId).toBe(review.qualityId);
      expect(res2.qualityId).toBe(review.qualityId);

      const snap = await getDoc(doc(adminDb, 'intelligence_quality', review.qualityId));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.qualityId).toBe(review.qualityId);
    });

    // TEST 13 — CONCURRENT CONFLICTING PERSISTENCE"""
    ),
    (
        """      const snap = await getDoc(doc(adminDb2, 'intelligence_quality', review.qualityId));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.targetId).toBe('prop_ch_t14');
      expect(snap.data()?.reviewerId).toBe('admin_writer');
  

    // TEST 15 — HISTORICAL CLIENT WRITE DENIAL""",
        """      const snap = await getDoc(doc(adminDb2, 'intelligence_quality', review.qualityId));
      expect(snap.exists()).toBe(true);
      expect(snap.data()?.targetId).toBe('prop_ch_t14');
      expect(snap.data()?.reviewerId).toBe('admin_writer');
    });

    // TEST 15 — HISTORICAL CLIENT WRITE DENIAL"""
    )
]

for t, r in replacements:
    if t in content:
        content = content.replace(t, r)
        print("Replaced one target successfully.")
    else:
        print("WARNING: target not found!")
        print(repr(t[:100]))

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write(content)
