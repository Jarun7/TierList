import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient() // Call with 0 arguments
  const { id } = params
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id as string)
    .single() // Expecting a single record

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient() // Call with 0 arguments
  const { id } = params
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id as string)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Return a success response, perhaps with no content
  return new Response(null, { status: 204 })
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient() // Call with 0 arguments
  const { id } = params
  const body = await request.json()
  const { data, error } = await supabase
    .from('templates')
    .update(body)
    .eq('id', id as string)
    .select() // Return the updated record

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}