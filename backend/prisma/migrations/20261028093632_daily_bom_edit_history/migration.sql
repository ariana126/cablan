-- AlterTable
ALTER TABLE "bom" ADD COLUMN     "edit_history" JSONB NOT NULL DEFAULT '[]';
