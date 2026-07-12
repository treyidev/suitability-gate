-- Supervisor reviews of FLAGGED decisions (brief §6.1 OverrideEvent, D11). A SEPARATE table, deliberately:
-- decision_records rows stay truly append-only (never UPDATEd after insert — the tamper-evidence story an
-- auditor checks). A review is an insert-once side record stitched into the returned DecisionRecord's
-- `overrides` on read. Multiple rows per record are possible by design (append-only events); Phase-1 policy
-- enforces one review per record at the endpoint (first wins).

CREATE TABLE decision_overrides (
    override_id      uuid                        PRIMARY KEY,
    record_id        uuid                        NOT NULL
                     REFERENCES decision_records (record_id),
    created_at       timestamp(6) with time zone NOT NULL,
    overridden_by    varchar(255)                NOT NULL,   -- supervisor identity from the JWT
    justification    text                        NOT NULL,   -- mandatory, non-blank
    resulting_status varchar(255)                NOT NULL     -- OVERRIDE_APPROVED | FLAG_UPHELD
);

CREATE INDEX idx_decision_overrides_record ON decision_overrides (record_id);
