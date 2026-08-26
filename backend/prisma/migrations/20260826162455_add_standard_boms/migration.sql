-- CreateTable
CREATE TABLE "standard_bom" (
    "id" TEXT NOT NULL,
    "mi_code" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "standard_length" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL,
    "description" TEXT,
    "product_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "standard_bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_bom_component" (
    "id" TEXT NOT NULL,
    "standard_bom_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "standard_bom_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "standard_bom_material" (
    "id" TEXT NOT NULL,
    "standard_bom_component_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "standard_bom_material_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "standard_bom_mi_code_key" ON "standard_bom"("mi_code");

-- AddForeignKey
ALTER TABLE "standard_bom_component" ADD CONSTRAINT "standard_bom_component_standard_bom_id_fkey" FOREIGN KEY ("standard_bom_id") REFERENCES "standard_bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "standard_bom_material" ADD CONSTRAINT "standard_bom_material_standard_bom_component_id_fkey" FOREIGN KEY ("standard_bom_component_id") REFERENCES "standard_bom_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
