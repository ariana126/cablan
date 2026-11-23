-- AlterTable
ALTER TABLE "qc_execution" ADD COLUMN     "submission_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "qc_execution_submission_id_qc_activity_id_key" ON "qc_execution"("submission_id", "qc_activity_id");
