-- CreateTable
CREATE TABLE `TestSession` (
    `id` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `mode` ENUM('PASSAGE', 'TIMED') NOT NULL,
    `passageKey` VARCHAR(64) NULL,
    `text` TEXT NOT NULL,
    `difficulty` VARCHAR(16) NULL,
    `duration` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `submittedAt` DATETIME(3) NULL,
    `typedLength` INTEGER NULL,
    `correctChars` INTEGER NULL,
    `incorrectChars` INTEGER NULL,
    `elapsedMs` INTEGER NULL,
    `wpm` DOUBLE NULL,
    `rawWpm` DOUBLE NULL,
    `accuracy` DOUBLE NULL,
    `status` ENUM('STARTED', 'SUBMITTED', 'REJECTED') NOT NULL DEFAULT 'STARTED',
    `rejectReason` VARCHAR(255) NULL,

    INDEX `TestSession_clientId_createdAt_idx`(`clientId`, `createdAt`),
    INDEX `TestSession_status_expiresAt_idx`(`status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
