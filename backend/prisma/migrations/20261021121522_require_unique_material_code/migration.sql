-- AlterTable
ALTER TABLE "material" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "material_code_key" ON "material"("code");

