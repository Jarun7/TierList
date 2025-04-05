import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client' // Import PrismaClient

const prisma = new PrismaClient() // Instantiate PrismaClient

// Fetch items for a specific template using Prisma
export async function GET(
  request: Request, // Keep request parameter even if unused for potential future use
  { params }: { params: { id: string } } // 'id' here refers to the templateId
) {
  const templateId = params.id;

  if (!templateId) {
    return NextResponse.json({ error: 'Template ID is required' }, { status: 400 })
  }

  try {
    const items = await prisma.templateItem.findMany({
      where: {
        templateId: templateId, // Filter items by templateId
      },
      // Select specific fields if needed, otherwise Prisma returns all by default
      // select: {
      //   id: true,
      //   name: true,
      //   imageUrl: true,
      //   // Add other fields if the frontend needs them
      // }
    });

    // Prisma returns the data in the correct format based on the schema
    return NextResponse.json(items);

  } catch (error) {
    console.error(`Failed to fetch items for template ${templateId}:`, error);
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 });
  } finally {
    // Disconnect Prisma Client
    await prisma.$disconnect();
  }
}

// Note: You might add POST, PUT, DELETE handlers here later
// for managing items within a template if needed.