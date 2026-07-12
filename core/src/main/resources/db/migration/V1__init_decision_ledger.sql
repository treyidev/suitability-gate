-- Decision Record ledger — append-only store (locked decision D8). Flyway owns this schema;
-- Hibernate runs in validate mode (no auto-DDL). Each future change is a new V<n>__*.sql migration.

-- Certificate-number sequence (SG-YYYY-NNNNNN). Monotonic across restarts; gaps are acceptable.
CREATE SEQUENCE IF NOT EXISTS certificate_seq START WITH 1 INCREMENT BY 1;

-- The ledger. The full immutable DecisionRecord is kept as a JSON document in `payload`; the fields
-- compliance filters on are lifted into indexed columns. No update/delete happens against this table.
CREATE TABLE decision_records (
    record_id          uuid                        PRIMARY KEY,
    certificate_number varchar(255)                NOT NULL UNIQUE,
    branch_code        varchar(255),
    rm_id              varchar(255),
    verdict            varchar(255)                NOT NULL,
    created_at         timestamp(6) with time zone NOT NULL,
    payload            text                        NOT NULL
);

-- Indexes backing the compliance query paths (branch, RM, verdict, time).
CREATE INDEX idx_dr_branch  ON decision_records (branch_code);
CREATE INDEX idx_dr_rm      ON decision_records (rm_id);
CREATE INDEX idx_dr_verdict ON decision_records (verdict);
CREATE INDEX idx_dr_created ON decision_records (created_at);
