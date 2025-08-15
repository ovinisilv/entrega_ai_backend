-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF_CNPJ', 'EMAIL', 'CELULAR', 'ALEATORIA');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryConfirmationCode" TEXT,
ADD COLUMN     "deliveryDistance" DOUBLE PRECISION,
ADD COLUMN     "deliveryFee" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pixKey" TEXT,
ADD COLUMN     "pixKeyType" "PixKeyType";
