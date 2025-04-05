import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server' // Use server client
import { Database, Json } from '@/types/database.types' // Import Json type

type TierListInsert = Database['public']['Tables']['tier_lists']['Insert'];

// GET: Fetch saved tier lists
export async function GET(request: Request) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const scope = searchParams.get('scope') // Check for 'public' scope
  const templateId = searchParams.get('template_id') // Existing filter

  if (scope === 'public') {
    // Fetch public lists, optionally filtered by template_id
    let query = supabase
      .from('tier_lists')
      .select('id, name, template_id, updated_at') // Maybe fetch associated template name too?
      .eq('is_public', true)

    if (templateId) {
      query = query.eq('template_id', templateId)
    }
     query = query.order('updated_at', { ascending: false })

     const { data, error } = await query;
     if (error) {
       console.error('Supabase GET public tier_lists error:', error)
       return NextResponse.json({ error: error.message }, { status: 500 })
     }
     return NextResponse.json(data)

  } else {
    // Default: Fetch logged-in user's private lists
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized: Login required to view your lists.' }, { status: 401 })
  }

    // Fetch user's lists, optionally filtered by template_id
    let query = supabase
      .from('tier_lists')
      .select('id, name, template_id, updated_at, is_public') // Include is_public status
    .eq('user_id', user.id)

  if (templateId) {
    query = query.eq('template_id', templateId)
  }

  query = query.order('updated_at', { ascending: false }) // Order by most recently updated

  const { data, error } = await query;

  if (error) {
    console.error('Supabase GET tier_lists error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

    return NextResponse.json(data)
  }
}


// POST: Save a new tier list arrangement
export async function POST(request: Request) {
  const supabase = createClient()

  // Check user authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  // Expecting { template_id: string, data: Json, name?: string | null, is_public?: boolean }
  let parsedBody: { template_id: string; data: Json; name?: string | null; is_public?: boolean };
  try {
    parsedBody = await request.json();
    if (!parsedBody.template_id || !parsedBody.data) {
       return NextResponse.json({ error: 'Invalid request body: template_id and data are required.' }, { status: 400 })
    }
    // TODO: Validate the structure of listData.data (should match container state)
  } catch (e) {
    return NextResponse.json({ error: 'Invalid request body: Failed to parse JSON.' }, { status: 400 })
  }

  // Prepare data for insertion, defaulting is_public to false
  const insertPayload: TierListInsert = {
    template_id: parsedBody.template_id,
    data: parsedBody.data,
    name: parsedBody.name || null,
    is_public: typeof parsedBody.is_public === 'boolean' ? parsedBody.is_public : false,
    user_id: user.id, // Add user_id
  }

  // Perform insert
  const { data, error } = await supabase
    .from('tier_lists')
    .insert(insertPayload)
    .select() // Return the created record

  if (error) {
    console.error('Supabase POST tier_lists error:', error)
    // Handle potential unique constraint errors if needed (e.g., user+template+name)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 }) // 201 Created status
}