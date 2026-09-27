-- CreateTable
CREATE TABLE "craving_sessions" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "craving_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "craving_votes" (
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "craving_votes_pkey" PRIMARY KEY ("sessionId","participantId","itemKey")
);

-- CreateIndex
CREATE INDEX "craving_sessions_expiresAt_idx" ON "craving_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "craving_votes_sessionId_itemKey_idx" ON "craving_votes"("sessionId", "itemKey");

-- AddForeignKey
ALTER TABLE "craving_sessions" ADD CONSTRAINT "craving_sessions_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "craving_votes" ADD CONSTRAINT "craving_votes_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "craving_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
