-- CreateEnum
CREATE TYPE "SectionKind" AS ENUM ('seated', 'standing');

-- CreateEnum
CREATE TYPE "SeatState" AS ENUM ('sold', 'blocked');

-- CreateEnum
CREATE TYPE "SeatKind" AS ENUM ('standard', 'wheelchair', 'companion', 'obstructed', 'house');

-- AlterTable
ALTER TABLE "EventSession" ADD COLUMN     "layoutVersionId" TEXT;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "seatId" TEXT;

-- CreateTable
CREATE TABLE "VenueLayout" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "draft" JSONB NOT NULL,
    "publishedVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueLayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueLayoutVersion" (
    "id" TEXT NOT NULL,
    "layoutId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "spec" JSONB NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueLayoutVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueSection" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "SectionKind" NOT NULL DEFAULT 'seated',
    "shape" JSONB NOT NULL,
    "color" TEXT NOT NULL,
    "labelX" DOUBLE PRECISION NOT NULL,
    "labelY" DOUBLE PRECISION NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "seatCount" INTEGER NOT NULL DEFAULT 0,
    "seatBlob" JSONB,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VenueSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueRow" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "seatCount" INTEGER NOT NULL,

    CONSTRAINT "VenueRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueSeat" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "kind" "SeatKind" NOT NULL DEFAULT 'standard',

    CONSTRAINT "VenueSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatStatus" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "state" "SeatState" NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatHold" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "holderKey" TEXT NOT NULL,
    "orderId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeatHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionSectionPricing" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "ticketTypeId" TEXT NOT NULL,

    CONSTRAINT "SessionSectionPricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueLayout_venueId_key" ON "VenueLayout"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueLayoutVersion_layoutId_version_key" ON "VenueLayoutVersion"("layoutId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "VenueSection_versionId_key_key" ON "VenueSection"("versionId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "VenueRow_sectionId_key_key" ON "VenueRow"("sectionId", "key");

-- CreateIndex
CREATE INDEX "VenueSeat_rowId_idx" ON "VenueSeat"("rowId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueSeat_sectionId_index_key" ON "VenueSeat"("sectionId", "index");

-- CreateIndex
CREATE INDEX "SeatStatus_sessionId_idx" ON "SeatStatus"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SeatStatus_sessionId_seatId_key" ON "SeatStatus"("sessionId", "seatId");

-- CreateIndex
CREATE INDEX "SeatHold_expiresAt_idx" ON "SeatHold"("expiresAt");

-- CreateIndex
CREATE INDEX "SeatHold_sessionId_holderKey_idx" ON "SeatHold"("sessionId", "holderKey");

-- CreateIndex
CREATE UNIQUE INDEX "SeatHold_sessionId_seatId_key" ON "SeatHold"("sessionId", "seatId");

-- CreateIndex
CREATE INDEX "SessionSectionPricing_eventId_idx" ON "SessionSectionPricing"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionSectionPricing_eventId_sectionId_key" ON "SessionSectionPricing"("eventId", "sectionId");

-- AddForeignKey
ALTER TABLE "EventSession" ADD CONSTRAINT "EventSession_layoutVersionId_fkey" FOREIGN KEY ("layoutVersionId") REFERENCES "VenueLayoutVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "VenueSeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueLayout" ADD CONSTRAINT "VenueLayout_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueLayoutVersion" ADD CONSTRAINT "VenueLayoutVersion_layoutId_fkey" FOREIGN KEY ("layoutId") REFERENCES "VenueLayout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueSection" ADD CONSTRAINT "VenueSection_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "VenueLayoutVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueRow" ADD CONSTRAINT "VenueRow_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VenueSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueSeat" ADD CONSTRAINT "VenueSeat_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VenueSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueSeat" ADD CONSTRAINT "VenueSeat_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "VenueRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatStatus" ADD CONSTRAINT "SeatStatus_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatStatus" ADD CONSTRAINT "SeatStatus_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "VenueSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatStatus" ADD CONSTRAINT "SeatStatus_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "EventSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "VenueSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatHold" ADD CONSTRAINT "SeatHold_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSectionPricing" ADD CONSTRAINT "SessionSectionPricing_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSectionPricing" ADD CONSTRAINT "SessionSectionPricing_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "VenueSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionSectionPricing" ADD CONSTRAINT "SessionSectionPricing_ticketTypeId_fkey" FOREIGN KEY ("ticketTypeId") REFERENCES "TicketType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
