-- CreateTable: camps
CREATE TABLE "camps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(200) NOT NULL,
    "tagline" VARCHAR(300),
    "description" TEXT,
    "venue" VARCHAR(300) NOT NULL,
    "address" VARCHAR(500),
    "city" VARCHAR(100),
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "startTime" TIMESTAMPTZ NOT NULL,
    "endTime" TIMESTAMPTZ NOT NULL,
    "organizer" VARCHAR(200),
    "contactPhone" VARCHAR(20),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "camps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "camps_startTime_idx" ON "camps"("startTime");
CREATE INDEX "camps_isActive_idx" ON "camps"("isActive");

-- CreateTable: camp_registrations
CREATE TABLE "camp_registrations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "campId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "camp_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "camp_registrations_campId_userId_key" ON "camp_registrations"("campId", "userId");
CREATE INDEX "camp_registrations_userId_idx" ON "camp_registrations"("userId");

-- AddForeignKey
ALTER TABLE "camp_registrations" ADD CONSTRAINT "camp_registrations_campId_fkey" FOREIGN KEY ("campId") REFERENCES "camps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "camp_registrations" ADD CONSTRAINT "camp_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
