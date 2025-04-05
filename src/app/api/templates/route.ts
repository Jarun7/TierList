import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client' // Import PrismaClient

const prisma = new PrismaClient() // Instantiate PrismaClient

// GET handler using Prisma
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchQuery = searchParams.get('q'); // Get search query param

    const templates = await prisma.template.findMany({
      where: {
        // Apply search filter if query exists
        ...(searchQuery && {
          name: {
            contains: searchQuery,
            mode: 'insensitive', // Case-insensitive search
          },
        }),
        // Filtering by is_public can be added here if needed later
        // is_public: true,
      },
      orderBy: {
        createdAt: 'desc', // Order by creation date descending
      },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  } finally {
    // Disconnect Prisma Client - Important in serverless environments
    await prisma.$disconnect();
  }
}

// POST handler using Prisma
export async function POST(request: Request) {
  try {
    // Parse body and extract expected fields
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Invalid request body: name is required and must be a string.' }, { status: 400 });
    }

    // Prepare data for Prisma insertion
    // Note: user_id association is removed for now, pending authentication implementation
    const insertData = {
      name: body.name,
      description: body.description || null, // Optional description
      is_public: typeof body.is_public === 'boolean' ? body.is_public : false, // Default to false
    };

    // Log the data being inserted
    console.log('Creating template with Prisma:', insertData);

    // Use Prisma Client to create the template
    const newTemplate = await prisma.template.create({
      data: insertData,
    });

    return NextResponse.json(newTemplate, { status: 201 }); // 201 Created status

  } catch (e: unknown) {
    // Handle potential JSON parsing errors or other errors
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body: Failed to parse JSON.' }, { status: 400 });
    }
    console.error("Failed to create template:", e);
    // Check for Prisma-specific errors if needed, e.g., unique constraint violation
    // if (e instanceof Prisma.PrismaClientKnownRequestError) { ... }
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  } finally {
    // Disconnect Prisma Client
    await prisma.$disconnect();
  }
}