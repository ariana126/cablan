-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_component" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "product_component_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_material" (
    "id" TEXT NOT NULL,
    "product_component_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "product_material_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "product_component" ADD CONSTRAINT "product_component_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_material" ADD CONSTRAINT "product_material_product_component_id_fkey" FOREIGN KEY ("product_component_id") REFERENCES "product_component"("id") ON DELETE CASCADE ON UPDATE CASCADE;
