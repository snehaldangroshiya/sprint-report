/**
 * Board Selector Component
 * Searchable dropdown for Jira board selection
 */

import { useState, useEffect, useRef } from 'react';
import { Search, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';

interface BoardSelectorProps {
  value: string;
  onChange: (boardId: string, boardName: string) => void;
  disabled?: boolean;
  initialBoardName?: string;
}

export function BoardSelector({ value, onChange, disabled, initialBoardName }: BoardSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedBoardCache, setSelectedBoardCache] = useState<{
    id: string;
    name: string;
    projectKey?: string;
    projectName?: string;
    type: string;
  } | null>(null);

  // Debounce search query to reduce API calls
  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce for search (faster than form inputs)

    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery]);

  // Fetch default boards
  const { data: defaultBoards, isLoading: defaultLoading } = useQuery({
    queryKey: ['boards'],
    queryFn: api.getBoards,
  });

  // Fetch search results
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['boards-search', debouncedSearchQuery],
    queryFn: () => api.searchBoards(debouncedSearchQuery, 20),
    enabled: debouncedSearchQuery.length > 0,
  });

  // Fetch selected board by ID if not found in current results
  const { data: selectedBoardData } = useQuery({
    queryKey: ['board', value],
    queryFn: () => api.searchBoards(value, 1),
    enabled: !!value && !selectedBoardCache,
  });

  // Determine which boards to display
  const boards = debouncedSearchQuery.length > 0 ? searchResults : defaultBoards;
  const isLoading = debouncedSearchQuery.length > 0 ? searchLoading : defaultLoading;

  // Find selected board - check cache first, then current boards, then fetched data
  // If nothing found but we have initialBoardName, create a minimal board object for display
  const selectedBoard = selectedBoardCache ||
    boards?.find(b => b.id === value) ||
    selectedBoardData?.[0] ||
    (value && initialBoardName ? { id: value, name: initialBoardName, type: 'scrum' } : null);

  // Initialize cache when component mounts or value changes
  useEffect(() => {
    if (value) {
      // Check if we already have this board cached
      if (selectedBoardCache && selectedBoardCache.id === value) {
        return; // Already cached, no need to update
      }
      
      // Try to find board in default boards first
      const boardInDefaults = defaultBoards?.find(b => b.id === value);
      if (boardInDefaults) {
        setSelectedBoardCache(boardInDefaults);
      }
    }
  }, [value, defaultBoards]);

  // Update cache when selected board is found in any source
  useEffect(() => {
    if (selectedBoard && (!selectedBoardCache || selectedBoardCache.id !== selectedBoard.id)) {
      setSelectedBoardCache(selectedBoard);
    }
  }, [selectedBoard, selectedBoardCache]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          <span className="truncate">
            {selectedBoard ? (
              <span>
                {selectedBoard.name}
                {selectedBoard.projectKey && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {selectedBoard.projectKey}
                  </Badge>
                )}
              </span>
            ) : (
              'Select board...'
            )}
          </span>
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type to search 2,900+ boards... (e.g., 'Sage Connect')"
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            {isLoading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                <CommandEmpty>
                  {searchQuery.length > 0
                    ? 'No boards found. Try different keywords.'
                    : 'Start typing to search boards (e.g., "SCNT", "Sage Connect", "6306")'}
                </CommandEmpty>
                <CommandGroup>
                  {boards?.map((board) => (
                    <CommandItem
                      key={board.id}
                      value={board.name.toLowerCase()}
                      keywords={[board.id, board.projectKey || '', board.projectName || ''].filter(Boolean)}
                      onSelect={() => {
                        // Cache the selected board so it persists after search clears
                        setSelectedBoardCache(board);
                        onChange(board.id, board.name);
                        setOpen(false);
                        setSearchQuery('');
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{board.name}</span>
                          {board.projectKey && (
                            <Badge variant="outline" className="text-xs">
                              {board.projectKey}
                            </Badge>
                          )}
                        </div>
                        {board.projectName && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {board.projectName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Badge variant="secondary" className="text-xs capitalize">
                          {board.type}
                        </Badge>
                        {value === board.id && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
