-- Async explanation attachments (step 3b). A SEPARATE table, deliberately: the decision_records
-- rows stay truly append-only (never UPDATEd after insert — the tamper-evidence story an auditor
-- checks). The explanation is an insert-once side record keyed by the decision id and overlaid into
-- the returned DecisionRecord on read.

CREATE TABLE decision_explanations (
    record_id        uuid                        PRIMARY KEY
                     REFERENCES decision_records (record_id),
    status           varchar(255)                NOT NULL,   -- ATTACHED | FAILED (PENDING = row absent)
    provider         varchar(255),                           -- e.g. stub-canned-v1; null when FAILED
    explanation_text text,                                   -- the rendered prose; null when FAILED
    attached_at      timestamp(6) with time zone NOT NULL
);
