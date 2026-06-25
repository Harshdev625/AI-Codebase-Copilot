import { migrateExplorerFirstIfIdle, createDefaultPersistV2 } from "@/features/studio/store/migrate-studio-storage";
import { WELCOME_TAB_ID } from "@/features/studio/types/studio-types";

describe("migrate-studio-storage", () => {
  it("defaults to explorer-first layout", () => {
    const defaults = createDefaultPersistV2();
    expect(defaults.primarySidebar).toBe("explorer");
    expect(defaults.aiPanelOpen).toBe(false);
    expect(defaults.mobileTab).toBe("files");
  });

  it("migrates idle chat-first persisted state to explorer-first", () => {
    const idle = {
      ...createDefaultPersistV2(),
      primarySidebar: "sessions" as const,
      aiPanelOpen: true,
      activeSessionId: null,
      editorTabs: [{ id: WELCOME_TAB_ID, kind: "welcome" as const, title: "Welcome" }],
    };

    const migrated = migrateExplorerFirstIfIdle(idle);
    expect(migrated.primarySidebar).toBe("explorer");
    expect(migrated.aiPanelOpen).toBe(false);
  });

  it("does not migrate when user has an active session", () => {
    const activeChat = {
      ...createDefaultPersistV2(),
      primarySidebar: "sessions" as const,
      aiPanelOpen: true,
      activeSessionId: "session-1",
    };

    const migrated = migrateExplorerFirstIfIdle(activeChat);
    expect(migrated.primarySidebar).toBe("sessions");
    expect(migrated.aiPanelOpen).toBe(true);
  });
});
