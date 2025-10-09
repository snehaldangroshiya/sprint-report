/**
 * Commit message parsing and formatting utilities
 * Extracted from SprintDetails for reusability
 */

export interface ParsedCommitMessage {
  title: string;
  body: string;
}

/**
 * Parse commit message into title and body
 */
export function parseCommitMessage(message: string): ParsedCommitMessage {
  if (!message) return { title: '', body: '' };

  const lines = message.split('\n');
  const title = lines[0] || '';
  const body = lines.slice(1).join('\n').trim();

  return { title, body };
}

/**
 * Format commit body (handle markdown and HTML)
 * Returns React elements for rendering
 */
export function formatCommitBody(body: string): JSX.Element[] | null {
  if (!body) return null;

  // Split into paragraphs
  const paragraphs = body.split('\n\n').filter(p => p.trim());

  return paragraphs.map((paragraph, idx) => {
    // Handle bullet points
    if (paragraph.includes('\n- ') || paragraph.includes('\n* ')) {
      const items = paragraph.split('\n').filter(line => line.trim());
      return (
        <ul key={idx} className="list-disc list-inside space-y-1 ml-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {item.replace(/^[-*]\s*/, '')}
            </li>
          ))}
        </ul>
      );
    }

    // Handle numbered lists
    if (/^\d+\./.test(paragraph)) {
      const items = paragraph.split('\n').filter(line => line.trim());
      return (
        <ol key={idx} className="list-decimal list-inside space-y-1 ml-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm text-muted-foreground">
              {item.replace(/^\d+\.\s*/, '')}
            </li>
          ))}
        </ol>
      );
    }

    // Regular paragraph
    return (
      <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
        {paragraph}
      </p>
    );
  });
}
