-- Nullable keeps all existing and manually-created notifications compatible.
ALTER TABLE "notifications"
ADD COLUMN "deduplication_key" TEXT;

CREATE UNIQUE INDEX "notifications_deduplication_key_key"
ON "notifications"("deduplication_key");
