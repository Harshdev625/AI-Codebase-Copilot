"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { StudioV2Shell } from "@/features/studio/components/studio-v2-shell";
import { useStudioUrlSync } from "@/features/studio/hooks/use-studio-url-sync";
import { useStudioStore } from "@/features/studio/store/studio-store";
import { useRepositories } from "@/features/repositories/hooks/use-repositories";
import type { PrimarySidebar } from "@/features/studio/types/studio-types";

const TOOL_PANELS: PrimarySidebar[] = [
  "explorer",
  "search",
  "snapshots",
  "patches",
  "tasks",
];

export function StudioPageClient(): React.JSX.Element {
  const searchParams = useSearchParams();
  const { selectedRepositoryId, focusSidebar, setSidebarCollapsed } = useStudioStore();
  const { repositories, isLoading } = useRepositories();

  useStudioUrlSync();

  React.useEffect(() => {
    const panel = searchParams.get("panel") as PrimarySidebar | null;
    const file = searchParams.get("file");
    const patchId = searchParams.get("patch_id");

    setSidebarCollapsed(false);

    if (file || patchId) {
      focusSidebar(panel && TOOL_PANELS.includes(panel) ? panel : "explorer");
      return;
    }

    if (panel && panel !== "explorer" && TOOL_PANELS.includes(panel)) {
      focusSidebar(panel);
      return;
    }

    focusSidebar("sessions");
  }, [searchParams, focusSidebar, setSidebarCollapsed]);

  return (
    <div className="studio-workbench h-[100dvh] w-full overflow-hidden bg-[#0B0D14]">
      <StudioV2Shell
        repositoryId={selectedRepositoryId || undefined}
        repositories={repositories}
        isRepositoriesLoading={isLoading}
      />
    </div>
  );
}
