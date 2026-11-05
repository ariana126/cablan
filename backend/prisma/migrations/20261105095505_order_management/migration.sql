-- CreateTable
CREATE TABLE "bom_order" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bom_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bom_order_mi_code" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "standard_bom_id" TEXT NOT NULL,
    "mi_code" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bom_order_mi_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bom_order_order_number_key" ON "bom_order"("order_number");

-- CreateIndex
CREATE INDEX "bom_order_mi_code_standard_bom_id_idx" ON "bom_order_mi_code"("standard_bom_id");

-- CreateIndex
CREATE INDEX "bom_order_mi_code_product_id_idx" ON "bom_order_mi_code"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "bom_order_mi_code_order_id_standard_bom_id_key" ON "bom_order_mi_code"("order_id", "standard_bom_id");

-- AddForeignKey
ALTER TABLE "bom_order_mi_code" ADD CONSTRAINT "bom_order_mi_code_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "bom_order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
