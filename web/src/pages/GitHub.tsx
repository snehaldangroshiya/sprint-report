import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, GitCommit, GitPullRequest, Calendar, User, ExternalLink, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { api } from '../lib/api';

export function GitHub() {
  // Set default repository from environment (Sage/sage-connect)
  const [owner, setOwner] = useState('Sage');
  const [repo, setRepo] = useState('sage-connect');
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">GitHub Integration</h1>
        <p className="mt-1 text-sm text-gray-500">
          View commits and pull requests from your GitHub repositories
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <GitBranch className="h-5 w-5 mr-2 text-blue-600" />
            Repository Configuration
          </CardTitle>
          <CardDescription>
            Configure the GitHub repository and date range to fetch data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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

      <Separator />

      <Separator />

      {/* Commits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <GitCommit className="h-5 w-5 mr-2 text-purple-600" />
              Recent Commits
            </div>
            <Badge variant="secondary">{commits?.length || 0} commits</Badge>
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
            <div className="text-center py-8">
              <GitCommit className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">Enter repository details and click "Fetch Data" to view commits</p>
            </div>
          ) : commits && commits.length > 0 ? (
            <>
              <div className="space-y-3">
                {commits.map((commit: any) => (
                  <div key={commit.sha} className="border-2 rounded-lg p-4 hover:border-purple-300 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-gray-900 mb-2">{commit.message.split('\n')[0]}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {typeof commit.author === 'string' ? commit.author : commit.author.name}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(commit.date).toLocaleString()}
                          </Badge>
                          <Badge variant="secondary" className="font-mono">
                            {commit.sha.substring(0, 7)}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="ml-4"
                      >
                        <a
                          href={commit.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
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
              <div className="text-center py-8">
                <GitCommit className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">No commits found for the selected period</p>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Pull Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <GitPullRequest className="h-5 w-5 mr-2 text-green-600" />
              Pull Requests
            </div>
            <Badge variant="secondary">{prs?.length || 0} PRs</Badge>
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
            <div className="text-center py-8">
              <GitPullRequest className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-sm text-gray-500">Enter repository details and click "Fetch Data" to view pull requests</p>
            </div>
          ) : prs && prs.length > 0 ? (
            <>
              <div className="space-y-3">
                {prs.map((pr: any) => (
                  <div key={pr.number} className="border-2 rounded-lg p-4 hover:border-green-300 transition-all hover:shadow-md">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={pr.state === 'open' ? 'default' : 'secondary'} className={
                            pr.state === 'open'
                              ? 'bg-green-500 hover:bg-green-600'
                              : 'bg-purple-500 hover:bg-purple-600'
                          }>
                            {pr.state}
                          </Badge>
                          <span className="text-sm font-semibold text-gray-600">#{pr.number}</span>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 mb-2">{pr.title}</p>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {pr.author}
                          </Badge>
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Created: {new Date(pr.createdAt).toLocaleDateString()}
                          </Badge>
                          {pr.mergedAt && (
                            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 flex items-center gap-1">
                              <GitBranch className="h-3 w-3" />
                              Merged: {new Date(pr.mergedAt).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="ml-4"
                      >
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
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
              <div className="text-center py-8">
                <GitPullRequest className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-500">No pull requests found</p>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
