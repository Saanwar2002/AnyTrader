with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'r') as f:
    content = f.read()

# Define the targets and replacements
replacements = [
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.sanitizedDiagnostic).not.toContain('sk-dangerousSecretKeyValue');
        expect(snap.data()?.sanitizedDiagnostic).not.toContain('eyJhbGciOiJIUzI1Ni');
  

    it('C11 — Server metadata integrity:""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.sanitizedDiagnostic).not.toContain('sk-dangerousSecretKeyValue');
        expect(snap.data()?.sanitizedDiagnostic).not.toContain('eyJhbGciOiJIUzI1Ni');
    });

    it('C11 — Server metadata integrity:"""
    ),
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.runId).toBe(runId);
  

    it('C12 — Attempt separation:""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.runId).toBe(runId);
    });

    it('C12 — Attempt separation:"""
    ),
    (
        """        expect(snap1.exists()).toBe(true);
        expect(snap2.exists()).toBe(true);
  

    it('C13 — Terminal state protection:""",
        """        expect(snap1.exists()).toBe(true);
        expect(snap2.exists()).toBe(true);
    });

    it('C13 — Terminal state protection:"""
    ),
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
  

    it('C14 — Size protection:""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
    });

    it('C14 — Size protection:"""
    ),
    (
        """            storeDb as any
          )
        ).rejects.toThrow();
  

    it('C15 — Fresh-read durability:""",
        """            storeDb as any
          )
        ).rejects.toThrow();
    });

    it('C15 — Fresh-read durability:"""
    ),
    (
        """        expect(data.totalTokens).toBe(300);
        expect(data.pricingVersion).toBe('v1_durability');
  

    it('C16 — Concurrent finalization:""",
        """        expect(data.totalTokens).toBe(300);
        expect(data.pricingVersion).toBe('v1_durability');
    });

    it('C16 — Concurrent finalization:"""
    ),
    (
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
  

    it('C17 — Server-Owned Metadata Integrity on Real Emulator:""",
        """        const snap = await getDoc(doc(adminDb, 'intelligence_processing_runs', runId));
        expect(snap.data()?.status).toBe('succeeded');
    });

    it('C17 — Server-Owned Metadata Integrity on Real Emulator:"""
    ),
    (
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runIdForOverwriteTest,
            {
              workerId: 'worker_c17_over',
              leaseId: 'worker_c17_over',
              taskId: 'stolen_task_id',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied taskId/);
  

    it('Test A — Idempotency of recordRunStarted with identical params', async () =>|""",
        """        await expect(
          processingRunStore.recordRunSucceeded(
            runIdForOverwriteTest,
            {
              workerId: 'worker_c17_over',
              leaseId: 'worker_c17_over',
              taskId: 'stolen_task_id',
            } as any,
            storeDb as any
          )
        ).rejects.toThrow(/Malicious update rejected: caller-supplied taskId/);
    });

    it('Test A — Idempotency of recordRunStarted with identical params', async () =>|"""
    )
]

for t, r in replacements:
    # Handle optional regex/char markers
    clean_t = t.replace("|", "")
    clean_r = r.replace("|", "")
    if clean_t in content:
        content = content.replace(clean_t, clean_r)
        print("Replaced one target successfully.")
    else:
        print("WARNING: target not found!")
        print(repr(clean_t[:50]))

with open('tests/unit/firebaseEmulatorIntelligenceV81.test.ts', 'w') as f:
    f.write(content)
