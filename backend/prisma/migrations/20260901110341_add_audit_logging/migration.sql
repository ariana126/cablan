-- CreateTable
CREATE TABLE "audit_log_entry" (
    "id" TEXT NOT NULL,
    "occurred_at" TIMESTAMPTZ NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_name" TEXT NOT NULL,
    "record_type" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "audit_log_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log_entry_change" (
    "id" TEXT NOT NULL,
    "audit_log_entry_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "previous_value" TEXT NOT NULL,
    "new_value" TEXT NOT NULL,

    CONSTRAINT "audit_log_entry_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_log_entry_occurred_at_idx" ON "audit_log_entry"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_log_entry_actor_name_idx" ON "audit_log_entry"("actor_name");

-- CreateIndex
CREATE INDEX "audit_log_entry_record_id_idx" ON "audit_log_entry"("record_id");

-- AddForeignKey
ALTER TABLE "audit_log_entry_change" ADD CONSTRAINT "audit_log_entry_change_audit_log_entry_id_fkey" FOREIGN KEY ("audit_log_entry_id") REFERENCES "audit_log_entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
