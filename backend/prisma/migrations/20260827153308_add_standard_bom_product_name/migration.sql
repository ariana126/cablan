/*
  Warnings:

  - Added the required column `product_name` to the `standard_bom` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "standard_bom" ADD COLUMN     "product_name" TEXT NOT NULL;
