with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    content = f.read()

# Define the targets and replacements
replacements = [
    (
        """        const second = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(second.runId).toBe(runId);
        expect(second.status).toBe('started');
  

    it('Test B — recordRunStarted""",
        """        const second = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(second.runId).toBe(runId);
        expect(second.status).toBe('started');
    });

    it('Test B — recordRunStarted"""
    ),
    (
        """        // Conflict: different provider
        await expect(
          processingRunStore.recordRunStarted(
            { ...startPayload, provider: 'different_provider' },
            storeDb as any
          )
        ).rejects.toThrow(/Conflict in server-owned metadata\\/identity: incoming provider/);
  

    it('Test C — recordRunStarted""",
        """        // Conflict: different provider
        await expect(
          processingRunStore.recordRunStarted(
            { ...startPayload, provider: 'different_provider' },
            storeDb as any
          )
        ).rejects.toThrow(/Conflict in server-owned metadata\\/identity: incoming provider/);
    });

    it('Test C — recordRunStarted"""
    ),
    (
        """        const second = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(second.provider).toBe('google_genai');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
  

    it('Test D — recordRunStarted""",
        """        const second = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(second.provider).toBe('google_genai');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
    });

    it('Test D — recordRunStarted"""
    ),
    (
        """        // Re-call recordRunStarted
        const res = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(res.status).toBe('succeeded');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
  

    it('Test E — recordRunSucceeded""",
        """        // Re-call recordRunStarted
        const res = await processingRunStore.recordRunStarted(startPayload, storeDb as any);
        expect(res.status).toBe('succeeded');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
    });

    it('Test E — recordRunSucceeded"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_te',
              leaseId: 'lease_te',
              provider: 'hacked_provider',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied provider/);
  

    it('Test F — recordRunFailed""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_te',
              leaseId: 'lease_te',
              provider: 'hacked_provider',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied provider/);
    });

    it('Test F — recordRunFailed"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Simulated failure'),
            {
              workerId: 'worker_tf',
              leaseId: 'lease_tf',
              provider: 'hacked_provider',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied provider/);
  

    it('Test G — recordRunSucceeded""",
        """        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Simulated failure'),
            {
              workerId: 'worker_tf',
              leaseId: 'lease_tf',
              provider: 'hacked_provider',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied provider/);
    });

    it('Test G — recordRunSucceeded"""
    ),
    (
        """        expect(succ.provider).toBe('google_genai');
        expect(succ.modelVersion).toBe('gemini-1.5-flash');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
        expect(snap.data()?.modelVersion).toBe('gemini-1.5-flash');
  

    it('Test H — recordRunFailed""",
        """        expect(succ.provider).toBe('google_genai');
        expect(succ.modelVersion).toBe('gemini-1.5-flash');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
        expect(snap.data()?.modelVersion).toBe('gemini-1.5-flash');
    });

    it('Test H — recordRunFailed"""
    ),
    (
        """        expect(fail.provider).toBe('google_genai');
        expect(fail.modelVersion).toBe('gemini-1.5-flash');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
        expect(snap.data()?.modelVersion).toBe('gemini-1.5-flash');
  

    it('Test I — recordRunSucceeded""",
        """        expect(fail.provider).toBe('google_genai');
        expect(fail.modelVersion).toBe('gemini-1.5-flash');

        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.provider).toBe('google_genai');
        expect(snap.data()?.modelVersion).toBe('gemini-1.5-flash');
    });

    it('Test I — recordRunSucceeded"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_ti',
              leaseId: 'lease_ti',
              pricingVersion: 'v2_malicious_override',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
  

    it('Test J — recordRunFailed""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runId,
            {
              workerId: 'worker_ti',
              leaseId: 'lease_ti',
              pricingVersion: 'v2_malicious_override',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
    });

    it('Test J — recordRunFailed"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Failure update test'),
            {
              workerId: 'worker_tj',
              leaseId: 'lease_tj',
              pricingVersion: 'v2_malicious_override',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
  

    it('Test K — Concurrent recordRunStarted""",
        """        await expect(
          processingRunStore.recordRunFailed(
            runId,
            new Error('Failure update test'),
            {
              workerId: 'worker_tj',
              leaseId: 'lease_tj',
              pricingVersion: 'v2_malicious_override',
            },
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied pricingVersion/);
    });

    it('Test K — Concurrent recordRunStarted"""
    ),
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.status).toBe('started');
  

    });

  // =========================================================================
  // 15. FINAL CUMULATIVE HARDENING: QUALITY REVIEW, HISTORICAL IMMUTABILITY & CLIENT WRITE PROTECTION
  // =========================================================================
  describe('15.""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.exists()).toBe(true);
        expect(snap.data()?.status).toBe('started');
    });
  });

  // =========================================================================
  // 15. FINAL CUMULATIVE HARDENING: QUALITY REVIEW, HISTORICAL IMMUTABILITY & CLIENT WRITE PROTECTION
  // =========================================================================
  describe('15."""
    )
]

for t, r in replacements:
    if t in content:
        content = content.replace(t, r)
        print("Replaced one target successfully.")
    else:
        print("WARNING: target not found!")
        # Let's print the first 50 chars of target to debug
        print(repr(t[:50]))

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write(content)
