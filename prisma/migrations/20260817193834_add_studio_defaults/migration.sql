-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultHalo" DOUBLE PRECISION,
ADD COLUMN     "defaultLogoImage" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "defaultLogoText" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "defaultMountId" TEXT,
ADD COLUMN     "defaultReflect" DOUBLE PRECISION;
