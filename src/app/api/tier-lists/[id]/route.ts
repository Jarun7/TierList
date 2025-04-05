import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server' // Use server client
import { Database, Json } from '@/types/database.types' // Import Json type

type TierListUpdate = Database['public']['Tables']['tier_lists']['Update'];

// Helper function to check ownership
async function checkOwnership(supabase: ReturnType<typeof createClient>, listId: string, userId: string): Promise<boolean> {
   const { data, error } = await supabase
    .from('tier_lists')
    .select('user_id')
    .eq('id', listId)
    .single();

  if (error || !data) {
    console.error(`Ownership check failed for list ${listId}:`, error);
    return false; // Error occurred or list not found
  }
  return data.user_id === userId;
}


// GET: Fetch details of a specific saved tier list
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const listId = params.id;

  // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch the list, ensuring it belongs to the user
  const { data, error } = await supabase
    .from('tier_lists')
    .select('*') // Select all details including the 'data' field
    .eq('id', listId)
    .eq('user_id', user.id) // Ensure ownership
    .single(); // Expect only one result

  if (error) {
     if (error.code === 'PGRST116') { // PostgREST code for "Resource not found or ambiguity"
        return NextResponse.json({ error: 'Tier list not found or access denied.' }, { status: 404 })
     }
    console.error(`Supabase GET tier_lists/${listId} error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}


// PUT: Update an existing saved tier list
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const listId = params.id;

   // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check ownership first
  const isOwner = await checkOwnership(supabase, listId, user.id);
  if (!isOwner) {
     return NextResponse.json({ error: 'Forbidden: You do not own this tier list.' }, { status: 403 })
  }

  // Parse request body
  // Expecting { name?: string | null, data?: Json, is_public?: boolean }
  let parsedBody: { name?: string | null; data?: Json; is_public?: boolean };
   try {
    parsedBody = await request.json();
    // Allow updating 'name', 'data', and 'is_public'
    if (parsedBody.name === undefined && parsedBody.data === undefined && parsedBody.is_public === undefined) {
        return NextResponse.json({ error: 'Invalid request body: Provide name and/or data to update.' }, { status: 400 })
    }
     // TODO: Validate the structure of updateData.data if provided
  } catch (_e) {
    return NextResponse.json({ error: 'Invalid request body: Failed to parse JSON.' }, { status: 400 })
  }

   // Prepare payload (only include fields that are provided and allowed to be updated)
   const updatePayload: TierListUpdate = {};
   if (parsedBody.name !== undefined) updatePayload.name = parsedBody.name;
   if (parsedBody.data !== undefined) updatePayload.data = parsedBody.data;
   if (parsedBody.is_public !== undefined) updatePayload.is_public = parsedBody.is_public;
   // updatePayload.updated_at = new Date().toISOString(); // Let DB handle this?

  // Perform update
  const { data, error } = await supabase
    .from('tier_lists')
    .update(updatePayload)
    .eq('id', listId)
    // .eq('user_id', user.id) // Ownership already checked
    .select() // Return the updated record

   if (error) {
    console.error(`Supabase PUT tier_lists/${listId} error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}


// DELETE: Delete a saved tier list
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const listId = params.id;

   // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

   // Check ownership first
  const isOwner = await checkOwnership(supabase, listId, user.id);
  if (!isOwner) {
     return NextResponse.json({ error: 'Forbidden: You do not own this tier list.' }, { status: 403 })
  }

  // Perform delete
  const { error } = await supabase
    .from('tier_lists')
    .delete()
    .eq('id', listId)
    // .eq('user_id', user.id) // Ownership already checked

   if (error) {
    console.error(`Supabase DELETE tier_lists/${listId} error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return success response, no content
  return new Response(null, { status: 204 })
}