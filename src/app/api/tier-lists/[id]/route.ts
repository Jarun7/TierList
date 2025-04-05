import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { Database, Json } from '@/types/database.types'

type TierListUpdate = Database['public']['Tables']['tier_lists']['Update']

// Ownership check helper
async function checkOwnership(
  supabase: ReturnType<typeof createClient>,
  listId: string,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('tier_lists')
    .select('user_id')
    .eq('id', listId)
    .single()

  if (error || !data) {
    console.error(`Ownership check failed for list ${listId}:`, error)
    return false
  }
  return data.user_id === userId
}

// GET: Fetch details of a specific saved tier list
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: listId } = await context.params
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('tier_lists')
    .select('*')
    .eq('id', listId)
    .eq('user_id', user.id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
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
  context: { params: Promise<{ id: string }> }
) {
  const { id: listId } = await context.params
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isOwner = await checkOwnership(supabase, listId, user.id)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden: You do not own this tier list.' }, { status: 403 })
  }

  let parsedBody: { name?: string | null; data?: Json; is_public?: boolean }
  try {
    parsedBody = await request.json()
    if (
      parsedBody.name === undefined &&
      parsedBody.data === undefined &&
      parsedBody.is_public === undefined
    ) {
      return NextResponse.json({ error: 'Invalid request body: Provide name and/or data to update.' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body: Failed to parse JSON.' }, { status: 400 })
  }

  const updatePayload: TierListUpdate = {}
  if (parsedBody.name !== undefined) updatePayload.name = parsedBody.name
  if (parsedBody.data !== undefined) updatePayload.data = parsedBody.data
  if (parsedBody.is_public !== undefined) updatePayload.is_public = parsedBody.is_public

  const { data, error } = await supabase
    .from('tier_lists')
    .update(updatePayload)
    .eq('id', listId)
    .select()

  if (error) {
    console.error(`Supabase PUT tier_lists/${listId} error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

// DELETE: Delete a saved tier list
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id: listId } = await context.params
  const supabase = createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const isOwner = await checkOwnership(supabase, listId, user.id)
  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden: You do not own this tier list.' }, { status: 403 })
  }

  const { error } = await supabase
    .from('tier_lists')
    .delete()
    .eq('id', listId)

  if (error) {
    console.error(`Supabase DELETE tier_lists/${listId} error:`, error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
