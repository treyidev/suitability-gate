"""Wire DTOs for the /explain contract between the Java core and this service.

These are Pydantic models because they cross an external (HTTP) boundary and need validation +
JSON (de)serialisation. The JSON is camelCase (the core's Jackson convention); Python code uses
snake_case, bridged by an alias generator — so neither side bends to the other's naming.

Design note — deliberately PII-free: the request carries only the certificate number, the verdict,
and the ids of the rules that failed. It does NOT carry the customer's name, income, or DOB. The
canned explanation is composed from rule semantics alone, honouring the core's PII discipline
(ids only leave the sealed ledger). A real LLM provider (Phase 2) would decide, explicitly, what
minimal extra context it needs behind this same contract.
"""

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    """Base model whose JSON is camelCase while Python attributes stay snake_case.

    Package-private: not part of the public surface, just the shared config for the DTOs below.
    ``populate_by_name`` lets tests/constructors use the snake_case names directly.
    """

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class ExplainRequest(_CamelModel):
    """Facts the core sends to have a frozen decision explained.

    Attributes:
        certificate_number: The decision's human-readable id (``SG-YYYY-NNNNNN``); used for
            correlation/logging only, never to alter the text.
        verdict: The composed verdict — ``PASS`` or ``FLAGGED``. Drives the framing of the prose.
        failed_rules: Ids of the rules whose outcome was FAIL (e.g. ``AGE_RISK_BAND``); empty for a
            clean PASS. The narrative is built from these.
    """

    certificate_number: str
    verdict: str
    failed_rules: list[str] = Field(default_factory=list)


class ExplainResponse(_CamelModel):
    """The rendered explanation returned to the core.

    Attributes:
        provider: Identifier of what produced the text (here the canned stub), frozen into the
            record's provenance so a reader knows which generation path ran.
        explanation_text: The plain-language explanation prose.
    """

    provider: str
    explanation_text: str
