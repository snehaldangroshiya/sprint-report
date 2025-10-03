import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GitBranch, GitCommit, GitPullRequest, Calendar, User, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Repository Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="owner" className="block text-sm font-medium text-gray-700 mb-1">
              Owner/Organization
            </label>
            <input
              type="text"
              id="owner"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Sage"
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="repo" className="block text-sm font-medium text-gray-700 mb-1">
              Repository Name
            </label>
            <input
              type="text"
              id="repo"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="sage-connect"
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="since" className="block text-sm font-medium text-gray-700 mb-1">
              Since Date
            </label>
            <input
              type="date"
              id="since"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="until" className="block text-sm font-medium text-gray-700 mb-1">
              Until Date
            </label>
            <input
              type="date"
              id="until"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label htmlFor="prState" className="block text-sm font-medium text-gray-700 mb-1">
              PR State
            </label>
            <select
              id="prState"
              value={prState}
              onChange={(e) => setPrState(e.target.value as any)}
              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        <Button
          onClick={handleFetch}
          disabled={!owner || !repo}
          className="mt-4"
        >
          <GitBranch className="h-4 w-4 mr-2" />
          Fetch Data
        </Button>
      </div>

      {/* Commits */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <GitCommit className="h-5 w-5 mr-2" />
          Recent Commits ({commits?.length || 0})
        </h2>

        {commitsLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!owner || !repo ? (
          <p className="text-sm text-gray-500">Enter repository details and click "Fetch Data" to view commits.</p>
        ) : commits && commits.length > 0 ? (
          <>
            <div className="space-y-3">
              {commits.map((commit: any) => (
                <div key={commit.sha} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{commit.message.split('\n')[0]}</p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {typeof commit.author === 'string' ? commit.author : commit.author.name}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(commit.date).toLocaleString()}
                        </span>
                        <code className="bg-gray-100 px-2 py-1 rounded">
                          {commit.sha.substring(0, 7)}
                        </code>
                      </div>
                    </div>
                    <a
                      href={commit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
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
            <p className="text-sm text-gray-500">No commits found for the selected period.</p>
          )
        )}
      </div>

      {/* Pull Requests */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <GitPullRequest className="h-5 w-5 mr-2" />
          Pull Requests ({prs?.length || 0})
        </h2>

        {prsLoading && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {!owner || !repo ? (
          <p className="text-sm text-gray-500">Enter repository details and click "Fetch Data" to view pull requests.</p>
        ) : prs && prs.length > 0 ? (
          <>
            <div className="space-y-3">
              {prs.map((pr: any) => (
                <div key={pr.number} className="border rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${
                          pr.state === 'open'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {pr.state}
                        </span>
                        <span className="text-sm font-medium text-gray-900">#{pr.number}</span>
                      </div>
                      <p className="mt-1 text-sm text-gray-900">{pr.title}</p>
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {pr.author}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Created: {new Date(pr.createdAt).toLocaleDateString()}
                        </span>
                        {pr.mergedAt && (
                          <span className="text-green-600">
                            Merged: {new Date(pr.mergedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
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
            <p className="text-sm text-gray-500">No pull requests found.</p>
          )
        )}
      </div>
    </div>
  );
}
