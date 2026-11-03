-- AlterTable
ALTER TABLE "maintenance_activity" ADD COLUMN     "specialty" TEXT;

-- AlterTable
ALTER TABLE "maintenance_execution" ADD COLUMN     "operating_hours" DECIMAL(9,2);
