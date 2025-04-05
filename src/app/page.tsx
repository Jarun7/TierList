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
      className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center cursor-grab touch-none overflow-hidden"
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
      className={`${className} ${isOver ? 'outline outline-2 outline-blue-500' : ''}`} // Highlight when dragging over
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

  // Function to handle deleting a saved tier list
  const handleDeleteList = async () => {
    if (!selectedSavedListId || !session?.user) {
      toast.error('Please select a saved list to delete.');
      return;
    }

    // Optional: Add a confirmation dialog
    if (!window.confirm('Are you sure you want to delete this saved list?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tier-lists/${selectedSavedListId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('List not found or you do not have permission to delete it.');
        throw new Error(`Failed to delete list: ${response.statusText}`);
      }

      toast.success('List deleted successfully!');

      // Remove the list from the local state
      setSavedLists(prev => prev.filter(list => list.id !== selectedSavedListId));
      setSelectedSavedListId(''); // Reset selection

    } catch (error) {
      console.error('Failed to delete list:', error);
      toast.error(`Error deleting list: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Function to toggle public status of a saved list
  const handleToggleListPublic = async (listId: string, currentStatus: boolean) => {
     if (!session?.user) return; // Should not happen if button is visible

     const newStatus = !currentStatus;

     try {
        const response = await fetch(`/api/tier-lists/${listId}`, {
           method: 'PATCH', // Or PUT
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ is_public: newStatus }),
        });

        if (!response.ok) {
           throw new Error(`Failed to update list status: ${await response.text()}`);
        }

        const updatedList: SavedTierList = await response.json();

        // Update local state
        setSavedLists(prev =>
           prev.map(list =>
              list.id === listId ? { ...list, is_public: updatedList.is_public } : list
           )
        );
        toast.success(`List visibility updated to ${newStatus ? 'Public' : 'Private'}.`);

     } catch (error) {
        console.error('Failed to toggle list public status:', error);
        toast.error(`Error updating list visibility: ${error instanceof Error ? error.message : String(error)}`);
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
    setActiveId(null); // Reset active item ID

    if (over && active.id !== over.id) {
      const activeContainerId = findContainer(active.id as string);
      const overContainerId = over.id as string; // 'over.id' is the container ID

      if (!activeContainerId || !overContainerId) {
        console.warn("Could not find container for active or over element");
        return;
      }

      // Move item between containers
      setContainers((prevContainers) => {
        const newContainers = { ...prevContainers };
        const activeItems = [...(newContainers[activeContainerId] || [])];
        const overItems = [...(newContainers[overContainerId] || [])];

        const activeIndex = activeItems.indexOf(active.id as string);
        const overIndex = overItems.indexOf(over.id as string); // This might be -1 if dropping onto container itself

        // Remove from active container
        if (activeIndex !== -1) {
          activeItems.splice(activeIndex, 1);
        }

        // Add to over container
        // If overIndex is -1, it means we dropped onto the container, not another item. Add to end.
        // Otherwise, insert at the position of the item we dropped over.
        const insertIndex = overIndex !== -1 ? overIndex : overItems.length;
        overItems.splice(insertIndex, 0, active.id as string);


        newContainers[activeContainerId] = activeItems;
        newContainers[overContainerId] = overItems;

        return newContainers;
      });
    }
  };

  // Helper function to find which container an item is currently in
  const findContainer = (itemId: string): string | undefined => {
    return Object.keys(containers).find(key => containers[key].includes(itemId));
  };

  // --- Render Logic ---
  if (loadingSession) {
    return <div className="flex justify-center items-center min-h-screen"><Spinner /></div>; // Show spinner while loading session
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col min-h-screen p-4 bg-gray-100 dark:bg-gray-900">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-gray-200">Tier List Maker</h1>
          {/* Auth UI or User Info/Logout */}
          <div className="mt-4 flex justify-center">
            {session ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400">Logged in as {session.user.email}</span>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    // Session state update will be handled by onAuthStateChange
                  }}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                >
                  Logout
                </button>
                 <Link href="/browse/templates" className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm">
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
          {/* Tier Rows */}
          <section id="tier-rows" className="p-4 bg-white dark:bg-gray-800 rounded shadow">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Tiers</h2>
            <div className="space-y-2">
              {tiers.map((tier) => (
                <DroppableContainer key={tier.id} id={tier.id} className="flex items-stretch border border-gray-300 dark:border-gray-600 rounded min-h-[80px]">
                  {/* Tier Label */}
                  <div className={`w-20 flex items-center justify-center text-white font-bold text-lg rounded-l ${tier.color}`}>
                    {tier.label}
                  </div>
                  {/* Tier Items Container */}
                  <div className="flex-grow p-2 bg-gray-50 dark:bg-gray-700 rounded-r">
                    <div className="flex flex-wrap gap-2 min-h-[64px]">
                      {/* Render items in the tier */}
                      {(containers[tier.id] ?? []).map(itemId => {
                        const item = items.find(i => i.id === itemId);
                        return item ? <DraggableItem key={item.id} id={item.id} imageUrl={item.imageUrl} name={item.name} /> : null;
                      })}
                    </div>
                  </div>
                </DroppableContainer>
              ))}
            </div>
          </section>

          {/* Template Creation Section (Only show if logged in) */}
          {session && (
            <section className="p-4 bg-white dark:bg-gray-800 rounded shadow">
              <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Create New Template</h2>
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-grow">
                  <label htmlFor="templateName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Template Name</label>
                  <input
                    type="text"
                    id="templateName"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="Enter template name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
                  />
                </div>
                <div className="flex-grow">
                   <label htmlFor="templateImages" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Images</label>
                   <input
                     type="file"
                     id="templateImages"
                     multiple
                     onChange={(e) => setFilesToUpload(e.target.files)}
                     className="w-full text-sm text-gray-500 dark:text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-800"
                   />
                </div>
                 <div className="flex items-center">
                    <input
                       type="checkbox"
                       id="makeTemplatePublic"
                       checked={makeTemplatePublic}
                       onChange={(e) => setMakeTemplatePublic(e.target.checked)}
                       className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <label htmlFor="makeTemplatePublic" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                       Make Public
                    </label>
                 </div>
                <button
                  onClick={handleCreateTemplate}
                  disabled={isCreatingTemplate}
                  className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {isCreatingTemplate ? <Spinner /> : 'Create Template'}
                </button>
              </div>
            </section>
          )}

          {/* Template Selection */}
          <section className="p-4 bg-white dark:bg-gray-800 rounded shadow">
            <label htmlFor="templateSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Template</label>
            <select
              id="templateSelect"
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = templates.find(t => t.id === e.target.value);
                setSelectedTemplate(template || null);
                setSelectedSavedListId(''); // Reset saved list selection when template changes
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
            >
              <option value="">-- Select a Template --</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name} (ID: {template.id})
                </option>
              ))}
            </select>
          </section>

          {/* Image Bank */}
          <section id="image-bank" className="p-4 bg-white dark:bg-gray-800 rounded shadow min-h-[150px]">
            <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Image Bank</h2>
            <DroppableContainer id={BANK_ID} className="flex flex-wrap gap-2 border border-dashed border-gray-300 dark:border-gray-600 p-2 rounded min-h-[80px]">
              {/* Render items in the bank */}
              {(containers[BANK_ID] ?? []).map(itemId => {
                const item = items.find(i => i.id === itemId);
                return item ? <DraggableItem key={item.id} id={item.id} imageUrl={item.imageUrl} name={item.name} /> : null;
              })}
            </DroppableContainer>
          </section>

          {/* Save/Load Section (Only show if logged in and template selected) */}
        {session && selectedTemplate && (
          <section className="p-4 bg-white dark:bg-gray-800 rounded shadow">
             <h2 className="text-xl font-semibold mb-4 text-gray-700 dark:text-gray-300">Save / Load List for "{selectedTemplate.name}"</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Save Section */}
                <div className="flex flex-col gap-2">
                   <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Save Current List</h3>
                   <input
                      type="text"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="Optional: Name your list"
                      className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
                   />
                   <div className="flex items-center">
                      <input
                         type="checkbox"
                         id="makeListPublic"
                         checked={makeListPublic}
                         onChange={(e) => setMakeListPublic(e.target.checked)}
                         className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label htmlFor="makeListPublic" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                         Make Public
                      </label>
                   </div>
                   <button
                      onClick={handleSaveList}
                      disabled={isSavingList}
                      className="px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center"
                   >
                      {isSavingList ? <Spinner /> : 'Save List'}
                   </button>
                </div>

                {/* Load Section */}
                <div className="flex flex-col gap-2">
                   <h3 className="text-lg font-medium text-gray-700 dark:text-gray-300">Load Saved List</h3>
                   {savedLists.length > 0 ? (
                      <>
                         <select
                            value={selectedSavedListId}
                            onChange={(e) => setSelectedSavedListId(e.target.value)}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-200"
                         >
                            <option value="">-- Select a saved list --</option>
                            {savedLists.map(list => (
                               <option key={list.id} value={list.id}>
                                  {list.name || `Saved at ${new Date(list.updated_at).toLocaleString()}`} {list.is_public ? '(Public)' : '(Private)'}
                               </option>
                            ))}
                         </select>
                         <div className="flex gap-2">
                            <button
                               onClick={handleLoadList}
                               disabled={!selectedSavedListId || isLoadingList}
                               className="flex-grow px-4 py-2 bg-purple-600 text-white rounded shadow hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center"
                            >
                               {isLoadingList ? <Spinner /> : 'Load Selected'}
                            </button>
                            <button
                               onClick={handleDeleteList}
                               disabled={!selectedSavedListId || isLoadingList} // Also disable if loading
                               className="px-4 py-2 bg-red-600 text-white rounded shadow hover:bg-red-700 disabled:opacity-50"
                               title="Delete Selected List"
                            >
                               🗑️
                            </button>
                             <button
                                onClick={() => {
                                   const selectedList = savedLists.find(l => l.id === selectedSavedListId);
                                   if (selectedList) {
                                      handleToggleListPublic(selectedList.id, selectedList.is_public ?? false);
                                   }
                                }}
                                disabled={!selectedSavedListId || isLoadingList}
                                className="px-4 py-2 bg-gray-500 text-white rounded shadow hover:bg-gray-600 disabled:opacity-50"
                                title={savedLists.find(l => l.id === selectedSavedListId)?.is_public ? "Make Private" : "Make Public"}
                             >
                                {savedLists.find(l => l.id === selectedSavedListId)?.is_public ? '🔒' : '🌍'}
                             </button>
                         </div>
                      </>
                   ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">No saved lists found for this template.</p>
                   )}
                </div>
             </div>
          </section>
        )}
        </main>

        {/* Footer */}
        <footer className="mt-6 text-sm text-gray-500 dark:text-gray-400 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p>Built with Next.js, Tailwind, dnd-kit, Prisma, and Supabase.</p>
          {session && selectedTemplate && selectedSavedListId && (
             <button
                onClick={() => {
                   const url = `${window.location.origin}?template_id=${selectedTemplate.id}&load_list_id=${selectedSavedListId}`;
                   navigator.clipboard.writeText(url).then(() => {
                      toast.success('Shareable link copied to clipboard!');
                   }, () => {
                      toast.error('Failed to copy link.');
                   });
                }}
                className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-xs"
                title="Copy Link to Share This List"
             >
                Copy Share Link
             </button>
          )}
        </footer>
      </div>

      {/* Drag Overlay for smooth dragging animation */}
      <DragOverlay>
        {activeId ? (
          (() => {
            const item = items.find(i => i.id === activeId);
            // Render imageUrl and name in DragOverlay
            return item ? <DraggableItem id={item.id} imageUrl={item.imageUrl} name={item.name} /> : null;
          })()
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
