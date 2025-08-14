/*
  Warnings:

  - You are about to drop the column `adjustedClose` on the `daily_prices` table. All the data in the column will be lost.
  - You are about to drop the column `dividend` on the `daily_prices` table. All the data in the column will be lost.
  - You are about to drop the column `splitFactor` on the `daily_prices` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `daily_prices` DROP COLUMN `adjustedClose`,
    DROP COLUMN `dividend`,
    DROP COLUMN `splitFactor`;
