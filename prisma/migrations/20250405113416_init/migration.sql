-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "TemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TierDefinition" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "TierDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_createdAt_idx" ON "Template"("createdAt");

-- CreateIndex
CREATE INDEX "TemplateItem_templateId_idx" ON "TemplateItem"("templateId");

-- CreateIndex
CREATE INDEX "TierDefinition_templateId_idx" ON "TierDefinition"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TierDefinition_templateId_order_key" ON "TierDefinition"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "TierDefinition_templateId_label_key" ON "TierDefinition"("templateId", "label");

-- AddForeignKey
ALTER TABLE "TemplateItem" ADD CONSTRAINT "TemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TierDefinition" ADD CONSTRAINT "TierDefinition_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
