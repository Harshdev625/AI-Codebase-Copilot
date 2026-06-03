import React, { useState } from "react";
import { FolderTree, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ScopeSelectorProps {
  scopePaths: string[];
  onChange: (scopes: string[]) => void;
}

export function ScopeSelector({ scopePaths, onChange }: ScopeSelectorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const trimmed = inputValue.trim();
    if (trimmed && !scopePaths.includes(trimmed)) {
      onChange([...scopePaths, trimmed]);
    }
    setInputValue("");
    setIsEditing(false);
  };

  const handleRemove = (path: string) => {
    onChange(scopePaths.filter((p) => p !== path));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setInputValue("");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-accent/5 rounded-t-2xl">
      <div className="flex items-center gap-1.5 mr-2 text-muted-foreground/70">
        <FolderTree className="h-3.5 w-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">Scopes:</span>
      </div>

      {scopePaths.length === 0 && !isEditing && (
        <span className="text-xs text-muted-foreground italic mr-2">Entire Repository</span>
      )}

      {scopePaths.map((path) => (
        <Badge key={path} variant="secondary" className="px-2 py-0.5 text-xs font-mono bg-primary/10 hover:bg-primary/20 text-primary/90 flex items-center gap-1 border-primary/20">
          {path}
          <button
            onClick={() => handleRemove(path)}
            className="ml-1 text-primary/70 hover:text-primary hover:bg-primary/20 rounded-full p-0.5 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {isEditing ? (
        <div className="flex items-center gap-1 ml-1 animate-in fade-in slide-in-from-left-2">
          <Input
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. frontend/src"
            className="h-6 w-32 text-xs font-mono px-2 py-0 bg-background border-border shadow-sm focus-visible:ring-1 focus-visible:ring-primary/50 rounded-sm"
          />
          <Button size="icon-xs" variant="ghost" onClick={handleAdd} className="h-6 w-6 text-primary hover:bg-primary/10 rounded-sm">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon-xs" variant="ghost" onClick={() => setIsEditing(false)} className="h-6 w-6 text-muted-foreground hover:bg-accent rounded-sm">
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(true)}
          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent rounded-full border border-dashed border-border/60 ml-1"
        >
          <Plus className="h-3 w-3 mr-1" /> Add Path
        </Button>
      )}
    </div>
  );
}
