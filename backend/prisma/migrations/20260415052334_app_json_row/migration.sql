-- CreateTable
CREATE TABLE "AppJsonRow" (
    "collection" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("collection", "entityId")
);
