import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const templateId = params.id;

  if (!templateId) {
    return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
  }

  try {
    const items = await prisma.templateItem.findMany({
      where: {
        templateId,
      },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error(`Failed to fetch items for template ${templateId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
