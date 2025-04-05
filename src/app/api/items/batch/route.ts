import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client' // Import PrismaClient

const prisma = new PrismaClient() // Instantiate PrismaClient

// Define the expected structure for items in the request body
interface ItemPayload {
  templateId: string; // Changed from template_id
  imageUrl: string;   // Changed from content
  name: string;       // Added name field
}

export async function POST(request: Request) {
  try {
    // 1. Parse request body (expecting an array of ItemPayload objects)
    const itemsPayload: ItemPayload[] = await request.json();

    if (!Array.isArray(itemsPayload) || itemsPayload.length === 0) {
      return NextResponse.json({ error: 'Invalid request body: Expected a non-empty array of items.' }, { status: 400 })
    }

    // 2. Basic validation for each item
    for (const item of itemsPayload) {
      if (!item.templateId || typeof item.templateId !== 'string' ||
          !item.imageUrl || typeof item.imageUrl !== 'string' ||
          !item.name || typeof item.name !== 'string') {
         return NextResponse.json({ error: 'Invalid item format: Each item must have templateId (string), imageUrl (string), and name (string).' }, { status: 400 })
      }
      // TODO: Add authorization check later - does the user own the templateId?
    }

    // 3. Prepare data for Prisma's createMany
    // Note: Prisma's createMany usually doesn't return the created records by default.
    // We map the payload to match the Prisma schema field names.
    const dataToInsert = itemsPayload.map(item => ({
      templateId: item.templateId,
      imageUrl: item.imageUrl,
      name: item.name,
    }));

    // 4. Perform batch insert using Prisma Client
    const result = await prisma.templateItem.createMany({
      data: dataToInsert,
      skipDuplicates: true, // Optional: useful if you might send the same item multiple times
    });

    // createMany returns a count object, e.g., { count: number }
    console.log(`Successfully created ${result.count} items.`);

    // Since createMany doesn't return the records, we return the count or a success message.
    // If you need the created records, you'd have to fetch them separately or create them one by one (less efficient).
    return NextResponse.json({ message: `Successfully created ${result.count} items.`, count: result.count }, { status: 201 });

  } catch (e: unknown) {
     if (e instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid request body: Failed to parse JSON.' }, { status: 400 });
    }
    console.error('Failed to batch create items:', e);
    // Add more specific Prisma error handling if needed
    return NextResponse.json({ error: 'Failed to create items' }, { status: 500 });
  } finally {
    // Disconnect Prisma Client
    await prisma.$disconnect();
  }
}