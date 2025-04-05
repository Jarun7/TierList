import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Use 'any' as a workaround to avoid TS complaining about Promise in context
export async function GET(
  req: Request,
  context: any // <- workaround!
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
  }

  try {
    const items = await prisma.templateItem.findMany({
      where: { templateId: id },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error(`Failed to fetch items for template ${id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
