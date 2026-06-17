import { applyUnifiedDiff, splitUnifiedDiff } from "@/features/chat/utils/apply-unified-diff";

describe("apply-unified-diff", () => {
  it("applies a simple hunk", () => {
    const original = "line1\nline2\nline3";
    const patch = `--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-line2
+line2-modified
 line3`;
    expect(applyUnifiedDiff(original, patch)).toContain("line2-modified");
  });

  it("splits multi-file diffs", () => {
    const diff = `diff --git a/a.css b/a.css
--- a/a.css
+++ b/a.css
@@ -1 +1 @@
-x
+y
diff --git a/b.css b/b.css
--- a/b.css
+++ b/b.css
@@ -1 +1 @@
-old
+new`;
    const parts = splitUnifiedDiff(diff);
    expect(Object.keys(parts)).toEqual(expect.arrayContaining(["a.css", "b.css"]));
  });
});
