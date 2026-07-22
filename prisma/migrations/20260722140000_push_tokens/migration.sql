-- CreateTable: push_tokens (multi-device Expo push tokens per user)
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" VARCHAR(20),
    "lastUsedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
