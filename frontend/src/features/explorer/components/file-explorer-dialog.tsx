import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { File, Folder, Search, X, FolderSearch, FileText, Plus, Check } from "lucide-react";

interface FileExplorerDialogProps {
  repositoryId?: string;
}

export function FileExplorerDialog({ repositoryId }: FileExplorerDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [addedFiles, setAddedFiles] = useState<Set<string>>(new Set());

  // Mock file tree
  const files = [
    { name: "src", type: "folder", children: [
      { name: "components", type: "folder", children: [
        { name: "button.tsx", type: "file", size: "2.1 KB" },
        { name: "input.tsx", type: "file", size: "1.4 KB" }
      ]},
      { name: "utils.ts", type: "file", size: "3.5 KB" },
      { name: "main.ts", type: "file", size: "8.2 KB" }
    ]},
    { name: "package.json", type: "file", size: "1.2 KB" },
    { name: "README.md", type: "file", size: "5.6 KB" }
  ];

  const handleAddFile = (fileName: string) => {
    setAddedFiles(prev => new Set(prev).add(fileName));
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start text-xs h-7 px-2 border-border/50 hover:bg-primary/10 hover:text-primary">
          <FolderSearch className="w-3 h-3 mr-2" /> File Explorer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/40 shadow-2xl">
        <DialogHeader className="p-4 border-b border-border/40 bg-card/40 shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FolderSearch className="w-5 h-5 text-primary" />
              Repository Explorer
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Panel: File Tree */}
          <div className="w-[280px] border-r border-border/40 flex flex-col bg-card/20">
            <div className="p-3 border-b border-border/40 relative shrink-0">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder="Search files (Ctrl+P)..." 
                className="pl-9 h-8 bg-background/50 border-border/40 text-xs focus-visible:ring-1 focus-visible:ring-primary/50"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer text-sm text-foreground/80">
                  <Folder className="w-4 h-4 text-blue-400" /> src
                </div>
                <div className="flex flex-col ml-4 border-l border-border/40 pl-2 gap-0.5">
                  <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer text-sm text-foreground/80">
                    <Folder className="w-4 h-4 text-blue-400" /> components
                  </div>
                  <div className="flex flex-col ml-4 border-l border-border/40 pl-2 gap-0.5">
                    <div 
                      className="flex items-center justify-between px-2 py-1.5 bg-primary/10 rounded-md cursor-pointer group"
                      onClick={() => setSelectedFile("button.tsx")}
                    >
                      <div className="flex items-center gap-2 text-sm text-primary font-medium">
                        <FileText className="w-4 h-4" /> button.tsx
                      </div>
                    </div>
                    <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer text-sm text-foreground/80">
                      <FileText className="w-4 h-4 text-muted-foreground" /> input.tsx
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer text-sm text-foreground/80">
                    <FileText className="w-4 h-4 text-muted-foreground" /> utils.ts
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer text-sm text-foreground/80">
                    <FileText className="w-4 h-4 text-muted-foreground" /> main.ts
                  </div>
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer text-sm text-foreground/80">
                  <FileText className="w-4 h-4 text-muted-foreground" /> package.json
                </div>
                <div className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 rounded-md cursor-pointer text-sm text-foreground/80">
                  <FileText className="w-4 h-4 text-muted-foreground" /> README.md
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: File Preview */}
          <div className="flex-1 flex flex-col bg-background/50">
            {selectedFile ? (
              <>
                <div className="flex items-center justify-between p-3 border-b border-border/40 bg-card/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{selectedFile}</span>
                    <span className="text-xs text-muted-foreground ml-2">2.1 KB</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant={addedFiles.has(selectedFile) ? "secondary" : "default"}
                    className="h-7 text-xs px-3 shadow-glow-sm"
                    onClick={() => handleAddFile(selectedFile)}
                  >
                    {addedFiles.has(selectedFile) ? <><Check className="w-3.5 h-3.5 mr-1"/> Added to Context</> : <><Plus className="w-3.5 h-3.5 mr-1"/> Add to Context</>}
                  </Button>
                </div>
                <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-[#0A0A0C]">
                  <pre className="text-[13px] font-mono leading-relaxed text-foreground/80">
                    <code className="block">
<span className="text-pink-400">import</span> * <span className="text-pink-400">as</span> React <span className="text-pink-400">from</span> <span className="text-green-300">"react"</span>;{"\n"}
<span className="text-pink-400">import</span> {"{"} Slot {"}"} <span className="text-pink-400">from</span> <span className="text-green-300">"@radix-ui/react-slot"</span>;{"\n"}
<span className="text-pink-400">import</span> {"{"} cva, <span className="text-purple-400">type</span> VariantProps {"}"} <span className="text-pink-400">from</span> <span className="text-green-300">"class-variance-authority"</span>;{"\n"}
{"\n"}
<span className="text-pink-400">const</span> buttonVariants = <span className="text-blue-400">cva</span>({"\n"}
  <span className="text-green-300">"inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm..."</span>,{"\n"}
  {"{"}{"\n"}
    variants: {"{"}{"\n"}
      variant: {"{"}{"\n"}
        <span className="text-green-300">default</span>: <span className="text-green-300">"bg-primary text-primary-foreground hover:bg-primary/90"</span>,{"\n"}
        <span className="text-green-300">destructive</span>: <span className="text-green-300">"bg-destructive text-destructive-foreground hover:bg-destructive/90"</span>,{"\n"}
        <span className="text-green-300">outline</span>: <span className="text-green-300">"border border-input bg-background hover:bg-accent hover:text-accent-foreground"</span>,{"\n"}
      {"}"},{"\n"}
      size: {"{"}{"\n"}
        <span className="text-green-300">default</span>: <span className="text-green-300">"h-10 px-4 py-2"</span>,{"\n"}
        <span className="text-green-300">sm</span>: <span className="text-green-300">"h-9 rounded-md px-3"</span>,{"\n"}
        <span className="text-green-300">lg</span>: <span className="text-green-300">"h-11 rounded-md px-8"</span>,{"\n"}
        <span className="text-green-300">icon</span>: <span className="text-green-300">"h-10 w-10"</span>,{"\n"}
      {"}"},{"\n"}
    {"}"},{"\n"}
    defaultVariants: {"{"}{"\n"}
      variant: <span className="text-green-300">"default"</span>,{"\n"}
      size: <span className="text-green-300">"default"</span>,{"\n"}
    {"}"},{"\n"}
  {"}"}{"\n"}
);{"\n"}
                    </code>
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
                <File className="w-12 h-12 opacity-20" />
                <p className="text-sm">Select a file to preview</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
