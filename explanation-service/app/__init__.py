"""SuitabilityGate Explanation Service — the Phase-1 stub explanation provider.

Why this package exists
-----------------------
The core (Java Modulith) makes deterministic suitability decisions and freezes each one into an
immutable DecisionRecord. This service is the *downstream* half of the one async seam: after a record
is frozen, the core asks this process to render a plain-language explanation of it. That separation is
the whole thesis — *guarantees in code, judgment in the model*: the explanation never contributes the
verdict, a rule outcome, a threshold, or a number; it only restates, in plain English, a decision that
was already made.

Where it fits
-------------
Upstream: the Java core's async explanation handler (the single Java→Python call). Downstream: nothing
— this is a leaf. The core owns all persistence; this service is stateless.

Phase-1 limitation (with mitigation)
------------------------------------
This is a STUB: it returns canned text composed from the verdict and the set of failed rules. Gemini
is intentionally not wired (locked decision). Phase 2 swaps the canned composer for a real LLM provider
behind the same HTTP contract — no change on the Java side.
"""
