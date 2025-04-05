"use client";

import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { createClient } from '@/lib/supabase/client'; // Import client-side client
import type { Session } from '@supabase/supabase-js';
import AuthUIComponent from '@/components/AuthUI'; // Import the Auth UI component
import Link from 'next/link'; // Import Link component
import { useSearchParams } from 'next/navigation'; // Import hook for query params
import Spinner from '@/components/Spinner'; // Import Spinner component
import toast from 'react-hot-toast'; // Import toast

// --- Types ---
interface Tier {
  id: string;
  label: string;
  color: string;
}

// Define Item interface based on Prisma schema
interface Item {
  id: string;
  name: string;     // Name of the item (e.g., file name)
  imageUrl: string; // URL of the image
  templateId?: string; // Link back to the template it belongs to (optional here)
}

// Define Template interface based on API response
interface Template {
    id: string;
    name: string;
    created_at: string; // Keep this if API returns it, otherwise remove or adjust type
    // Add other fields if needed
}

type Containers = Record<string, string[]>; // Map of container ID (tier/bank) to array of item IDs
type SavedTierList = { id: string; name: string | null; template_id: string; updated_at: string; is_public?: boolean }; // Add is_public

// --- Initial Data ---
const initialTiersData: Tier[] = [
  { id: 'tier-s', label: 'S', color: 'bg-red-500' },
  { id: 'tier-a', label: 'A', color: 'bg-orange-500' },
  { id: 'tier-b', label: 'B', color: 'bg-yellow-500' },
  { id: 'tier-c', label: 'C', color: 'bg-green-500' },
  { id: 'tier-d', label: 'D', color: 'bg-blue-500' },
];

// Update initialItemsData to match the Item interface (using placeholder image URLs)
const initialItemsData: Item[] = [
  { id: 'item-1', name: 'Item 1', imageUrl: '/placeholder.svg' }, // Example placeholder
  { id: 'item-2', name: 'Item 2', imageUrl: '/placeholder.svg' },
  { id: 'item-3', name: 'Item 3', imageUrl: '/placeholder.svg' },
  { id: 'item-4', name: 'Item 4', imageUrl: '/placeholder.svg' },
  { id: 'item-5', name: 'Item 5', imageUrl: '/placeholder.svg' },
];

const BANK_ID = 'bank'; // Constant for the bank container ID

// --- Components ---

// Draggable Item Component
// Update DraggableItem props to accept imageUrl and name
function DraggableItem({ id, imageUrl, name }: { id: string; imageUrl: string; name: string }) {
  // Removed console.log
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: isDragging ? 100 : 'auto', // Ensure dragging item is on top
    opacity: isDragging ? 0.5 : 1, // Make dragging item semi-transparent
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      // Render an img tag instead of text content
      // Added object-cover to maintain aspect ratio
      className="w-16 h-16 bg-[var(--element-bg)] border border-[var(--border-color)] rounded-lg flex items-center justify-center cursor-grab touch-none overflow-hidden shadow-md hover:shadow-lg transition-shadow" /* Use element-bg, rounded-lg */
    >
      <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
    </div>
  );
}

