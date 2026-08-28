/*
  Warnings:

  - Added the required column `brand` to the `bom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `product_name` to the `bom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `registered_by` to the `bom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `standard_bom_mi_code` to the `bom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `standard_length` to the `bom` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bom" ADD COLUMN     "brand" TEXT NOT NULL,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "registered_by" TEXT NOT NULL,
ADD COLUMN     "standard_bom_mi_code" TEXT NOT NULL,
ADD COLUMN     "standard_length" DOUBLE PRECISION NOT NULL;
