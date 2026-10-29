-- CreateTable
CREATE TABLE "equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "retired_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pm_plan_item" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "activity_id" TEXT NOT NULL,
    "activity_name" TEXT NOT NULL,
    "schedule" JSONB NOT NULL,
    "removed_at" TIMESTAMPTZ(3),

    CONSTRAINT "pm_plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "maintenance_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_execution" (
    "id" TEXT NOT NULL,
    "equipment_id" TEXT NOT NULL,
    "equipment_name" TEXT NOT NULL,
    "plan_item_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,
    "activity_name" TEXT NOT NULL,
    "due_date" DATE NOT NULL,
    "performed_at" TIMESTAMPTZ(3) NOT NULL,
    "performed_by_id" TEXT NOT NULL,
    "performed_by_name" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "maintenance_execution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipment_name_key" ON "equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pm_plan_item_equipment_id_position_key" ON "pm_plan_item"("equipment_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_activity_name_key" ON "maintenance_activity"("name");

-- CreateIndex
CREATE INDEX "maintenance_execution_equipment_id_idx" ON "maintenance_execution"("equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_execution_plan_item_id_due_date_key" ON "maintenance_execution"("plan_item_id", "due_date");

-- AddForeignKey
ALTER TABLE "pm_plan_item" ADD CONSTRAINT "pm_plan_item_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- One active item per activity in an equipment's plan: the backstop for
-- ActivityAlreadyInPmPlan. Hand-added, since Prisma's schema cannot express a
-- partial index. A removed item (removed_at set) frees its activity.
CREATE UNIQUE INDEX "pm_plan_item_active_activity_key" ON "pm_plan_item"("equipment_id", "activity_id") WHERE "removed_at" IS NULL;
