-- AlterTable
ALTER TABLE "bom" ADD COLUMN     "registration_sequence" SERIAL NOT NULL;

-- CreateIndex
CREATE INDEX "bom_tracking_number_created_at_registration_sequence_idx" ON "bom"("tracking_number", "created_at", "registration_sequence");
