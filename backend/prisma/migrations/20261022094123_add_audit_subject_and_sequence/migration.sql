-- DropIndex
DROP INDEX "audit_log_entry_occurred_at_idx";

-- AlterTable
ALTER TABLE "audit_log_entry" ADD COLUMN     "sequence" SERIAL NOT NULL,
ADD COLUMN     "subject_field" TEXT,
ADD COLUMN     "subject_value" TEXT;

-- CreateIndex
CREATE INDEX "audit_log_entry_occurred_at_sequence_idx" ON "audit_log_entry"("occurred_at", "sequence");
