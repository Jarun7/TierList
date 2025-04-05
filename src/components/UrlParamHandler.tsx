// YesTier/src/components/UrlParamHandler.tsx
"use client";

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

// Define necessary types here or import them
// Ensure these match the types used in page.tsx
export interface Template {
    id: string;
    name: string;
    created_at: string;
}
export interface SavedTierList {
    id: string;
    name: string | null;
    template_id: string;
    updated_at: string;
    is_public?: boolean
};


interface UrlParamHandlerProps {
  templates: Template[];
  selectedTemplate: Template | null;
  setSelectedTemplate: (template: Template | null) => void;
  setSelectedSavedListId: (listId: string) => void;
  // Add savedLists if needed for more complex loading logic
  // savedLists: SavedTierList[];
}

export default function UrlParamHandler({
  templates,
  selectedTemplate,
  setSelectedTemplate,
  setSelectedSavedListId,
}: UrlParamHandlerProps) {
  const searchParams = useSearchParams();

  // Effect to handle loading template/list from URL params after initial templates are fetched
  useEffect(() => {
    // Ensure templates are loaded before processing params
    if (templates && templates.length > 0) {
      const templateIdFromUrl = searchParams.get('template_id');
      const listIdFromUrl = searchParams.get('load_list_id');

      if (templateIdFromUrl) {
        const templateToSelect = templates.find(t => t.id === templateIdFromUrl);

        // Only update if the template exists and is not already selected
        if (templateToSelect && selectedTemplate?.id !== templateIdFromUrl) {
          console.log(`[UrlParamHandler] Setting template from URL: ${templateIdFromUrl}`);
          setSelectedTemplate(templateToSelect);

          // If a list ID is also present, set it to be loaded
          if (listIdFromUrl) {
             console.log(`[UrlParamHandler] Setting list ID from URL: ${listIdFromUrl}`);
             // This relies on another useEffect in the parent component reacting
             // to selectedSavedListId changing to actually load the list data.
             setSelectedSavedListId(listIdFromUrl);
          } else {
             // If only template_id is present, clear any previously selected list ID
             setSelectedSavedListId('');
          }
        } else if (!templateToSelect) {
           console.warn(`[UrlParamHandler] Template ID ${templateIdFromUrl} from URL not found.`);
           // Optionally show an error to the user via toast or state
        }
      }
    }
    // Depend on templates list and searchParams. Add selectedTemplate to avoid loop if already selected.
  }, [templates, searchParams, selectedTemplate, setSelectedTemplate, setSelectedSavedListId]);

  // This component doesn't render anything itself, it just handles effects
  return null;
}