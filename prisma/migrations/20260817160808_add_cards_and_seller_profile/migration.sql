-- AlterTable
ALTER TABLE "User" ADD COLUMN     "sellerBoilerplate" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "thumbnail" TEXT NOT NULL,
    "cardInfo" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "mountId" TEXT NOT NULL,
    "hasVerso" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
