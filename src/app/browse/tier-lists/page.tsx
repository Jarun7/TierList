import Link from 'next/link';
import { createClient } from '@/lib/supabase/server'; // Use server client for RSC
import { cookies } from 'next/headers'; // Needed for server client

// Define the type based on the API response for listing
type PublicTierList = {
  id: string;
  name: string | null;
  template_id: string;
  updated_at: string;
  // We might want to join with templates table to get template name here
  // templates?: { name: string } | null;
};

// Fetch public tier lists on the server
async function getPublicTierLists(): Promise<PublicTierList[]> {
  // const cookieStore = cookies(); // Removed as it's unused
  const supabase = createClient(); // Call with 0 args

  // Fetch public lists, potentially joining with templates for name display
  // Adjust the select query as needed based on desired display info
  const { data, error } = await supabase
    .from('tier_lists')
    .select(`
      id,
      name,
      template_id,
      updated_at
    `) // Removed commented-out join to fix parsing error
    .eq('is_public', true)
    .order('updated_at', { ascending: false });
    // .limit(50); // Add pagination later if needed

  if (error) {
    console.error('Error fetching public tier lists:', error);
    return []; // Return empty array on error
  }
  // Cast needed if join is used and type needs adjustment
  return (data as PublicTierList[]) || [];
}

export default async function BrowseTierListsPage() {
  const tierLists = await getPublicTierLists();

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Browse Public Tier Lists</h1>

      {tierLists.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No public tier lists found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tierLists.map((list) => (
            // Link to the main page, passing template_id and potentially list_id to load
            // The main page needs logic to handle the `load_list_id` query param
            <Link key={list.id} href={`/?template_id=${list.template_id}&load_list_id=${list.id}`} legacyBehavior>
              <a className="block p-4 bg-white dark:bg-gray-800 rounded shadow hover:shadow-lg transition-shadow">
                <h2 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">
                  {list.name || `Untitled List`}
                </h2>
                {/* Display template name if joined/fetched */}
                {/* {list.templates && <p className="text-sm text-gray-600 dark:text-gray-400">Template: {list.templates.name}</p>} */}
                 <p className="text-sm text-gray-500 dark:text-gray-400">
                  Last Updated: {new Date(list.updated_at).toLocaleDateString()}
                </p>
              </a>
            </Link>
          ))}
        </div>
      )}
       <div className="mt-8">
          <Link href="/" legacyBehavior>
             <a className="text-blue-600 hover:underline dark:text-blue-400">
               &larr; Back to Tier List Creator
             </a>
          </Link>
           <Link href="/browse/templates" className="ml-4 text-blue-600 hover:underline dark:text-blue-400">
               Browse Templates
           </Link>
       </div>
    </div>
  );
}

// Optional: Add revalidation
// export const revalidate = 60;