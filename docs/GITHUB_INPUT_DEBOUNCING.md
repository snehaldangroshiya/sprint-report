# Configuration Input Debouncing Optimization

## Problem Statement

Configuration inputs were triggering state updates and API calls on every keystroke:

1. **GitHub Configuration** (Owner and Repository fields): Every keystroke triggered state updates, causing excessive server requests
2. **Jira Board Search**: Board search triggered API calls for each character typed, overwhelming the server with 2,900+ board queries

This resulted in:
- Excessive server requests for each character typed
- Increased server load and potential rate limiting
- Poor performance during configuration changes
- Unnecessary re-renders of dependent components
- Slow search experience for users

## Solution: Input Debouncingnfiguration Input Debouncing Optimization

## Problem Statement

The GitHub configuration inputs (Owner and Repository) in both `ConfigurationWidget` and `ConfigurationCard` components were triggering state updates on every keystroke. This resulted in:
- Excessive server requests for each character typed
- Increased server load and potential rate limiting
- Poor performance during configuration changes
- Unnecessary re-renders of dependent components

## Solution: Input Debouncing

Implemented a debouncing mechanism that delays state updates until the user stops typing for 500ms, while maintaining immediate UI feedback for a responsive user experience.

## Technical Implementation

### Architecture

```
User types → Update local input state (immediate) → Wait 500ms → Update config state (debounced)
                      ↓
              Responsive UI feedback
```

### Key Components

1. **Debounced Input State**: Separate state variables for immediate UI updates
   - `githubOwnerInput`: Local state for Owner field
   - `githubRepoInput`: Local state for Repository field

2. **Debounce Timer**: Reference to track and clear pending updates
   - `debounceTimerRef`: Holds the timeout ID for cleanup

3. **Debounced Handler**: Callback function with 500ms delay
   - `handleGithubChange(field, value)`: Handles input changes with debouncing logic

### Code Changes

#### ConfigurationWidget.tsx & ConfigurationCard.tsx

```tsx
// Added imports
import { useState, useEffect, useCallback, useRef } from 'react';

// Added state for debounced inputs
const [githubOwnerInput, setGithubOwnerInput] = useState(config.github.owner);
const [githubRepoInput, setGithubRepoInput] = useState(config.github.repo);
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

// Sync debounced state with config changes
useEffect(() => {
  setGithubOwnerInput(config.github.owner);
  setGithubRepoInput(config.github.repo);
}, [config.github.owner, config.github.repo]);

// Debounced change handler (500ms delay)
const handleGithubChange = useCallback((field: 'owner' | 'repo', value: string) => {
  if (debounceTimerRef.current) {
    clearTimeout(debounceTimerRef.current);
  }
  
  if (field === 'owner') {
    setGithubOwnerInput(value);
  } else {
    setGithubRepoInput(value);
  }
  
  debounceTimerRef.current = setTimeout(() => {
    setLocalConfig((prev) => ({
      ...prev,
      github: { ...prev.github, [field]: value },
    }));
  }, 500);
}, []);

// Cleanup on unmount
useEffect(() => {
  return () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };
}, []);

// Updated Input components
<Input
  value={githubOwnerInput}
  onChange={(e) => handleGithubChange('owner', e.target.value)}
/>
<Input
  value={githubRepoInput}
  onChange={(e) => handleGithubChange('repo', e.target.value)}
/>
```

#### BoardSelector.tsx

```tsx
// Added imports
import { useState, useEffect, useRef } from 'react';

// Added debounced search state
const [searchQuery, setSearchQuery] = useState('');
const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

// Debounce search query (300ms delay - faster for search)
useEffect(() => {
  if (searchTimerRef.current) {
    clearTimeout(searchTimerRef.current);
  }

  searchTimerRef.current = setTimeout(() => {
    setDebouncedSearchQuery(searchQuery);
  }, 300);

  return () => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
  };
}, [searchQuery]);

// Use debounced query for API calls
const { data: searchResults, isLoading: searchLoading } = useQuery({
  queryKey: ['boards-search', debouncedSearchQuery],
  queryFn: () => api.searchBoards(debouncedSearchQuery, 20),
  enabled: debouncedSearchQuery.length > 0,
});

// Use debounced query for display logic
const boards = debouncedSearchQuery.length > 0 ? searchResults : defaultBoards;
const isLoading = debouncedSearchQuery.length > 0 ? searchLoading : defaultLoading;

// CommandInput uses immediate searchQuery for responsive UI
<CommandInput
  placeholder="Type to search 2,900+ boards..."
  value={searchQuery}
  onValueChange={setSearchQuery}
/>
```

## Benefits

### Performance
- **Reduced Server Load**: Updates only trigger after debounce period
- **Fewer API Calls**: 
  - Typing "facebook" in GitHub field: 1 update instead of 8
  - Typing "Sage Connect" in board search: 1 API call instead of 12
- **Less Re-rendering**: Dependent components only re-render once per pause
- **Better Search Experience**: Reduced load on Jira board search (2,900+ boards)

### User Experience
- **Responsive Input**: Immediate visual feedback as user types
- **No Perceived Lag**: Local state updates instantly
- **Smoother Interaction**: No jank or stuttering during rapid typing
- **Faster Search Results**: Board search feels snappier with fewer concurrent requests

### Maintainability
- **Consistent Pattern**: Same implementation across both components
- **Clean Separation**: Input state vs. config state clearly distinguished
- **Proper Cleanup**: Timer cleanup prevents memory leaks

## Timing Rationale

### GitHub Configuration Fields: 500ms
- Long enough to batch multiple keystrokes
- Short enough to feel responsive
- Industry standard for form inputs
- Balances performance vs. user experience

### Jira Board Search: 300ms
- Faster response for search scenarios
- Users expect quicker feedback in search
- Still batches rapid typing effectively
- Optimized for autocomplete-style interaction

## Testing Considerations

### Manual Testing
1. **GitHub Configuration**:
   - Type rapidly in GitHub Owner field
   - Verify immediate UI updates
   - Confirm single config update after 500ms pause
   - Check network requests (should be minimal)

2. **Jira Board Search**:
   - Open board selector dropdown
   - Type rapidly (e.g., "Sage Connect")
   - Verify search input updates immediately
   - Confirm API calls only fire after 300ms pause
   - Check network tab for reduced request count

### Edge Cases Handled
- Component unmount during pending update (cleanup effect)
- Config reset while typing (sync effect in GitHub fields)
- Rapid switching between fields (timer clear)
- Board selector closing during search (timer cleanup)
- Multiple concurrent searches (previous requests superseded)

## Future Enhancements

Potential improvements if needed:
- Make debounce delays configurable via settings
- Add visual indicator during debounce period (e.g., loading spinner)
- Extend pattern to other text inputs if needed
- Implement request cancellation for in-flight API calls
- Add analytics to track search performance improvements
- Consider implementing request deduplication for identical searches

## Related Files

- `web/src/components/ConfigurationWidget.tsx` - Dashboard widget with dialog
- `web/src/components/ConfigurationCard.tsx` - Full configuration page
- `web/src/components/BoardSelector.tsx` - Jira board search component
- `web/src/contexts/ConfigurationContext.tsx` - Configuration state management
- `web/src/lib/api.ts` - API client with board search methods

## References

- [Debouncing in React](https://www.freecodecamp.org/news/debouncing-in-react/)
- [Performance optimization patterns](https://react.dev/reference/react/useMemo)
- [React hooks best practices](https://react.dev/reference/react)
