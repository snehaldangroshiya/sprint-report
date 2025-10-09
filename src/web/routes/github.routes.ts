// GitHub repository routes
import { Router } from 'express';

/**
 * Create GitHub routes
 */
export function createGitHubRouter(
  callMCPTool: (toolName: string, args: any) => Promise<any>,
  handleAPIError: (error: any, res: any, message: string) => void
): Router {
  const router = Router();

  /**
   * Convert date strings to ISO format if they're not already
   */
  const formatDate = (dateStr: string | undefined): string | undefined => {
    if (!dateStr) return undefined;
    // If it's already in ISO format (contains 'T'), return as is
    if (dateStr.includes('T')) return dateStr;
    // Otherwise, add time and timezone
    return `${dateStr}T00:00:00Z`;
  };

  // Get commits for a repository
  router.get('/repos/:owner/:repo/commits', async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const { since, until, author, max_results, per_page = 30, page = 1 } = req.query;

      // Support both max_results (from web UI) and per_page (standard pagination)
      const perPage = max_results ? parseInt(max_results as string) : parseInt(per_page as string);

      const result = await callMCPTool('github_get_commits', {
        owner,
        repo,
        since: formatDate(since as string),
        until: formatDate(until as string),
        author: author as string,
        per_page: perPage,
        page: parseInt(page as string)
      });

      res.json(result);
    } catch (error) {
      handleAPIError(error, res, 'Failed to get commits');
    }
  });

  // Get pull requests for a repository
  router.get('/repos/:owner/:repo/pulls', async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const { state = 'all', max_results, per_page = 30, page = 1 } = req.query;

      // Support both max_results (from web UI) and per_page (standard pagination)
      const perPage = max_results ? parseInt(max_results as string) : parseInt(per_page as string);

      const result = await callMCPTool('github_get_pull_requests', {
        owner,
        repo,
        state: state as string,
        per_page: perPage,
        page: parseInt(page as string)
      });

      res.json(result);
    } catch (error) {
      handleAPIError(error, res, 'Failed to get pull requests');
    }
  });

  // Find commits with Jira references
  router.post('/:owner/:repo/commits/jira', async (req, res) => {
    try {
      const { owner, repo } = req.params;
      const { issue_keys, since, until, max_commits_per_issue = 20 } = req.body;

      if (!issue_keys || !Array.isArray(issue_keys)) {
        res.status(400).json({ error: 'issue_keys array is required' });
        return;
      }

      const result = await callMCPTool('github_find_commits_with_jira_references', {
        owner,
        repo,
        issue_keys,
        since,
        until,
        max_commits_per_issue
      });

      res.json(result);
      return;
    } catch (error) {
      handleAPIError(error, res, 'Failed to find commits with Jira references');
      return;
    }
  });

  return router;
}
