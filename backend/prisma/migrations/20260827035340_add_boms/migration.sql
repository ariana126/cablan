-- CreateTable
CREATE TABLE "bom" (
    "id" TEXT NOT NULL,
    "standard_bom_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_component" (
    "id" TEXT NOT NULL,
    "bom_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "bom_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_material" (
    "id" TEXT NOT NULL,
    "bom_component_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "bom_material_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bom_component" ADD CONSTRAINT "bom_component_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bom_material" ADD CONSTRAINT "bom_material_bom_component_id_fkey" FOREIGN KEY ("bom_component_id") REFERENCES "bom_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
