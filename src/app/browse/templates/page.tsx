'use client'; // Convert to Client Component

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react'; // Import hooks
import { Database } from '@/types/database.types';
import Spinner from '@/components/Spinner'; // Import Spinner

// Define Template type once
type Template = Database['public']['Tables']['templates']['Row'];

export default function BrowseTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch templates, memoized with useCallback
  const fetchTemplates = useCallback(async (query: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Construct API URL with search query if present
      const apiUrl = query ? `/api/templates?q=${encodeURIComponent(query)}` : '/api/templates';
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }
      const data: Template[] = await response.json();
      setTemplates(data);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setTemplates([]); // Clear templates on error
    } finally {
      setIsLoading(false);
    }
  }, []); // No dependencies, fetch function itself doesn't change

  // Initial fetch and fetch on search query change
  useEffect(() => {
    // Use a debounce mechanism if desired to avoid fetching on every keystroke
    const timerId = setTimeout(() => {
       fetchTemplates(searchQuery);
    }, 300); // Debounce search by 300ms

    return () => clearTimeout(timerId); // Cleanup timeout on unmount or query change
  }, [searchQuery, fetchTemplates]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-200">Browse Public Templates</h1>

       {/* Search Input */}
       <div className="mb-6">
         <input
           type="text"
           placeholder="Search templates by name..."
           value={searchQuery}
           onChange={(e) => setSearchQuery(e.target.value)}
           className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
         />
       </div>

      {/* Loading and Error States */}
      {isLoading && <div className="flex justify-center py-8"><Spinner size="lg" /></div>}
      {error && <p className="text-red-500 text-center py-8">Error loading templates: {error}</p>}

      {/* Display Templates */}
      {!isLoading && !error && templates.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-400">No public templates found{searchQuery ? ' matching your search' : ''}.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {templates.map((template) => (
            <Link key={template.id} href={`/?template_id=${template.id}`} legacyBehavior>
              <a className="block p-4 bg-white dark:bg-gray-800 rounded shadow hover:shadow-lg transition-shadow">
                <h2 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-300">{template.name}</h2>
                {/* Add more details if available, e.g., creator, number of items, preview image */}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Created on: {new Date(template.created_at).toLocaleDateString()}
                </p>
                {/* Placeholder for image/item count */}
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
           <Link href="/browse/tier-lists" className="ml-4 text-blue-600 hover:underline dark:text-blue-400">
               Browse Tier Lists
           </Link>
       </div>
    </div>
  );
}