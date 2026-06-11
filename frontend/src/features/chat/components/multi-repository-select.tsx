import * as React from "react";
import { Check, Database, ChevronsUpDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RepositoryRecord } from "@/features/repositories/types/repository-types";
import { cn } from "@/lib/utils";

interface MultiRepositorySelectProps {
  repositories: RepositoryRecord[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function MultiRepositorySelect({
  repositories,
  selectedIds,
  onChange
}: MultiRepositorySelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (id: string) => {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    onChange(next);
  };

  const filteredRepos = repositories.filter(repo =>
    repo.repo_id.toLowerCase().includes(search.toLowerCase()) ||
    (repo.remote_url || "").toLowerCase().includes(search.toLowerCase()) ||
    (repo.local_path || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative" ref={containerRef}>
      <Button 
        variant="outline" 
        role="combobox" 
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        data-testid="multi-repo-trigger-btn"
        className="h-8 justify-between text-xs border-border/50 hover:bg-accent/40 font-medium px-3 gap-2 bg-card/25 shrink-0"
      >
        <div className="flex items-center gap-1.5 truncate">
          <Database className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate">
            {selectedIds.length === 0 ? "Select Repositories" : `Federated Scope (${selectedIds.length})`}
          </span>
        </div>
        <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50 shrink-0" />
      </Button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-[280px] p-2 bg-card/80 backdrop-blur-xl border border-border/50 shadow-xl rounded-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 mb-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs outline-none text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          <div className="max-h-[200px] overflow-y-auto space-y-0.5 custom-scrollbar">
            {filteredRepos.length === 0 ? (
              <div className="text-xs text-muted-foreground p-3 text-center">No repositories found.</div>
            ) : (
              filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  onClick={() => handleSelect(repo.id)}
                  data-testid={`repo-combobox-item-${repo.id}`}
                  className="flex items-center justify-between text-xs py-2 px-2.5 cursor-pointer hover:bg-accent/40 rounded-lg transition-colors"
                >
                  <div className="flex flex-col truncate pr-2">
                    <span className="font-semibold text-foreground truncate">{repo.repo_id}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {repo.remote_url || repo.local_path || "Local Copy"}
                    </span>
                  </div>
                  <div className="h-4 w-4 shrink-0 rounded border border-primary/20 flex items-center justify-center bg-accent/20">
                    {selectedIds.includes(repo.id) && <Check className="h-3 w-3 text-primary" />}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
