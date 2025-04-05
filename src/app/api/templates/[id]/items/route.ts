import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  // Indicate params might be a Promise based on potential Next.js behavior
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const resolvedParams = await params; // Await the params object
  const templateId = resolvedParams.id; // Access id from the resolved object

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
