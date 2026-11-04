-- This migration extends the existing MariaDB/MySQL schema created by the
-- 20261017 migrations. It preserves users, password hashes, refresh-token
-- verifiers, reset-token verifiers, and typing history in place.

-- CreateTable
CREATE TABLE `Role` (
    `name` ENUM('ROLE_USER', 'ROLE_ADMIN') NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRoleAssignment` (
    `userId` CHAR(36) NOT NULL,
    `roleName` ENUM('ROLE_USER', 'ROLE_ADMIN') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserRoleAssignment_roleName_idx`(`roleName`),
    PRIMARY KEY (`userId`, `roleName`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Add columns before backfilling values from the legacy User model.
ALTER TABLE `User`
    ADD COLUMN `normalizedEmail` VARCHAR(254) NULL,
    ADD COLUMN `status` ENUM('PENDING_VERIFICATION', 'ACTIVE', 'LOCKED', 'DISABLED', 'DELETED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    ADD COLUMN `failedLoginAttempts` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL,
    ADD COLUMN `credentialsChangedAt` DATETIME(3) NULL,
    ADD COLUMN `securityVersion` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
    ADD COLUMN `deletedAt` DATETIME(3) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

UPDATE `User`
SET
    `normalizedEmail` = LOWER(TRIM(`email`)),
    `status` = CASE
        WHEN `emailVerifiedAt` IS NULL THEN 'PENDING_VERIFICATION'
        ELSE 'ACTIVE'
    END,
    `credentialsChangedAt` = `createdAt`;

ALTER TABLE `User`
    MODIFY COLUMN `normalizedEmail` VARCHAR(254) NOT NULL,
    MODIFY COLUMN `credentialsChangedAt` DATETIME(3) NOT NULL,
    ADD UNIQUE INDEX `User_normalizedEmail_key`(`normalizedEmail`),
    ADD INDEX `User_status_lockedUntil_idx`(`status`, `lockedUntil`),
    ADD INDEX `User_deletedAt_idx`(`deletedAt`);

INSERT INTO `Role` (`name`, `description`) VALUES
    ('ROLE_USER', 'Standard application user'),
    ('ROLE_ADMIN', 'Application administrator');

INSERT INTO `UserRoleAssignment` (`userId`, `roleName`)
SELECT
    `id`,
    CASE WHEN `role` = 'ADMIN' THEN 'ROLE_ADMIN' ELSE 'ROLE_USER' END
FROM `User`;

ALTER TABLE `User` DROP COLUMN `role`;

-- Create a stable logical session for each existing refresh-token family.
-- Legacy active tokens remain usable after migration; rotated/revoked history
-- becomes explicit for replay detection.
CREATE TABLE `Session` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `familyId` CHAR(36) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `revocationReason` VARCHAR(80) NULL,
    `deviceLabel` VARCHAR(120) NULL,
    `userAgent` VARCHAR(512) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Session_familyId_key`(`familyId`),
    INDEX `Session_userId_revokedAt_expiresAt_idx`(`userId`, `revokedAt`, `expiresAt`),
    INDEX `Session_familyId_revokedAt_idx`(`familyId`, `revokedAt`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    INDEX `Session_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `Session` (
    `id`, `userId`, `familyId`, `createdAt`, `lastActivityAt`, `expiresAt`,
    `revokedAt`, `revocationReason`, `deviceLabel`, `userAgent`, `ipAddress`, `version`
)
SELECT
    UUID(),
    `userId`,
    `familyId`,
    MIN(`createdAt`),
    MAX(`createdAt`),
    MAX(`expiresAt`),
    CASE
        WHEN SUM(CASE WHEN `revokedAt` IS NULL THEN 1 ELSE 0 END) = 0
        THEN MAX(`revokedAt`)
        ELSE NULL
    END,
    CASE
        WHEN SUM(CASE WHEN `revokedAt` IS NULL THEN 1 ELSE 0 END) = 0
        THEN 'LEGACY_REVOKED'
        ELSE NULL
    END,
    NULL,
    MAX(`userAgent`),
    MAX(`ipAddress`),
    1
FROM `RefreshToken`
GROUP BY `userId`, `familyId`;

ALTER TABLE `RefreshToken`
    ADD COLUMN `sessionId` CHAR(36) NULL,
    ADD COLUMN `status` ENUM('ACTIVE', 'ROTATED', 'REVOKED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `usedAt` DATETIME(3) NULL,
    ADD COLUMN `revocationReason` VARCHAR(80) NULL,
    ADD COLUMN `version` INTEGER NOT NULL DEFAULT 1;

UPDATE `RefreshToken` `token`
INNER JOIN `Session` `session`
    ON `session`.`userId` = `token`.`userId`
   AND `session`.`familyId` = `token`.`familyId`
SET
    `token`.`sessionId` = `session`.`id`,
    `token`.`status` = CASE
        WHEN `token`.`revokedAt` IS NOT NULL THEN 'REVOKED'
        WHEN `token`.`replacedByTokenId` IS NOT NULL THEN 'ROTATED'
        ELSE 'ACTIVE'
    END,
    `token`.`usedAt` = CASE
        WHEN `token`.`replacedByTokenId` IS NOT NULL THEN `token`.`createdAt`
        ELSE NULL
    END,
    `token`.`revocationReason` = CASE
        WHEN `token`.`revokedAt` IS NOT NULL THEN 'LEGACY_REVOKED'
        ELSE NULL
    END;

ALTER TABLE `RefreshToken`
    MODIFY COLUMN `sessionId` CHAR(36) NOT NULL,
    DROP FOREIGN KEY `RefreshToken_userId_fkey`,
    DROP INDEX `RefreshToken_userId_createdAt_idx`,
    DROP INDEX `RefreshToken_familyId_idx`,
    DROP COLUMN `userId`,
    DROP COLUMN `userAgent`,
    DROP COLUMN `ipAddress`,
    ADD INDEX `RefreshToken_sessionId_status_expiresAt_idx`(`sessionId`, `status`, `expiresAt`),
    ADD INDEX `RefreshToken_familyId_status_idx`(`familyId`, `status`);

-- The existing token-hash, replacement, and expiry indexes are retained.

ALTER TABLE `PasswordResetToken`
    CHANGE COLUMN `usedAt` `consumedAt` DATETIME(3) NULL,
    DROP INDEX `PasswordResetToken_userId_expiresAt_idx`,
    ADD INDEX `PasswordResetToken_userId_consumedAt_expiresAt_idx`(`userId`, `consumedAt`, `expiresAt`),
    ADD INDEX `PasswordResetToken_expiresAt_idx`(`expiresAt`);

-- CreateTable
CREATE TABLE `EmailVerificationToken` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` CHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `EmailVerificationToken_tokenHash_key`(`tokenHash`),
    INDEX `EmailVerificationToken_userId_consumedAt_expiresAt_idx`(`userId`, `consumedAt`, `expiresAt`),
    INDEX `EmailVerificationToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SecurityAuditEvent` (
    `id` CHAR(36) NOT NULL,
    `eventType` VARCHAR(80) NOT NULL,
    `userId` CHAR(36) NULL,
    `sessionId` CHAR(36) NULL,
    `requestId` VARCHAR(80) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(512) NULL,
    `outcome` VARCHAR(32) NOT NULL,
    `metadata` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SecurityAuditEvent_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `SecurityAuditEvent_sessionId_createdAt_idx`(`sessionId`, `createdAt`),
    INDEX `SecurityAuditEvent_eventType_createdAt_idx`(`eventType`, `createdAt`),
    INDEX `SecurityAuditEvent_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationOutbox` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `kind` VARCHAR(80) NOT NULL,
    `recipient` VARCHAR(254) NOT NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `availableAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,
    `lastError` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NotificationOutbox_status_availableAt_createdAt_idx`(`status`, `availableAt`, `createdAt`),
    INDEX `NotificationOutbox_status_updatedAt_idx`(`status`, `updatedAt`),
    INDEX `NotificationOutbox_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRoleAssignment` ADD CONSTRAINT `UserRoleAssignment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `UserRoleAssignment` ADD CONSTRAINT `UserRoleAssignment_roleName_fkey` FOREIGN KEY (`roleName`) REFERENCES `Role`(`name`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RefreshToken` ADD CONSTRAINT `RefreshToken_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `EmailVerificationToken` ADD CONSTRAINT `EmailVerificationToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `SecurityAuditEvent` ADD CONSTRAINT `SecurityAuditEvent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `SecurityAuditEvent` ADD CONSTRAINT `SecurityAuditEvent_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Session`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `NotificationOutbox` ADD CONSTRAINT `NotificationOutbox_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
