import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, GitCommit, GitPullRequest, Calendar, User, ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { api } from '../lib/api';
import { useConfiguration } from '../contexts/ConfigurationContext';

export function GitHub() {
  // Get configuration from context
  const { config } = useConfiguration();

  // Use configuration for owner/repo, sync with local state for this page
  const [owner, setOwner] = useState(config.github.owner);
  const [repo, setRepo] = useState(config.github.repo);

  // Sync with configuration changes
  useEffect(() => {
    setOwner(config.github.owner);
    setRepo(config.github.repo);
  }, [config.github.owner, config.github.repo]);
  const [prState, setPrState] = useState<'open' | 'closed' | 'all'>('all');
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');

  // Pagination state
  const [commitsPage, setCommitsPage] = useState(1);
  const commitsPerPage = 10;
  const [prsPage, setPrsPage] = useState(1);
  const prsPerPage = 10;

  // Track if user has clicked "Fetch Data" to enable auto-refetch on pagination
  const [shouldFetchCommits, setShouldFetchCommits] = useState(false);
  const [shouldFetchPRs, setShouldFetchPRs] = useState(false);

  // Fetch commits - auto-fetch when page changes AFTER initial fetch
  const { data: commits, isLoading: commitsLoading } = useQuery({
    queryKey: ['commits', owner, repo, since, until, commitsPage],
    queryFn: () => api.getCommitsPaginated(owner, repo, commitsPage, commitsPerPage, since || undefined, until || undefined),
    enabled: shouldFetchCommits && !!owner && !!repo, // Auto-refetch when page changes after initial fetch
  });

  // Fetch PRs - auto-fetch when page changes AFTER initial fetch
  const { data: prs, isLoading: prsLoading } = useQuery({
    queryKey: ['prs', owner, repo, prState, prsPage],
    queryFn: () => api.getPullRequestsPaginated(owner, repo, prsPage, prsPerPage, prState),
    enabled: shouldFetchPRs && !!owner && !!repo, // Auto-refetch when page changes after initial fetch
  });

  const handleFetch = () => {
    if (owner && repo) {
      setCommitsPage(1); // Reset to page 1 when fetching new data
      setPrsPage(1); // Reset PRs to page 1
      setShouldFetchCommits(true); // Enable auto-refetch for pagination
      setShouldFetchPRs(true);
    }
  };

  // Handle Enter key press to trigger fetch
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && owner && repo) {
      handleFetch();
    }
  };

  // Handle pagination - just update page, React Query will auto-refetch
  const handleCommitsPageChange = (page: number) => {
    setCommitsPage(page);
    // No need to call refetch - React Query will do it automatically when commitsPage changes
  };

  const handlePrsPageChange = (page: number) => {
    setPrsPage(page);
    // No need to call refetch - React Query will do it automatically when prsPage changes
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">GitHub Integration</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          View commits and pull requests from your GitHub repositories
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Repository Configuration
          </CardTitle>
          <CardDescription>
            Configure the GitHub repository and date range to fetch data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="owner">Owner/Organization</Label>
              <Input
                type="text"
                id="owner"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Sage"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="repo">Repository Name</Label>
              <Input
                type="text"
                id="repo"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="sage-connect"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="since">Since Date</Label>
              <Input
                type="date"
                id="since"
                value={since}
                onChange={(e) => setSince(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="until">Until Date</Label>
              <Input
                type="date"
                id="until"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prState">PR State</Label>
              <Select value={prState} onValueChange={(value: any) => setPrState(value)}>
                <SelectTrigger id="prState">
                  <SelectValue placeholder="Select PR state" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleFetch}
            disabled={!owner || !repo}
            className="w-full md:w-auto"
          >
            <Search className="h-4 w-4 mr-2" />
            Fetch Data
          </Button>
        </CardContent>
      </Card>

      {/* Commits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <GitCommit className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-lg sm:text-xl">Recent Commits</span>
            </div>
            <Badge variant="secondary" className="self-start sm:self-auto">{commits?.length || 0}</Badge>
          </CardTitle>
          <CardDescription>
            {owner && repo ? `Viewing commits from ${owner}/${repo}` : 'Select a repository to view commits'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {commitsLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!owner || !repo ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
              <GitCommit className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground px-4">
                Enter repository details and click "Fetch Data" to view commits
              </p>
            </div>
          ) : commits && commits.length > 0 ? (
            <>
              <div className="space-y-2 sm:space-y-3">
                {commits.map((commit: any) => (
                  <div
                    key={commit.sha}
                    className="rounded-lg border bg-card p-3 sm:p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                        <p className="text-sm font-medium leading-tight sm:leading-none">
                          {commit.message.split('\n')[0]}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <Badge variant="outline" className="font-normal text-xs">
                            <User className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate max-w-[120px] sm:max-w-none">
                              {typeof commit.author === 'string' ? commit.author : commit.author.name}
                            </span>
                          </Badge>
                          <Badge variant="outline" className="font-normal text-xs whitespace-nowrap">
                            <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="hidden sm:inline">{new Date(commit.date).toLocaleString()}</span>
                            <span className="sm:hidden">{new Date(commit.date).toLocaleDateString()}</span>
                          </Badge>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {commit.sha.substring(0, 7)}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="self-start sm:self-auto flex-shrink-0"
                        asChild
                      >
                        <a
                          href={commit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">View commit</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => commitsPage > 1 && handleCommitsPageChange(commitsPage - 1)}
                        className={commitsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {/* Show current page and nearby pages */}
                    {commitsPage > 1 && (
                      <PaginationItem>
                        <PaginationLink onClick={() => handleCommitsPageChange(commitsPage - 1)} className="cursor-pointer">
                          {commitsPage - 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationLink isActive className="cursor-pointer">
                        {commitsPage}
                      </PaginationLink>
                    </PaginationItem>

                    {commits.length === commitsPerPage && (
                      <PaginationItem>
                        <PaginationLink onClick={() => handleCommitsPageChange(commitsPage + 1)} className="cursor-pointer">
                          {commitsPage + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => commits.length === commitsPerPage && handleCommitsPageChange(commitsPage + 1)}
                        className={commits.length < commitsPerPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          ) : (
            !commitsLoading && owner && repo && (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <GitCommit className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground px-4">
                  No commits found for the selected period
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Pull Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-lg sm:text-xl">Pull Requests</span>
            </div>
            <Badge variant="secondary" className="self-start sm:self-auto">{prs?.length || 0}</Badge>
          </CardTitle>
          <CardDescription>
            {owner && repo ? `Viewing ${prState} pull requests from ${owner}/${repo}` : 'Select a repository to view pull requests'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {prsLoading && (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {!owner || !repo ? (
            <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
              <GitPullRequest className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground px-4">
                Enter repository details and click "Fetch Data" to view pull requests
              </p>
            </div>
          ) : prs && prs.length > 0 ? (
            <>
              <div className="space-y-2 sm:space-y-3">
                {prs.map((pr: any) => (
                  <div
                    key={pr.number}
                    className="rounded-lg border bg-card p-3 sm:p-4 transition-colors hover:bg-accent"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                      <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={pr.state === 'open' ? 'default' : 'secondary'} className="text-xs">
                            {pr.state}
                          </Badge>
                          <span className="text-xs sm:text-sm font-medium text-muted-foreground">
                            #{pr.number}
                          </span>
                        </div>
                        <p className="text-sm font-medium leading-tight sm:leading-none">
                          {pr.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <Badge variant="outline" className="font-normal text-xs">
                            <User className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate max-w-[120px] sm:max-w-none">
                              {pr.author}
                            </span>
                          </Badge>
                          <Badge variant="outline" className="font-normal text-xs whitespace-nowrap">
                            <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="hidden sm:inline">Created: {new Date(pr.createdAt).toLocaleDateString()}</span>
                            <span className="sm:hidden">{new Date(pr.createdAt).toLocaleDateString()}</span>
                          </Badge>
                          {pr.mergedAt && (
                            <Badge variant="secondary" className="font-normal text-xs whitespace-nowrap">
                              <GitBranch className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="hidden sm:inline">Merged: {new Date(pr.mergedAt).toLocaleDateString()}</span>
                              <span className="sm:hidden">{new Date(pr.mergedAt).toLocaleDateString()}</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="self-start sm:self-auto flex-shrink-0"
                        asChild
                      >
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">View pull request</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              <div className="mt-6 flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => prsPage > 1 && handlePrsPageChange(prsPage - 1)}
                        className={prsPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>

                    {/* Show current page and nearby pages */}
                    {prsPage > 1 && (
                      <PaginationItem>
                        <PaginationLink onClick={() => handlePrsPageChange(prsPage - 1)} className="cursor-pointer">
                          {prsPage - 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationLink isActive className="cursor-pointer">
                        {prsPage}
                      </PaginationLink>
                    </PaginationItem>

                    {prs.length === prsPerPage && (
                      <PaginationItem>
                        <PaginationLink onClick={() => handlePrsPageChange(prsPage + 1)} className="cursor-pointer">
                          {prsPage + 1}
                        </PaginationLink>
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() => prs.length === prsPerPage && handlePrsPageChange(prsPage + 1)}
                        className={prs.length < prsPerPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </>
          ) : (
            !prsLoading && owner && repo && (
              <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
                <GitPullRequest className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground px-4">
                  No pull requests found
                </p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
