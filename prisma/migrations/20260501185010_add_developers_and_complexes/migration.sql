-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "buildingType" TEXT,
ADD COLUMN     "developerId" INTEGER,
ADD COLUMN     "housingClass" TEXT,
ADD COLUMN     "residentialComplexId" INTEGER;

-- CreateTable
CREATE TABLE "developers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "developers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "residential_complexes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "developerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "residential_complexes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "developers_name_key" ON "developers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "residential_complexes_name_developerId_key" ON "residential_complexes"("name", "developerId");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_residentialComplexId_fkey" FOREIGN KEY ("residentialComplexId") REFERENCES "residential_complexes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "residential_complexes" ADD CONSTRAINT "residential_complexes_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "developers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
