"use client";

import * as React from "react";
import Link from "next/link";
import { Files, MessageSquare, Search, GitPullRequestDraft, Database } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";

export function WelcomeTab(): React.JSX.Element {
  const {
    selectedRepositoryId,
    focusSidebar,
    setAiPanelOpen,
    openWelcomeTab,
  } = useStudioStore();
  const { repositories } = useRepositories();
  const repo = repositories.find((r) => r.id === selectedRepositoryId);

  React.useEffect(() => {
    openWelcomeTab();
  }, [openWelcomeTab]);

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-8 bg-[#0B0D14] p-8 xl:p-12"
      data-testid="welcome-tab"
    >
      <div className="w-full max-w-2xl space-y-6 text-center xl:max-w-3xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl border border-[#2D313E] bg-[#1A1C23]">
          <Database className="h-7 w-7 text-[#58A6FF]" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[#E2E8F0] xl:text-2xl">
            {repo ? repo.repo_id.split("/").pop() : "Codebase Studio"}
          </h1>
          <p className="text-sm text-[#8B949E] xl:text-base">
            {repo
              ? "Browse files in the explorer, open editors in tabs, and use the AI assistant when you need it."
              : "Select a repository from the dashboard to start exploring your codebase."}
          </p>
        </div>

        {!selectedRepositoryId && (
          <Button asChild variant="outline" className="border-[#2D313E]">
            <Link href="/dashboard">Add a repository on the dashboard</Link>
          </Button>
        )}

        {selectedRepositoryId && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 border-[#2D313E] py-4"
              onClick={() => {
                // #region agent log
                fetch('http://127.0.0.1:7863/ingest/e55e1c64-8993-4a79-98e7-53d0e4bd1d58',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'16bbe5'},body:JSON.stringify({sessionId:'16bbe5',location:'welcome-tab.tsx:explorer',message:'Welcome Open Explorer clicked',data:{selectedRepositoryId},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                focusSidebar("explorer");
              }}
            >
              <Files className="h-5 w-5 text-[#58A6FF]" />
              <span className="text-sm font-medium">Open Explorer</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 border-[#2D313E] py-4"
              onClick={() => focusSidebar("search")}
            >
              <Search className="h-5 w-5 text-[#58A6FF]" />
              <span className="text-sm font-medium">Search Codebase</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 border-[#2D313E] py-4"
              onClick={() => focusSidebar("patches")}
            >
              <GitPullRequestDraft className="h-5 w-5 text-[#58A6FF]" />
              <span className="text-sm font-medium">Review Patches</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col gap-2 border-[#2D313E] py-4"
              onClick={() => {
                // #region agent log
                fetch('http://127.0.0.1:7863/ingest/e55e1c64-8993-4a79-98e7-53d0e4bd1d58',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'16bbe5'},body:JSON.stringify({sessionId:'16bbe5',location:'welcome-tab.tsx:ask-ai',message:'Welcome Ask AI clicked',data:{selectedRepositoryId},timestamp:Date.now(),hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                setAiPanelOpen(true);
                focusSidebar("sessions");
              }}
            >
              <MessageSquare className="h-5 w-5 text-[#58A6FF]" />
              <span className="text-sm font-medium">Ask AI</span>
              <span className="text-[10px] text-[#8B949E]">Ctrl+L</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
