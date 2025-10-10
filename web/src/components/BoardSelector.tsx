/**
 * Board Selector Component
 * Searchable dropdown for Jira board selection
 */

import { useState, useEffect } from 'react';
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
}

export function BoardSelector({ value, onChange, disabled }: BoardSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBoardCache, setSelectedBoardCache] = useState<{
    id: string;
    name: string;
    projectKey?: string;
    projectName?: string;
    type: string;
  } | null>(null);

  // Fetch default boards
  const { data: defaultBoards, isLoading: defaultLoading } = useQuery({
    queryKey: ['boards'],
    queryFn: api.getBoards,
  });

  // Fetch search results
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['boards-search', searchQuery],
    queryFn: () => api.searchBoards(searchQuery, 20),
    enabled: searchQuery.length > 0,
  });

  // Fetch selected board by ID if not found in current results
  const { data: selectedBoardData } = useQuery({
    queryKey: ['board', value],
    queryFn: () => api.searchBoards(value, 1),
    enabled: !!value && !selectedBoardCache,
  });

  // Determine which boards to display
  const boards = searchQuery.length > 0 ? searchResults : defaultBoards;
  const isLoading = searchQuery.length > 0 ? searchLoading : defaultLoading;

  // Find selected board - check cache first, then current boards, then fetched data
  const selectedBoard = selectedBoardCache || 
    boards?.find(b => b.id === value) || 
    selectedBoardData?.[0];

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
      <PopoverContent className="w-[400px] p-0" align="start">
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
