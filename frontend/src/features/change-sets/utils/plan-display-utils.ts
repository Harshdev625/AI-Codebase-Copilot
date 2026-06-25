/** Strip machine-readable JSON blocks from plan chat output. */
export function stripPlanJsonBlock(content: string): string {
  let cleaned = content.replace(/```json\s*[\s\S]*?```/gi, "");
  cleaned = cleaned.replace(/#{1,3}\s*machine-readable plan[\s\S]*$/i, "");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");
  return cleaned.trim();
}

export function extractPlanSummaryFromContent(content: string): string | null {
  const jsonMatch = content.match(/```json\s*([\s\S]*?)```/i);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim()) as {
        summary?: string;
        steps?: unknown[];
      };
      if (parsed.summary?.trim()) return parsed.summary.trim();
      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        return `${parsed.steps.length} implementation step${parsed.steps.length === 1 ? "" : "s"} ready for review.`;
      }
    } catch {
      /* ignore parse errors */
    }
  }
  const stripped = stripPlanJsonBlock(content);
  const firstPara = stripped.split("\n\n").map((s) => s.trim()).find(Boolean);
  if (firstPara && firstPara.length <= 240) return firstPara;
  return null;
}

export function messageLooksLikePlan(content: string): boolean {
  return /```json[\s\S]*?("steps"|"summary")/i.test(content);
}

export function planSavedMessage(_planFilePath?: string | null): string {
  return "Your plan is ready. Use **View plan** to open the full plan in Plan tasks.";
}
