"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { CopilotStudioShell } from "@/features/studio";
import { useStudioFeatureFlag } from "@/features/studio/hooks/use-studio-feature-flag";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";

function StudioPageContent() {
  const [mounted, setMounted] = React.useState(false);
  const studioEnabled = useStudioFeatureFlag();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedRepositoryId, setActiveSessionId, setSelectedRepositoryId, activeSessionId } =
    useStudioStore();
  const { repositories, isLoading } = useRepositories();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted || studioEnabled) return;
    router.replace("/workspace");
  }, [mounted, studioEnabled, router]);

  // Sync URL -> state (same contract as /workspace for Phase 0 parity)
  React.useEffect(() => {
    if (!mounted || !studioEnabled) return;
    const urlRepoId = searchParams.get("repository_id");
    const urlSessionId = searchParams.get("session_id");

    if (urlRepoId && urlRepoId !== selectedRepositoryId) setSelectedRepositoryId(urlRepoId);
    if (urlSessionId && urlSessionId !== activeSessionId) setActiveSessionId(urlSessionId);
  }, [
    searchParams,
    selectedRepositoryId,
    activeSessionId,
    setSelectedRepositoryId,
    setActiveSessionId,
    mounted,
    studioEnabled,
  ]);

  // Sync state -> URL
  React.useEffect(() => {
    if (!mounted || !studioEnabled) return;
    const currentRepo = searchParams.get("repository_id");
    const currentSession = searchParams.get("session_id");

    const params = new URLSearchParams(searchParams.toString());
    let changed = false;

    if (selectedRepositoryId && selectedRepositoryId !== currentRepo) {
      params.set("repository_id", selectedRepositoryId);
      changed = true;
    }
    if (activeSessionId && activeSessionId !== currentSession) {
      params.set("session_id", activeSessionId);
      changed = true;
    }

    if (changed) {
      router.replace(`?${params.toString()}`, { scroll: false });
    }
  }, [selectedRepositoryId, activeSessionId, mounted, router, searchParams, studioEnabled]);

  if (!mounted || !studioEnabled) {
    return <div className="h-screen w-screen bg-[#0B0D14]" />;
  }

  return (
    <div className="h-screen w-screen bg-[#0B0D14]">
      <CopilotStudioShell
        repositoryId={selectedRepositoryId || undefined}
        repositories={repositories}
        isRepositoriesLoading={isLoading}
      />
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#0B0D14]" />}>
      <StudioPageContent />
    </Suspense>
  );
}
