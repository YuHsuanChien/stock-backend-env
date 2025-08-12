/*
  Warnings:

  - You are about to drop the column `sector` on the `stocks` table. All the data in the column will be lost.
  - Added the required column `market` to the `stocks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `stocks` DROP COLUMN `sector`,
    ADD COLUMN `market` VARCHAR(50) NOT NULL;
