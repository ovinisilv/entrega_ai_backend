-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryById" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_deliveryById_fkey" FOREIGN KEY ("deliveryById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
