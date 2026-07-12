"""Composes the canned plain-language explanation for a frozen decision.

Why canned (and why that is enough for Phase 1): the thesis is that the model NEVER makes the
decision — it only restates one already made deterministically. A canned composer proves that
boundary perfectly: it is downstream of the verdict, it invents no verdict/number/threshold, and it
is swappable for a real LLM behind the same call (Phase 2) with zero change upstream. So the stub is
not a shortcut around the design — it *is* the design, minus the model.

How the text is built: not a lookup of every verdict×rule combination (brittle, combinatorial) but a
small map of per-rule narrative fragments assembled under a verdict framing. Any combination of failed
rules yields sensible prose, and adding a Phase-2 rule is one new fragment here.

This module is pure functions + constants — no state, no lifecycle — so it stays a module, not a
class (a class here would be a namespace pretending to be an object).
"""

from __future__ import annotations

# Verdict tokens (mirror the core's Verdict enum names).
VERDICT_PASS = "PASS"
VERDICT_FLAGGED = "FLAGGED"

# Identifier stamped into the record's provenance so a reader knows the canned path produced this text
# (as opposed to a real LLM provider in Phase 2).
PROVIDER = "stub-canned-v1"

# Per-rule narrative fragments — each completes the sentence "...because <fragment>". Plain,
# customer-comprehensible language; deliberately no numbers or thresholds (those live in the record's
# own rule rows, which the deterministic engine produced).
_RULE_NARRATIVES: dict[str, str] = {
    "AGE_RISK_BAND": "the fund's risk level is higher than is appropriate for the customer's age band",
    "STATED_RISK_MATCH": "the fund is riskier than the customer's stated risk appetite",
    "SENIOR_ENHANCED": (
        "the customer is a senior citizen and the fund's volatility triggers an enhanced-suitability "
        "review"
    ),
    "HORIZON_LOCKIN": "the fund's lock-in period runs longer than the customer's stated investment horizon",
}

# Closing lines that keep the thesis explicit in the artifact itself.
_FLAGGED_CLOSING = (
    "The suitability rules reached this verdict on their own; this note only restates them in plain "
    "language. The transaction can proceed only with documented supervisor approval."
)
_PASS_CLOSING = (
    "This note only summarises the rules' findings — it did not make the decision."
)


def compose_explanation(verdict: str, failed_rules: list[str]) -> str:
    """Render the plain-language explanation for a decision.

    Builds a verdict-appropriate narrative: for FLAGGED, why it was flagged (assembled from the failed
    rules' fragments); for PASS, a suitability summary. The text never asserts a verdict, number, or
    threshold — it explains a decision already made by the rules.

    Args:
        verdict: ``PASS`` or ``FLAGGED``. Any other value is treated as non-PASS (flagged framing) so
            an unexpected token degrades to the more cautious wording rather than a wrong "suitable".
        failed_rules: Ids of rules that failed (e.g. ``["AGE_RISK_BAND", "SENIOR_ENHANCED"]``). Unknown
            ids fall back to a generic fragment naming the rule, so a new rule never yields empty prose.

    Returns:
        The explanation text.

    Example:
        >>> compose_explanation("FLAGGED", ["AGE_RISK_BAND"])
        "This proposal has been flagged for supervisor review because the fund's risk level is higher \
than is appropriate for the customer's age band. The suitability rules reached this verdict on their \
own; this note only restates them in plain language. The transaction can proceed only with documented \
supervisor approval."
    """
    if verdict == VERDICT_PASS:
        return (
            "This proposal is suitable for the customer. Every applicable check passed — the fund's "
            "risk level, the customer's stated profile, their investment horizon, and the regulatory "
            f"checks are all aligned, so the transaction may proceed. {_PASS_CLOSING}"
        )

    reasons = [
        _RULE_NARRATIVES.get(rule_id, f"a suitability check ({rule_id}) did not pass")
        for rule_id in failed_rules
    ]
    joined = _join_reasons(reasons)
    return f"This proposal has been flagged for supervisor review because {joined}. {_FLAGGED_CLOSING}"


def _join_reasons(reasons: list[str]) -> str:
    """Join reason fragments into a readable clause (``a``, ``a and b``, ``a, b, and c``).

    Module-private: only :func:`compose_explanation` uses it.

    Args:
        reasons: One or more narrative fragments. Empty yields a neutral fallback so the sentence
            still reads (a flagged decision should always name at least one reason, but we never emit
            a dangling "because .").

    Returns:
        The fragments joined with commas and a trailing "and".
    """
    if not reasons:
        return "one or more suitability checks did not pass"
    if len(reasons) == 1:
        return reasons[0]
    if len(reasons) == 2:
        return f"{reasons[0]} and {reasons[1]}"
    return f"{', '.join(reasons[:-1])}, and {reasons[-1]}"
