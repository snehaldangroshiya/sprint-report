/**
 * Simple SSE MCP Client Example
 * 
 * This is a basic example of how to connect to the SSE MCP server.
 * Run this after starting the SSE server with: npm run dev:sse
 */

class MCPSSEClient {
  constructor(baseUrl = 'http://localhost:3002') {
    this.baseUrl = baseUrl;
    this.eventSource = null;
    this.sessionId = null;
    this.messageId = 0;
    this.pendingRequests = new Map();
  }

  /**
   * Connect to the SSE server and establish a session
   */
  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to ${this.baseUrl}/sse...`);
      
      this.eventSource = new EventSource(`${this.baseUrl}/sse`);

      this.eventSource.onopen = () => {
        console.log('✅ SSE connection established');
      };

      this.eventSource.addEventListener('endpoint', (event) => {
        const data = JSON.parse(event.data);
        console.log('📍 Endpoint info:', data);
      });

      this.eventSource.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);

          // Session initialization
          if (!this.sessionId && message.result?.sessionId) {
            this.sessionId = message.result.sessionId;
            console.log('🔑 Session initialized:', this.sessionId);
            resolve();
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      });

      this.eventSource.onerror = (error) => {
        console.error('❌ SSE error:', error);
        if (!this.sessionId) {
          reject(new Error('Failed to establish connection'));
        }
      };

      // Timeout if no session ID received
      setTimeout(() => {
        if (!this.sessionId) {
          reject(new Error('Session initialization timeout'));
        }
      }, 10000);
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    console.log('📨 Received:', message);

    // Handle responses to pending requests
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(message.error.message || 'Request failed'));
      } else {
        resolve(message.result);
      }
    }
  }

  /**
   * Send a message to the server
   */
  async sendMessage(method, params = {}) {
    if (!this.sessionId) {
      throw new Error('Not connected - no session ID');
    }

    const id = ++this.messageId;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    console.log(`📤 Sending (${method}):`, message);

    const response = await fetch(
      `${this.baseUrl}/message?sessionId=${this.sessionId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    // Return a promise that will be resolved when we get the response via SSE
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 30000);
    });
  }

  /**
   * List all available tools
   */
  async listTools() {
    const result = await this.sendMessage('tools/list', {});
    return result.tools;
  }

  /**
   * Call a specific tool
   */
  async callTool(toolName, args = {}) {
    return await this.sendMessage('tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  /**
   * Disconnect from the server
   */
  disconnect() {
    if (this.eventSource) {
      console.log('Disconnecting...');
      this.eventSource.close();
      this.eventSource = null;
      this.sessionId = null;
      this.pendingRequests.clear();
    }
  }
}

// Example usage
async function main() {
  const client = new MCPSSEClient('http://localhost:3002');

  try {
    // Connect to server
    await client.connect();
    console.log('\n✅ Connected successfully!\n');

    // List available tools
    console.log('📋 Listing tools...');
    const tools = await client.listTools();
    console.log(`\n✅ Found ${tools.length} tools:`);
    tools.forEach((tool, index) => {
      console.log(`${index + 1}. ${tool.name}`);
      console.log(`   ${tool.description}`);
    });

    // Example: Get sprints
    console.log('\n📊 Getting sprints...');
    const sprints = await client.callTool('jira_get_sprints', {
      board_id: '6306',
      state: 'active',
    });
    console.log('\n✅ Sprints:', sprints);

    // Example: Generate a report
    console.log('\n📄 Generating sprint report...');
    const report = await client.callTool('generate_sprint_report', {
      boardId: 6306,
      sprintId: 12345,
      format: 'markdown',
    });
    console.log('\n✅ Report generated!');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    // Keep connection alive or disconnect
    console.log('\n💡 Connection is still active. Press Ctrl+C to disconnect.');
    
    // Uncomment to disconnect immediately:
    // client.disconnect();
  }
}

// Run if executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  const EventSource = require('eventsource');
  const fetch = require('node-fetch');
  global.EventSource = EventSource;
  global.fetch = fetch;
  
  main().catch(console.error);
} else {
  // Browser environment
  console.log('SSE MCP Client loaded. Run main() to connect.');
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MCPSSEClient, main };
}
