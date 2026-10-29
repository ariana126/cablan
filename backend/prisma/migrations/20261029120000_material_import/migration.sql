-- CreateTable
CREATE TABLE "material_import" (
    "id" TEXT NOT NULL,
    "imported_at" TIMESTAMPTZ NOT NULL,
    "reverted_at" TIMESTAMPTZ,
    "sequence" SERIAL NOT NULL,

    CONSTRAINT "material_import_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_import_change" (
    "id" TEXT NOT NULL,
    "material_import_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "previous_name" TEXT,
    "previous_code" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "material_import_change_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_import_imported_at_sequence_idx" ON "material_import"("imported_at", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "material_import_change_material_import_id_position_key" ON "material_import_change"("material_import_id", "position");

-- AddForeignKey
ALTER TABLE "material_import_change" ADD CONSTRAINT "material_import_change_material_import_id_fkey" FOREIGN KEY ("material_import_id") REFERENCES "material_import"("id") ON DELETE CASCADE ON UPDATE CASCADE;
