// Utility functions for sprint data handling

export interface Sprint {
  id: string;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
  boardId?: number;
}

/**
 * Sort sprints by start date in descending order (newest first)
 * This is the standard sorting policy for the application
 */
export function sortSprintsByStartDate(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => {
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });
}

/**
 * Combine and sort active and closed sprints
 * Active sprints maintain their position at top based on start date
 */
export function combineAndSortSprints(
  activeSprints: Sprint[] = [],
  closedSprints: Sprint[] = [],
  limit?: number
): Sprint[] {
  const combined = [...activeSprints, ...closedSprints];
  const sorted = sortSprintsByStartDate(combined);
  return limit ? sorted.slice(0, limit) : sorted;
}
