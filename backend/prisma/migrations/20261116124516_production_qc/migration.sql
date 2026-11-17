-- CreateTable
CREATE TABLE "qc_activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "qc_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_assignment" (
    "equipment_id" TEXT NOT NULL,
    "qc_activity_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "qc_execution" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "qc_activity_id" TEXT NOT NULL,
    "performed_at" TIMESTAMPTZ(3) NOT NULL,
    "performed_by_id" TEXT NOT NULL,
    "performed_by_name" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "qc_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "qc_activity_name_key" ON "qc_activity"("name");

-- CreateIndex
CREATE INDEX "qc_assignment_qc_activity_id_idx" ON "qc_assignment"("qc_activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "qc_assignment_equipment_id_qc_activity_id_key" ON "qc_assignment"("equipment_id", "qc_activity_id");

-- CreateIndex
CREATE INDEX "qc_execution_equipment_id_qc_activity_id_performed_at_seque_idx" ON "qc_execution"("equipment_id", "qc_activity_id", "performed_at", "sequence");

-- CreateIndex
CREATE INDEX "qc_execution_qc_activity_id_idx" ON "qc_execution"("qc_activity_id");

-- CreateIndex
CREATE INDEX "qc_execution_performed_at_sequence_idx" ON "qc_execution"("performed_at", "sequence");

-- AddForeignKey
ALTER TABLE "qc_assignment" ADD CONSTRAINT "qc_assignment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_assignment" ADD CONSTRAINT "qc_assignment_qc_activity_id_fkey" FOREIGN KEY ("qc_activity_id") REFERENCES "qc_activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_execution" ADD CONSTRAINT "qc_execution_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_execution" ADD CONSTRAINT "qc_execution_qc_activity_id_fkey" FOREIGN KEY ("qc_activity_id") REFERENCES "qc_activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
