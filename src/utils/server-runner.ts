/**
 * Shared server runner utility to eliminate boilerplate duplication
 */

/**
 * Interface for any server that can be started
 */
interface RunnableServer {
  initialize?: () => Promise<void>;
  run?: () => Promise<void>;
  start?: () => Promise<void>;
}

/**
 * Run a server with standardized error handling and process management
 *
 * @param serverFactory - Factory function that creates and returns the server instance
 * @param serverName - Name of the server for logging purposes
 */
export async function runServer(
  serverFactory: () => RunnableServer | Promise<RunnableServer>,
  serverName: string = 'Server'
): Promise<void> {
  // Setup error handlers
  process.on('unhandledRejection', (reason, promise) => {
    console.error(`${serverName} - Unhandled Rejection at:`, promise, 'reason:', reason);
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    console.error(`${serverName} - Uncaught Exception:`, error);
    process.exit(1);
  });

  // Main execution
  try {
    const server = await serverFactory();

    // Store globally for signal handlers if applicable
    if ('mcpServer' in global || serverName.includes('MCP')) {
      (global as any).mcpServer = server;
    }

    // Initialize if method exists
    if (server.initialize) {
      await server.initialize();
    }

    // Run or start the server
    if (server.run) {
      await server.run();
    } else if (server.start) {
      await server.start();
    } else {
      throw new Error(`Server has no run() or start() method`);
    }
  } catch (error) {
    console.error(`Failed to start ${serverName}:`, error);
    process.exit(1);
  }
}
