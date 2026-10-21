-- AlterTable
ALTER TABLE "bom" ADD COLUMN     "approval_status" TEXT NOT NULL DEFAULT 'unapproved',
ADD COLUMN     "approved_by" TEXT;
