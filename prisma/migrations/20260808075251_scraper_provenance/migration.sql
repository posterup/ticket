-- CreateEnum
CREATE TYPE "ScrapeSource" AS ENUM ('davvvat', 'fidibo-art');

-- CreateEnum
CREATE TYPE "SourceVerification" AS ENUM ('pending', 'verified', 'conflict', 'rejected');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('active', 'missing', 'finished', 'cancelled');

-- CreateTable
CREATE TABLE "EventSource" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "source" "ScrapeSource" NOT NULL,
    "sourceEventId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "sourceStatus" "SourceStatus" NOT NULL DEFAULT 'active',
    "verificationStatus" "SourceVerification" NOT NULL DEFAULT 'pending',
    "verificationScore" INTEGER NOT NULL DEFAULT 0,
    "verificationErrors" JSONB NOT NULL DEFAULT '[]',
    "verifiedAt" TIMESTAMP(3),
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "priceCurrency" TEXT,
    "isFree" BOOLEAN,
    "priceText" TEXT,
    "externalTicketUrl" TEXT,
    "consecutiveMissingRuns" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSourceChange" (
    "id" TEXT NOT NULL,
    "eventSourceId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventSourceChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScrapeRun" (
    "id" TEXT NOT NULL,
    "source" "ScrapeSource" NOT NULL,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'running',
    "counters" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ScrapeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewItem" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventSource_eventId_idx" ON "EventSource"("eventId");

-- CreateIndex
CREATE INDEX "EventSource_source_sourceStatus_idx" ON "EventSource"("source", "sourceStatus");

-- CreateIndex
CREATE UNIQUE INDEX "EventSource_source_sourceEventId_key" ON "EventSource"("source", "sourceEventId");

-- CreateIndex
CREATE INDEX "EventSourceChange_eventSourceId_createdAt_idx" ON "EventSourceChange"("eventSourceId", "createdAt");

-- CreateIndex
CREATE INDEX "ScrapeRun_source_startedAt_idx" ON "ScrapeRun"("source", "startedAt");

-- CreateIndex
CREATE INDEX "ReviewItem_status_createdAt_idx" ON "ReviewItem"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "EventSource" ADD CONSTRAINT "EventSource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSourceChange" ADD CONSTRAINT "EventSourceChange_eventSourceId_fkey" FOREIGN KEY ("eventSourceId") REFERENCES "EventSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
