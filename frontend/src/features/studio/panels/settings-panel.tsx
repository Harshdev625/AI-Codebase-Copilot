import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Monitor, Moon, Sun, MonitorSmartphone, Code2 } from 'lucide-react';
import { useStudioStore } from '@/features/studio/store/studio-store';

export function SettingsPanel() {
  const [theme, setTheme] = React.useState<'light' | 'dark' | 'system'>('system');
  const { editorWordWrap, editorMinimap, setEditorWordWrap, setEditorMinimap } = useStudioStore();

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto custom-scrollbar bg-surface">
      <div className="p-4 space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2 mb-4">
            <MonitorSmartphone className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Appearance</h3>
          </div>

          <div className="space-y-3 pl-6">
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-foreground/80">Theme</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setTheme('light')}
                >
                  <Sun className="w-3 h-3 mr-2" /> Light
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setTheme('dark')}
                >
                  <Moon className="w-3 h-3 mr-2" /> Dark
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setTheme('system')}
                >
                  <Monitor className="w-3 h-3 mr-2" /> System
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-3 pt-4 border-t border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Code2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Editor</h3>
          </div>

          <div className="space-y-4 pl-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground/80">Word Wrap</Label>
                <p className="text-[10px] text-muted-foreground">Wrap lines that exceed the editor width.</p>
              </div>
              <Switch checked={editorWordWrap} onCheckedChange={setEditorWordWrap} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs text-foreground/80">Show Minimap</Label>
                <p className="text-[10px] text-muted-foreground">Display code minimap on the right side.</p>
              </div>
              <Switch checked={editorMinimap} onCheckedChange={setEditorMinimap} />
            </div>
          </div>
        </section>

        <section className="space-y-3 pt-4 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground italic pl-6">
            Backend-specific settings (e.g., model configurations, retention policies) are currently managed via environment variables.
          </p>
        </section>
      </div>
    </div>
  );
}
