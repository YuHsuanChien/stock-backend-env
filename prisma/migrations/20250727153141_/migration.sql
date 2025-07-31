-- CreateTable
CREATE TABLE `stocks` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `symbol` VARCHAR(10) NOT NULL,
    `companyName` VARCHAR(255) NOT NULL,
    `industry` VARCHAR(100) NULL,
    `sector` VARCHAR(100) NULL,
    `ipoDate` DATE NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stocks_symbol_key`(`symbol`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_prices` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockId` INTEGER NOT NULL,
    `tradeDate` DATE NOT NULL,
    `open` DECIMAL(10, 4) NOT NULL,
    `high` DECIMAL(10, 4) NOT NULL,
    `low` DECIMAL(10, 4) NOT NULL,
    `close` DECIMAL(10, 4) NOT NULL,
    `adjustedClose` DECIMAL(10, 4) NOT NULL,
    `volume` BIGINT UNSIGNED NOT NULL,
    `dividend` DECIMAL(10, 4) NULL,
    `splitFactor` DECIMAL(10, 4) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `daily_prices_tradeDate_idx`(`tradeDate`),
    UNIQUE INDEX `daily_prices_stockId_tradeDate_key`(`stockId`, `tradeDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `financial_statements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockId` INTEGER NOT NULL,
    `reportDate` DATE NOT NULL,
    `reportType` VARCHAR(20) NOT NULL,
    `revenue` BIGINT UNSIGNED NOT NULL,
    `netIncome` BIGINT NOT NULL,
    `eps` DECIMAL(10, 4) NULL,
    `assets` BIGINT UNSIGNED NOT NULL,
    `liabilities` BIGINT UNSIGNED NOT NULL,
    `equity` BIGINT UNSIGNED NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `financial_statements_stockId_reportDate_reportType_key`(`stockId`, `reportDate`, `reportType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dividends_splits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockId` INTEGER NOT NULL,
    `exDate` DATE NOT NULL,
    `recordDate` DATE NULL,
    `paymentDate` DATE NULL,
    `dividendPerShare` DECIMAL(10, 4) NULL,
    `splitRatio` DECIMAL(10, 4) NULL,
    `eventType` VARCHAR(20) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `dividends_splits_stockId_exDate_eventType_key`(`stockId`, `exDate`, `eventType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `news_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `stockId` INTEGER NULL,
    `publishDate` DATETIME(3) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `url` VARCHAR(255) NULL,
    `source` VARCHAR(100) NULL,
    `contentSummary` TEXT NULL,
    `sentiment` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `news_events_publishDate_idx`(`publishDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `daily_prices` ADD CONSTRAINT `daily_prices_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `financial_statements` ADD CONSTRAINT `financial_statements_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dividends_splits` ADD CONSTRAINT `dividends_splits_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `news_events` ADD CONSTRAINT `news_events_stockId_fkey` FOREIGN KEY (`stockId`) REFERENCES `stocks`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