// Droppable Container Component (for Tiers and Bank)
function DroppableContainer({ id, children, className }: { id: string; children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'outline outline-2 outline-[var(--primary-accent)]' : ''}`} // Use primary accent for highlight
    >
      {children}
    </div>
  );
}


// --- Main Page Component ---
export default function Home() {
  // Static data for initial display / fallback
  const [tiers] = useState<Tier[]>(initialTiersData);
  const [items, setItems] = useState<Item[]>(initialItemsData); // Make items stateful if they depend on template

  // State for fetched templates and selection
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

  // Containers state: Map of container ID (tier/bank) to array of item IDs
  // Initialize based on static data, will update on template selection
  const [containers, setContainers] = useState<Containers>(() => {
      const initial: Containers = {};
      tiers.forEach(tier => { initial[tier.id] = []; });
      initial[BANK_ID] = items.map(item => item.id); // Start with all items in the bank
      return initial;
  });
  const [activeId, setActiveId] = useState<string | null>(null); // Track the ID of the item being dragged
  const [session, setSession] = useState<Session | null>(null); // Add session state
  const [loadingSession, setLoadingSession] = useState(true); // State to track session loading
  const [newTemplateName, setNewTemplateName] = useState(''); // State for new template name input
  const [filesToUpload, setFilesToUpload] = useState<FileList | null>(null); // State for selected files
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false); // Loading state for creation
  const [makeTemplatePublic, setMakeTemplatePublic] = useState(false); // State for public toggle
  const [savedLists, setSavedLists] = useState<SavedTierList[]>([]); // State for user's saved lists for the current template
  const [selectedSavedListId, setSelectedSavedListId] = useState<string>(''); // State for the dropdown selection
  const [newListName, setNewListName] = useState(''); // State for naming the list to be saved
  const [isSavingList, setIsSavingList] = useState(false); // Loading state for saving
  const [isLoadingList, setIsLoadingList] = useState(false); // Loading state for loading
  const [makeListPublic, setMakeListPublic] = useState(false); // State for public toggle on save
  const supabase = createClient(); // Create client instance for session check/logout
  const searchParams = useSearchParams(); // Hook to access query parameters

  // Fetch templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch('/api/templates');
        if (!response.ok) {
          throw new Error(`Failed to fetch templates: ${response.statusText}`);
        }
        const data: Template[] = await response.json();
        setTemplates(data);
        // console.log("Fetched templates:", data); // For debugging
      } catch (error) {
        console.error("Error fetching templates:", error);
        // TODO: Display error to user
      }
    };

    fetchTemplates();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Effect to handle loading template/list from URL params after initial templates are fetched
  useEffect(() => {
    if (templates.length > 0) { // Only run if templates have been loaded
      const templateIdFromUrl = searchParams.get('template_id');
      const listIdFromUrl = searchParams.get('load_list_id');

      if (templateIdFromUrl) {
        const templateToSelect = templates.find(t => t.id === templateIdFromUrl);
        if (templateToSelect && selectedTemplate?.id !== templateIdFromUrl) {
          setSelectedTemplate(templateToSelect);
          // If a list ID is also present, set it to be loaded by the other useEffect
          if (listIdFromUrl) {
             // Ensure the savedLists state is populated first by the other effect
             // This might require adjusting dependencies or state management
             // For simplicity now, we set the ID and hope the list loads correctly
             // A better approach might involve a dedicated loading state triggered by params.
             setSelectedSavedListId(listIdFromUrl);
             // console.log(`Attempting to load template ${templateIdFromUrl} and list ${listIdFromUrl} from URL`);
          }
        } else if (!templateToSelect) {
           console.warn(`Template ID ${templateIdFromUrl} from URL not found.`);
           // Optionally show an error to the user
        }
      }
    }
    // Depend on templates list and searchParams. Add selectedTemplate to avoid loop if already selected.
  }, [templates, searchParams, selectedTemplate]);

  // Effect to check and monitor session state
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setLoadingSession(false); // Mark session loading as complete
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // If user logs out, maybe reset template/items state?
      if (_event === 'SIGNED_OUT') {
         setSelectedTemplate(null); // Reset selected template on logout
         // Items/Containers will reset via the other useEffect hook
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase]); // Dependency on supabase client instance

  // Effect to load items when a template is selected
  useEffect(() => {
    const loadItemsForTemplate = async () => {
      // Removed console.log
      if (!selectedTemplate) {
        // No template selected, reset to initial static data
        setItems(initialItemsData);
        const initial: Containers = {};
        tiers.forEach(tier => { initial[tier.id] = []; });
        initial[BANK_ID] = initialItemsData.map(item => item.id);
        setContainers(initial);
        return;
      }

      // Fetch items for the selected template
      try {
        // console.log(`Fetching items for template: ${selectedTemplate.id}`); // Debugging
        const response = await fetch(`/api/templates/${selectedTemplate.id}/items`);
        if (!response.ok) {
          throw new Error(`Failed to fetch items: ${response.statusText}`);
        }
        const fetchedItems: Item[] = await response.json();
        // Removed console.log
        setItems(fetchedItems); // Update items state

        // Reset containers: all fetched items in bank, tiers empty
        const newContainers: Containers = {};
        tiers.forEach(tier => { newContainers[tier.id] = []; }); // Initialize tier containers as empty arrays
        newContainers[BANK_ID] = fetchedItems.map(item => item.id); // Put all fetched item IDs in the bank
        setContainers(newContainers);

      } catch (error) {
        console.error(`Error fetching items for template ${selectedTemplate.id}:`, error);
        // Handle error: maybe reset to default or show an error message
        setItems([]); // Clear items on error
        const errorContainers: Containers = {};
        tiers.forEach(tier => { errorContainers[tier.id] = []; });
        errorContainers[BANK_ID] = [];
        setContainers(errorContainers);
        // TODO: Display error message to the user
      }
    };

    loadItemsForTemplate();
  }, [selectedTemplate, tiers]); // Rerun when selectedTemplate or the static tiers definition changes

  // Effect to fetch saved lists when template or session changes
  useEffect(() => {
    const fetchSavedLists = async () => {
      if (!selectedTemplate || !session) {
        setSavedLists([]); // Clear saved lists if no template or session
        setSelectedSavedListId('');
        return;
      }

      try {
        // Fetch lists specific to this user and template
        const response = await fetch(`/api/tier-lists?template_id=${selectedTemplate.id}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch saved lists: ${response.statusText}`);
        }
        const data: SavedTierList[] = await response.json();
        setSavedLists(data);
        setSelectedSavedListId(''); // Reset selection when template changes
      } catch (error) {
        console.error("Error fetching saved lists:", error);
        setSavedLists([]); // Clear on error
      }
    };

    fetchSavedLists();
  }, [selectedTemplate, session]); // Rerun when template or session changes

  // Function to handle template creation
  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim() || !filesToUpload || filesToUpload.length === 0 || !session?.user) {
      toast.error('Please provide a template name and select at least one image file.');
      return;
    }

    setIsCreatingTemplate(true);
    const userId = session.user.id;

    try {
      // 1. Create template record in DB
      const templateResponse = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTemplateName, is_public: makeTemplatePublic }),
      });

      if (!templateResponse.ok) {
        throw new Error(`Failed to create template entry: ${await templateResponse.text()}`);
      }

      // API now returns a single object
      const createdTemplate: Template = await templateResponse.json();
      if (!createdTemplate || !createdTemplate.id) {
        throw new Error('Template creation response did not contain valid template data.');
      }

      // 2. Upload images to Supabase Storage and prepare item data
      const uploadedItems: { templateId: string; imageUrl: string; name: string }[] = [];
      for (const file of Array.from(filesToUpload)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${createdTemplate.id}/${Math.random()}.${fileExt}`; // Unique path per user/template
        const filePath = `${fileName}`;

        // Use client-side upload
        // Explicitly set content type during upload
        const { error: uploadError } = await supabase.storage
          .from('template-images') // Bucket name
          .upload(filePath, file, {
             contentType: file.type, // Set content type from the file object
             upsert: false
          });

        if (uploadError) {
          console.error('Upload Error:', uploadError);
          throw new Error(`Failed to upload file ${file.name}: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('template-images')
          .getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
             console.warn(`Could not get public URL for ${filePath}`);
             continue; // Skip this item if URL fails
        }

        uploadedItems.push({
          templateId: createdTemplate.id,
          imageUrl: urlData.publicUrl,
          name: file.name,
        });
      }

      // 3. Batch insert items into the DB using the new API endpoint
      if (uploadedItems.length > 0) {
        const itemsResponse = await fetch('/api/items/batch', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify(uploadedItems),
        });

        if (!itemsResponse.ok) {
           throw new Error(`Failed to create items for template: ${await itemsResponse.text()}`);
        }
         toast.success(`Template '${createdTemplate.name}' and its ${uploadedItems.length} item(s) created successfully!`);
      } else {
         toast.success(`Template '${createdTemplate.name}' created, but no items were successfully uploaded or linked.`);
      }


      // 4. Refresh template list
      setNewTemplateName('');
      setFilesToUpload(null);
       const updatedTemplatesResponse = await fetch('/api/templates');
       const updatedTemplates = await updatedTemplatesResponse.json();
       setTemplates(updatedTemplates);

    } catch (error) {
      console.error('Template creation failed:', error);
      toast.error(`Failed to create template: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsCreatingTemplate(false);
    }
  };

  // Function to handle saving the current tier list arrangement
  const handleSaveList = async () => {
     if (!selectedTemplate || !session?.user) {
       toast.error('Cannot save: No template selected or user not logged in.');
       return;
     }
     setIsSavingList(true);

     // Prepare the data payload (exclude the bank)
     const saveData: Record<string, string[]> = {};
     Object.keys(containers).forEach(key => {
       if (key !== BANK_ID) {
         saveData[key] = containers[key];
       }
     });

     try {
       const response = await fetch('/api/tier-lists', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           template_id: selectedTemplate.id,
           name: newListName.trim() || null,
           data: saveData,
           is_public: makeListPublic,
         }),
       });

       if (!response.ok) {
         throw new Error(`Failed to save list: ${await response.text()}`);
       }

       const savedListDataArray: SavedTierList[] = await response.json();
       if (!savedListDataArray || savedListDataArray.length === 0) {
          throw new Error('Save response did not contain list data.');
       }
       const savedListData = savedListDataArray[0];


       toast.success(`List saved successfully${savedListData.name ? ` as '${savedListData.name}'` : ''}!`);
       setNewListName(''); // Clear name input

       // Refresh the list of saved lists
       setSavedLists(prev => {
           const existingIndex = prev.findIndex(l => l.id === savedListData.id);
           if (existingIndex > -1) {
               const updatedList = [...prev];
               updatedList[existingIndex] = savedListData;
               return updatedList.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
           } else {
               return [...prev, savedListData].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
           }
       });
       setSelectedSavedListId(savedListData.id); // Select the newly saved list

     } catch (error) {
       console.error('Failed to save list:', error);
       toast.error(`Error saving list: ${error instanceof Error ? error.message : String(error)}`);
     } finally {
       setIsSavingList(false);
     }
  };

   // Function to handle loading a saved tier list arrangement
  const handleLoadList = async () => {
   if (!selectedSavedListId || !session?.user) {
     toast.error('Please select a saved list to load.');
      return;
    }
    setIsLoadingList(true);

    try {
      const response = await fetch(`/api/tier-lists/${selectedSavedListId}`);
      if (!response.ok) {
         if (response.status === 404) throw new Error('Saved list not found or access denied.');
        throw new Error(`Failed to load list: ${response.statusText}`);
      }
      const loadedList: { data: Record<string, string[]> | null } = await response.json();


      if (!loadedList.data) {
         throw new Error('Loaded list data is missing or invalid.');
      }

      // Reconstruct the containers state from the loaded data
      const newContainers: Containers = {};
      const loadedItemIds = new Set<string>();

      // Populate tiers from saved data
      tiers.forEach(tier => {
        const itemIdsInTier = loadedList.data![tier.id] ?? [];
        newContainers[tier.id] = itemIdsInTier;
        itemIdsInTier.forEach(id => loadedItemIds.add(id));
      });

      // Populate bank with items NOT in any loaded tier
      const bankItems = items.filter(item => !loadedItemIds.has(item.id)).map(item => item.id);
      newContainers[BANK_ID] = bankItems;

      setContainers(newContainers); // Update the main state
      toast.success('List loaded successfully!');

    } catch (error) {
      console.error('Failed to load list:', error);
      toast.error(`Error loading list: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingList(false);
    }
  };

  // Function to handle deleting a saved list
  const handleDeleteList = async () => {
    if (!selectedSavedListId || !session?.user) {
      toast.error('Please select a saved list to delete.');
      return;
    }

    // Optional: Add a confirmation dialog
    if (!window.confirm('Are you sure you want to delete this saved list? This cannot be undone.')) {
      return;
    }

    setIsLoadingList(true); // Reuse loading state or add a dedicated deleting state

    try {
      const response = await fetch(`/api/tier-lists/${selectedSavedListId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('List not found or you do not have permission to delete it.');
        throw new Error(`Failed to delete list: ${response.statusText}`);
      }

      toast.success('List deleted successfully!');

      // Remove the list from the state
      setSavedLists(prev => prev.filter(list => list.id !== selectedSavedListId));
      setSelectedSavedListId(''); // Reset selection

    } catch (error) {
      console.error('Failed to delete list:', error);
      toast.error(`Error deleting list: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoadingList(false); // Reuse loading state
    }
  };

  // Function to toggle public/private status of a saved list
  const handleToggleListPublic = async (listId: string, currentStatus: boolean) => {
      if (!session?.user) return;

      const newStatus = !currentStatus;
      // Optimistic UI update (optional but improves perceived performance)
      setSavedLists(prev =>
          prev.map(list =>
              list.id === listId ? { ...list, is_public: newStatus } : list
          )
      );

      try {
          const response = await fetch(`/api/tier-lists/${listId}`, {
              method: 'PATCH', // Or PUT
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_public: newStatus }),
          });

          if (!response.ok) {
              // Revert optimistic update on failure
              setSavedLists(prev =>
                  prev.map(list =>
                      list.id === listId ? { ...list, is_public: currentStatus } : list
                  )
              );
              throw new Error(`Failed to update list status: ${await response.text()}`);
          }

          const updatedList: SavedTierList = await response.json();

          // Update state with confirmed data from server
          setSavedLists(prev =>
              prev.map(list =>
                  list.id === updatedList.id ? updatedList : list
              ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()) // Keep sorted
          );

          toast.success(`List marked as ${newStatus ? 'public' : 'private'}.`);

      } catch (error) {
          console.error('Failed to toggle list public status:', error);
          toast.error(`Error updating list: ${error instanceof Error ? error.message : String(error)}`);
          // Ensure UI reverts if it wasn't already
          setSavedLists(prev =>
              prev.map(list =>
                  list.id === listId ? { ...list, is_public: currentStatus } : list
              )
          );
      }
  };


  // --- Drag and Drop Handlers ---
  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the mouse to move by 10 pixels before starting a drag
      // Helps prevent accidental drags on click
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null); // Clear active item ID

    if (over && active.id !== over.id) {
      const activeContainerId = findContainer(active.id as string);
      const overContainerId = over.id as string; // Can be a tier ID or BANK_ID

      if (!activeContainerId || !overContainerId) {
        console.error("Could not find container for active or over element");
        return;
      }

      // Move item between containers
      setContainers((prevContainers) => {
        const newContainers = { ...prevContainers };

        // Remove item from the source container
        const sourceItems = newContainers[activeContainerId] ? [...newContainers[activeContainerId]] : [];
        const itemIndex = sourceItems.findIndex(id => id === active.id);
        if (itemIndex !== -1) {
          sourceItems.splice(itemIndex, 1);
          newContainers[activeContainerId] = sourceItems;
        } else {
          console.warn(`Item ${active.id} not found in source container ${activeContainerId}`);
          // If not found in expected source, check all containers (less efficient but robust)
          // This part might be removed if state management is reliable
          for (const containerId in newContainers) {
              const itemsInContainer = newContainers[containerId];
              const idx = itemsInContainer.findIndex(id => id === active.id);
              if (idx !== -1) {
                  itemsInContainer.splice(idx, 1);
                  newContainers[containerId] = itemsInContainer;
                  console.log(`Found and removed item ${active.id} from unexpected container ${containerId}`);
                  break; // Found it, stop searching
              }
          }
        }


        // Add item to the destination container
        const destinationItems = newContainers[overContainerId] ? [...newContainers[overContainerId]] : [];
        // Add to the end for simplicity, could add logic for specific drop position later
        destinationItems.push(active.id as string);
        newContainers[overContainerId] = destinationItems;

        return newContainers;
      });
    }
  };

  // Helper function to find which container an item is currently in
  const findContainer = (itemId: string): string | undefined => {
    for (const containerId in containers) {
      if (containers[containerId].includes(itemId)) {
        return containerId;
      }
    }
    return undefined; // Should not happen if state is consistent
  };


  // --- Render ---
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col min-h-screen p-4 md:p-6 bg-[var(--background)] text-[var(--foreground)]">
        {/* Header */}
        <header className="mb-6 pb-4 border-b border-[var(--border-color)]">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-[var(--primary-accent)]">YesTier</h1> {/* Changed title style */}
            {/* Auth Button/Info */}
            {loadingSession ? (
              <Spinner />
            ) : session ? (
              <div className="flex items-center gap-4">
                <span className="text-sm opacity-80">Logged in as {session.user.email}</span> {/* Adjusted style */}
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                  }}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-[var(--background)]"
                >
                  Logout
                </button>
                 {/* Link to Browse Templates */}
                 <Link
                    href="/browse/templates"
                    className="px-3 py-1 bg-[var(--secondary-accent)] text-white rounded hover:opacity-80 text-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--secondary-accent)] focus:ring-offset-[var(--background)]"
                    >
                    Browse Templates
                 </Link>
              </div>
            ) : (
              <AuthUIComponent />
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex flex-col flex-grow gap-6">

          {/* Container for Tier List and Image Bank */}
          <div className="flex flex-col md:flex-row gap-6">

            {/* Tier Rows Section (Takes more space) */}
            <section id="tier-rows" className="flex-grow p-6 bg-white/5 dark:bg-black/20 border border-[var(--border-color)] rounded-lg shadow-lg"> {/* Updated section style */}
              <h2 className="text-lg font-semibold mb-4 text-[var(--secondary-accent)]">Tiers</h2> {/* Heading color */}
              <div className="space-y-2">
                {tiers.map((tier) => (
                  <DroppableContainer key={tier.id} id={tier.id} className="flex items-stretch border border-[var(--border-color)] rounded-lg min-h-[80px] transition-all duration-150 overflow-hidden"> {/* Use rounded-lg */}
                    {/* Tier Label - Use tier.color directly for now, could map later */}
                    <div className={`w-24 flex items-center justify-center text-white font-bold text-xl ${tier.color}`}> {/* Removed rounded-l */}
                      {tier.label}
                    </div>
                    {/* Tier Items Area */}
                    <div className="flex-grow p-2 flex flex-wrap gap-2 bg-[var(--element-bg)]"> {/* Use element-bg */}
                      {(containers[tier.id] ?? []).map(itemId => {
                        const item = items.find(i => i.id === itemId);
                        return item ? <DraggableItem key={item.id} id={item.id} imageUrl={item.imageUrl} name={item.name} /> : null;
                      })}
                    </div>
                  </DroppableContainer>
                ))}
              </div>
            </section>

            {/* Image Bank Section (Takes less space on medium screens and up) */}
            <section id="image-bank" className="md:w-1/3 lg:w-1/4 flex-shrink-0 p-6 bg-white/5 dark:bg-black/20 border border-[var(--border-color)] rounded-lg shadow-lg min-h-[150px]"> {/* Updated section style */}
              <h2 className="text-lg font-semibold mb-4 text-[var(--secondary-accent)]">Item Bank</h2> {/* Heading color */}
              <DroppableContainer id={BANK_ID} className="flex flex-wrap gap-2 border border-dashed border-[var(--border-color)] p-2 rounded-lg min-h-[80px] bg-[var(--element-bg)] transition-all duration-150 h-full"> {/* Use element-bg, rounded-lg */}
                {/* Render items currently in the bank */}
                {(containers[BANK_ID] ?? []).map(itemId => {
                  const item = items.find(i => i.id === itemId);
                  return item ? <DraggableItem key={item.id} id={item.id} imageUrl={item.imageUrl} name={item.name} /> : null;
                })}
              </DroppableContainer>
            </section>

          </div> {/* End of Tier List / Image Bank Container */}


          {/* Template Creation Section (Only if logged in) */}
          {session && (
            <section className="p-6 bg-white/5 dark:bg-black/20 border border-[var(--border-color)] rounded-lg shadow-lg"> {/* Updated section style */}
              <h2 className="text-lg font-semibold mb-4 text-[var(--secondary-accent)]">Create New Template</h2> {/* Heading color */}
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="New Template Name"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  className="p-2 border border-[var(--border-color)] rounded-lg bg-[var(--element-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] focus:ring-offset-2 focus:ring-offset-[var(--background)] transition-colors" /* Use element-bg, rounded-lg */
                />
                <input
                  type="file"
                  multiple
                  onChange={(e) => setFilesToUpload(e.target.files)}
                  className="p-1 border border-[var(--border-color)] rounded-lg bg-[var(--element-bg)] text-sm file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary-accent)] file:text-white hover:file:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] focus:ring-offset-2 focus:ring-offset-[var(--background)] transition-colors" /* Use element-bg, rounded-lg */
                />
                 <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="makeTemplatePublic"
                        checked={makeTemplatePublic}
                        onChange={(e) => setMakeTemplatePublic(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--border-color)] bg-[var(--element-bg)] text-[var(--primary-accent)] focus:ring-[var(--primary-accent)] focus:ring-offset-0" /* Use element-bg */
                    />
                    <label htmlFor="makeTemplatePublic" className="text-sm text-[var(--foreground)] opacity-90">
                        Make this template public?
                    </label>
                </div>
                <button
                  onClick={handleCreateTemplate}
                  disabled={isCreatingTemplate}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 focus:ring-offset-[var(--background)]" /* Use rounded-lg */
                >
                  {isCreatingTemplate ? <Spinner /> : 'Create Template'}
                </button>
              </div>
            </section>
          )}

          {/* Template Selection Section */}
          <section className="p-6 bg-white/5 dark:bg-black/20 border border-[var(--border-color)] rounded-lg shadow-lg"> {/* Updated section style */}
            <h2 className="text-lg font-semibold mb-4 text-[var(--secondary-accent)]">Select Template</h2> {/* Heading color */}
            <select
              value={selectedTemplate?.id || ''}
              className="p-2 border border-[var(--border-color)] rounded-lg w-full bg-[var(--element-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] focus:ring-offset-2 focus:ring-offset-[var(--background)] transition-colors appearance-none" /* Use element-bg, rounded-lg */
              onChange={(e) => {
                const templateId = e.target.value;
                const template = templates.find(t => t.id === templateId) || null;
                setSelectedTemplate(template);
                setSelectedSavedListId(''); // Reset saved list selection when template changes
              }}
            >
              <option value="">-- Select a Template --</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </section>

          {/* Image Bank Section - Now inside the flex container above */}


          {/* Save/Load List Section (Only if logged in and template selected) */}
          {session && selectedTemplate && (
            <section className="p-6 bg-white/5 dark:bg-black/20 border border-[var(--border-color)] rounded-lg shadow-lg"> {/* Updated section style */}
              <h2 className="text-lg font-semibold mb-4 text-[var(--secondary-accent)]">Save / Load List for "{selectedTemplate.name}"</h2> {/* Heading color */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Save Section */}
                <div className="flex flex-col gap-3">
                  <h3 className="font-medium">Save Current List</h3>
                  <input
                    type="text"
                    placeholder="Optional: List Name"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className="p-2 border border-[var(--border-color)] rounded-lg bg-[var(--element-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] focus:ring-offset-2 focus:ring-offset-[var(--background)] transition-colors" /* Use element-bg, rounded-lg */
                  />
                   <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="makeListPublic"
                            checked={makeListPublic}
                            onChange={(e) => setMakeListPublic(e.target.checked)}
                            className="h-4 w-4 rounded border-[var(--border-color)] bg-[var(--element-bg)] text-[var(--primary-accent)] focus:ring-[var(--primary-accent)] focus:ring-offset-0" /* Use element-bg */
                        />
                        <label htmlFor="makeListPublic" className="text-sm text-[var(--foreground)] opacity-90">
                            Make this saved list public?
                        </label>
                    </div>
                  <button
                    onClick={handleSaveList}
                    disabled={isSavingList}
                    className="px-4 py-2 bg-[var(--primary-accent)] text-white rounded-lg hover:opacity-80 disabled:opacity-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-accent)] focus:ring-offset-[var(--background)]" /* Use rounded-lg */
                  >
                    {isSavingList ? <Spinner /> : 'Save List'}
                  </button>
                </div>

                {/* Load Section */}
                <div className="flex flex-col gap-3">
                  <h3 className="font-medium">Load Saved List</h3>
                  {savedLists.length > 0 ? (
                      <>
                         <select
                            value={selectedSavedListId}
                            onChange={(e) => setSelectedSavedListId(e.target.value)}
                            className="p-2 border border-[var(--border-color)] rounded-lg w-full bg-[var(--element-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-accent)] focus:border-[var(--primary-accent)] focus:ring-offset-2 focus:ring-offset-[var(--background)] transition-colors appearance-none" /* Use element-bg, rounded-lg */
                            >
                            <option value="">-- Select a saved list --</option>
                            {savedLists.map(list => (
                                <option key={list.id} value={list.id}>
                                {list.name || `Saved at ${new Date(list.updated_at).toLocaleString()}`} {list.is_public ? '(Public)' : ''}
                                </option>
                            ))}
                            </select>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleLoadList}
                                    disabled={!selectedSavedListId || isLoadingList}
                                    className="flex-1 px-4 py-2 bg-[var(--secondary-accent)] text-white rounded-lg hover:opacity-80 disabled:opacity-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--secondary-accent)] focus:ring-offset-[var(--background)]" /* Use rounded-lg */
                                >
                                    {isLoadingList ? <Spinner /> : 'Load Selected List'}
                                </button>
                                <button
                                    onClick={handleDeleteList}
                                    disabled={!selectedSavedListId || isLoadingList}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-[var(--background)]" /* Use rounded-lg */
                                    title="Delete Selected List"
                                >
                                    🗑️ {/* Trash icon */}
                                </button>
                                <button
                                    onClick={() => {
                                        const list = savedLists.find(l => l.id === selectedSavedListId);
                                        if (list) {
                                            handleToggleListPublic(list.id, !!list.is_public);
                                        }
                                    }}
                                    disabled={!selectedSavedListId || isLoadingList}
                                    className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 focus:ring-offset-[var(--background)]" /* Use rounded-lg */
                                    title={savedLists.find(l => l.id === selectedSavedListId)?.is_public ? "Make Private" : "Make Public"}
                                >
                                    {savedLists.find(l => l.id === selectedSavedListId)?.is_public ? '🔒' : '🌍'} {/* Lock/Globe icon */}
                                </button>
                            </div>
                      </>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No saved lists for this template.</p>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="mt-auto pt-4 text-sm text-[var(--foreground)] opacity-70 flex flex-col sm:flex-row justify-between items-center gap-2 border-t border-[var(--border-color)]"> {/* Added mt-auto, border-t */}
          <p>&copy; {new Date().getFullYear()} YesTier. All rights reserved.</p>
           {selectedTemplate && (
                <button
                    onClick={() => {
                        const url = `${window.location.origin}?template_id=${selectedTemplate.id}${selectedSavedListId ? `&load_list_id=${selectedSavedListId}` : ''}`;
                        navigator.clipboard.writeText(url).then(() => {
                            toast.success('Link copied to clipboard!');
                        }, (err) => {
                            toast.error('Failed to copy link.');
                            console.error('Could not copy text: ', err);
                        });
                    }}
                    className="px-3 py-1 bg-[var(--element-bg)] border border-[var(--border-color)] rounded-lg hover:bg-white/20 dark:hover:bg-black/40 text-xs transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-accent)] focus:ring-offset-[var(--background)]" /* Use element-bg, rounded-lg */
                    title="Copy link to current template/list"
                >
                    🔗 Copy Link
                </button>
            )}
        </footer>
      </div>

      {/* Drag Overlay for smooth dragging animation */}
      <DragOverlay>
        {activeId ? (
          (() => {
            const item = items.find(i => i.id === activeId);
            return item ? <DraggableItem id={item.id} imageUrl={item.imageUrl} name={item.name} /> : null;
          })()
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
