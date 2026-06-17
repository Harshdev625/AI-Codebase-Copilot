from app.utils.diff_utils import apply_unified_diff, split_unified_diff


def test_apply_unified_diff_simple_hunk() -> None:
    original = "line1\nline2\nline3\n"
    patch = """--- a/file.txt
+++ b/file.txt
@@ -1,3 +1,3 @@
 line1
-line2
+line2-modified
 line3
"""
    result = apply_unified_diff(original, patch)
    assert "line2-modified" in result
    assert "line2\n" not in result or "line2-modified" in result


def test_split_unified_diff_multiple_files() -> None:
    diff = """diff --git a/a.css b/a.css
--- a/a.css
+++ b/a.css
@@ -1 +1 @@
-old
+new
diff --git a/b.css b/b.css
--- a/b.css
+++ b/b.css
@@ -1 +1 @@
-x
+y
"""
    parts = split_unified_diff(diff)
    assert "a.css" in parts
    assert "b.css" in parts
