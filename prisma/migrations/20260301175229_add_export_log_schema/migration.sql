/*
  Warnings:

  - You are about to drop the `UserArchive` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE IF EXISTS "UserArchive";

-- CreateTable
CREATE TABLE "TrafficLog" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "sourceIp" TEXT NOT NULL,
    "sourcePort" TEXT NOT NULL,
    "destinationUrl" TEXT NOT NULL,
    "destinationPort" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "method" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "action" TEXT NOT NULL,

    CONSTRAINT "TrafficLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogExportAdmin" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminUsername" TEXT,
    "adminRole" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT,
    "exportedDataType" TEXT NOT NULL,
    "dataScope" TEXT,
    "fileFormat" TEXT NOT NULL,
    "rowCount" INTEGER,
    "securityMeasure" TEXT,
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LogExportAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LogExportAdmin_adminId_idx" ON "LogExportAdmin"("adminId");

-- CreateIndex
CREATE INDEX "LogExportAdmin_createdAt_idx" ON "LogExportAdmin"("createdAt");

-- CreateIndex
CREATE INDEX "LogExportAdmin_exportedDataType_idx" ON "LogExportAdmin"("exportedDataType");

-- CreateIndex
CREATE INDEX "LogExportAdmin_expiresAt_idx" ON "LogExportAdmin"("expiresAt");
