/**
 * JIRA Board Mappings Loader
 * Bundled board mappings from JSON file
 *
 * Data source: data/board-mappings.json (bundled at build time)
 * Auto-generated from JIRA API on 2025-08-04T07:33:55.512Z
 * Total boards: 2868
 */

// Import the JSON data directly - will be bundled with the code
import boardMappingsData from '../data/board-mappings.json';

export interface BoardMapping {
  id: number;
  name: string;
  type: string;
  projectKey?: string;
  projectName?: string;
}

/**
 * Board mappings by name (for boards without projects)
 * Bundled from JSON file at build time for production reliability
 */
export const BOARD_NAME_MAPPINGS: Record<string, BoardMapping> =
  boardMappingsData as Record<string, BoardMapping>;

/**
 * Static mapping of JIRA boards by project key (currently empty)
 * Can be populated if needed in the future
 */
export const STATIC_BOARD_MAPPINGS: Record<string, BoardMapping> = {};

/**
 * Helper function to find a board by name or ID
 */
export function findBoard(nameOrId: string | number): BoardMapping | undefined {
  // Search by ID first
  if (typeof nameOrId === 'number' || /^\d+$/.test(nameOrId.toString())) {
    const id = typeof nameOrId === 'number' ? nameOrId : parseInt(nameOrId);
    const found = Object.values(BOARD_NAME_MAPPINGS).find(
      board => board.id === id
    );
    if (found) return found;
  }

  // Search by name
  if (typeof nameOrId === 'string') {
    // eslint-disable-next-line security/detect-object-injection
    return BOARD_NAME_MAPPINGS[nameOrId];
  }

  return undefined;
}

/**
 * Get all board names
 */
export function getAllBoardNames(): string[] {
  return Object.keys(BOARD_NAME_MAPPINGS);
}

/**
 * Get total number of boards
 */
export function getTotalBoards(): number {
  return Object.keys(BOARD_NAME_MAPPINGS).length;
}

/**
 * Quick lookup functions for board mappings
 */
export class BoardLookup {
  /**
   * Get board ID by project key
   */
  static getBoardIdByProject(projectKey: string): number | null {
    const board = STATIC_BOARD_MAPPINGS[projectKey.toUpperCase()];
    return board ? board.id : null;
  }

  /**
   * Get board info by project key
   */
  static getBoardByProject(projectKey: string): BoardMapping | null {
    return STATIC_BOARD_MAPPINGS[projectKey.toUpperCase()] ?? null;
  }

  /**
   * Get board by name (fallback for boards without projects)
   */
  static getBoardByName(boardName: string): BoardMapping | null {
    // eslint-disable-next-line security/detect-object-injection
    return BOARD_NAME_MAPPINGS[boardName] ?? null;
  }

  /**
   * Get all available project keys
   */
  static getAllProjectKeys(): string[] {
    return Object.keys(STATIC_BOARD_MAPPINGS);
  }

  /**
   * Get all board IDs
   */
  static getAllBoardIds(): number[] {
    return [
      ...Object.values(STATIC_BOARD_MAPPINGS).map(board => board.id),
      ...Object.values(BOARD_NAME_MAPPINGS).map(board => board.id),
    ];
  }

  /**
   * Search boards by name (partial match)
   */
  static searchBoardsByName(searchTerm: string): BoardMapping[] {
    const term = searchTerm.toLowerCase();
    const results: BoardMapping[] = [];

    // Search in name-based boards
    Object.values(BOARD_NAME_MAPPINGS).forEach(board => {
      if (board.name.toLowerCase().includes(term)) {
        results.push(board);
      }
    });

    return results;
  }

  /**
   * Add or update a board mapping
   */
  static updateBoardMapping(projectKey: string, boardInfo: BoardMapping): void {
    STATIC_BOARD_MAPPINGS[projectKey.toUpperCase()] = boardInfo;
  }

  /**
   * Export current mappings as JSON string
   */
  static exportMappings(): string {
    return JSON.stringify(
      {
        projectMappings: STATIC_BOARD_MAPPINGS,
        nameMappings: BOARD_NAME_MAPPINGS,
      },
      null,
      2
    );
  }

  /**
   * Get total number of boards
   */
  static getTotalBoardCount(): number {
    return (
      Object.keys(STATIC_BOARD_MAPPINGS).length +
      Object.keys(BOARD_NAME_MAPPINGS).length
    );
  }
}
