-- Issue #110: equipment can be retired and reactivated any number of times,
-- so its single `retired_at` becomes a list of service breaks.

-- CreateTable
CREATE TABLE "equipment_service_break" (
    "equipment_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "retired_at" TIMESTAMPTZ(3) NOT NULL,
    "reactivated_at" TIMESTAMPTZ(3),

    CONSTRAINT "equipment_service_break_pkey" PRIMARY KEY ("equipment_id","position")
);

-- AddForeignKey
ALTER TABLE "equipment_service_break" ADD CONSTRAINT "equipment_service_break_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Amended at creation: Prisma drafted a bare DROP COLUMN, which would have
-- discarded every retirement. Each retired equipment's `retired_at` becomes
-- its first, still open, service break before the column goes.
INSERT INTO "equipment_service_break" ("equipment_id", "position", "retired_at", "reactivated_at")
SELECT "id", 0, "retired_at", NULL
FROM "equipment"
WHERE "retired_at" IS NOT NULL;

-- AlterTable
ALTER TABLE "equipment" DROP COLUMN "retired_at";
