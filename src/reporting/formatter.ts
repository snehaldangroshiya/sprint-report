import { Sprint, SprintMetrics } from '../types/index.js';

export class ReportFormatter {
  /**
   * Format number with proper decimal places
   */
  static formatNumber(value: number, decimals: number = 2): string {
    return Number(value).toFixed(decimals);
  }

  /**
   * Format percentage
   */
  static formatPercentage(value: number, decimals: number = 1): string {
    return `${Number(value).toFixed(decimals)}%`;
  }

  /**
   * Format date string
   */
  static formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  }

  /**
   * Format date with time
   */
  static formatDateTime(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  }

  /**
   * Format sprint duration
   */
  static formatSprintDuration(sprint: Sprint): string {
    if (!sprint.startDate || !sprint.endDate) return 'N/A';

    try {
      const start = new Date(sprint.startDate);
      const end = new Date(sprint.endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) return '1 day';
      if (diffDays < 7) return `${diffDays} days`;

      const weeks = Math.floor(diffDays / 7);
      const remainingDays = diffDays % 7;

      if (remainingDays === 0) {
        return weeks === 1 ? '1 week' : `${weeks} weeks`;
      } else {
        return weeks === 1
          ? `1 week, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`
          : `${weeks} weeks, ${remainingDays} day${remainingDays > 1 ? 's' : ''}`;
      }
    } catch {
      return 'N/A';
    }
  }

  /**
   * Format velocity trend
   */
  static formatVelocityTrend(trend: string): string {
    switch (trend.toLowerCase()) {
      case 'increasing':
        return '📈 Increasing';
      case 'decreasing':
        return '📉 Decreasing';
      case 'stable':
        return '➖ Stable';
      default:
        return trend;
    }
  }

  /**
   * Format issue status with emoji
   */
  static formatIssueStatus(status: string): string {
    const lowerStatus = status.toLowerCase();

    if (['done', 'closed', 'resolved'].includes(lowerStatus)) {
      return `✅ ${status}`;
    } else if (
      ['in progress', 'in-progress', 'development'].includes(lowerStatus)
    ) {
      return `🔄 ${status}`;
    } else if (['todo', 'to do', 'open', 'new'].includes(lowerStatus)) {
      return `📋 ${status}`;
    } else if (['blocked', 'impediment'].includes(lowerStatus)) {
      return `🚫 ${status}`;
    } else {
      return status;
    }
  }

  /**
   * Format issue type with emoji
   */
  static formatIssueType(type: string): string {
    const lowerType = type.toLowerCase();

    if (['story', 'user story'].includes(lowerType)) {
      return `📖 ${type}`;
    } else if (['bug', 'defect'].includes(lowerType)) {
      return `🐛 ${type}`;
    } else if (['task'].includes(lowerType)) {
      return `✅ ${type}`;
    } else if (['epic'].includes(lowerType)) {
      return `🎯 ${type}`;
    } else if (['improvement', 'enhancement'].includes(lowerType)) {
      return `⚡ ${type}`;
    } else {
      return type;
    }
  }

  /**
   * Format story points
   */
  static formatStoryPoints(points: number | undefined): string {
    if (points === undefined || points === null) return '-';
    if (points === 0) return '0';
    return points.toString();
  }

  /**
   * Format commit SHA
   */
  static formatCommitSha(sha: string, length: number = 8): string {
    return sha.substring(0, length);
  }

  /**
   * Format commit message (truncate if too long)
   */
  static formatCommitMessage(message: string, maxLength: number = 60): string {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength - 3) + '...';
  }

  /**
   * Format file size
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format duration in milliseconds to human readable
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;

    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
      return remainingSeconds > 0
        ? `${minutes}m ${remainingSeconds}s`
        : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  /**
   * Format sprint metrics summary
   */
  static formatSprintSummary(metrics: SprintMetrics): string {
    const completion = this.formatPercentage(metrics.completionRate);
    const velocity = metrics.velocity;

    return `${metrics.completedIssues}/${metrics.totalIssues} issues (${completion}) • ${velocity} SP velocity`;
  }

  /**
   * Format health status
   */
  static formatHealthStatus(healthy: boolean, latency?: number): string {
    const status = healthy ? '✅ Healthy' : '❌ Unhealthy';
    if (latency !== undefined) {
      return `${status} (${latency}ms)`;
    }
    return status;
  }

  /**
   * Format pull request state
   */
  static formatPRState(state: string): string {
    switch (state.toLowerCase()) {
      case 'open':
        return '🔄 Open';
      case 'closed':
        return '❌ Closed';
      case 'merged':
        return '✅ Merged';
      default:
        return state;
    }
  }

  /**
   * Format table row for console output
   */
  static formatTableRow(values: string[], widths: number[]): string {
    return values
      .map((value, index) => value.padEnd(widths[index] || 10))
      .join(' | ');
  }

  /**
   * Create table separator
   */
  static createTableSeparator(widths: number[]): string {
    return widths.map(width => '-'.repeat(width)).join('-|-');
  }

  /**
   * Format metrics for display
   */
  static formatMetricsDisplay(metrics: SprintMetrics): Record<string, string> {
    return {
      'Total Issues': metrics.totalIssues.toString(),
      'Completed Issues': metrics.completedIssues.toString(),
      'Completion Rate': this.formatPercentage(metrics.completionRate),
      'Total Story Points': metrics.storyPoints.toString(),
      'Completed Story Points': metrics.completedStoryPoints.toString(),
      Velocity: metrics.velocity.toString(),
      'Avg Cycle Time': this.formatDuration(
        metrics.averageCycleTime * 24 * 60 * 60 * 1000
      ), // Convert days to ms
      'Avg Lead Time': this.formatDuration(
        metrics.averageLeadTime * 24 * 60 * 60 * 1000
      ), // Convert days to ms
    };
  }

  /**
   * Escape HTML entities
   */
  static escapeHtml(text: string): string {
    const div = { innerHTML: '' } as any;
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Escape CSV values
   */
  static escapeCsv(value: string): string {
    if (value.includes('"') || value.includes(',') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  /**
   * Format markdown table
   */
  static formatMarkdownTable(headers: string[], rows: string[][]): string {
    const headerRow = `| ${headers.join(' | ')} |`;
    const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
    const dataRows = rows.map(row => `| ${row.join(' | ')} |`);

    return [headerRow, separatorRow, ...dataRows].join('\n');
  }

  /**
   * Truncate text with ellipsis
   */
  static truncate(
    text: string,
    maxLength: number,
    suffix: string = '...'
  ): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * Capitalize first letter
   */
  static capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /**
   * Format relative time (e.g., "2 hours ago")
   */
  static formatRelativeTime(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();

      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMinutes < 1) return 'just now';
      if (diffMinutes < 60)
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
      if (diffHours < 24)
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

      return this.formatDate(dateString);
    } catch {
      return dateString;
    }
  }
}
