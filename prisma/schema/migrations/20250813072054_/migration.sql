-- AlterTable
ALTER TABLE `daily_prices` MODIFY `open` DECIMAL(10, 4) NULL,
    MODIFY `high` DECIMAL(10, 4) NULL,
    MODIFY `low` DECIMAL(10, 4) NULL,
    MODIFY `close` DECIMAL(10, 4) NULL,
    MODIFY `volume` BIGINT UNSIGNED NULL;
