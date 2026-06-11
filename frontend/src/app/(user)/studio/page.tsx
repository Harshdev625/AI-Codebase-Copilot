"use client";

import React, { Suspense } from "react";

import { CopilotStudioShell } from "@/features/studio";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";
import { useStudioUrlSync } from "@/features/studio/hooks/use-studio-url-sync";

function StudioPageContent() {
  const [mounted, setMounted] = React.useState(false);
  const { selectedRepositoryId } = useStudioStore();
  const { repositories, isLoading } = useRepositories();

  useStudioUrlSync();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
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
