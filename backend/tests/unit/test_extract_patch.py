from app.services.query_service import QueryService


def test_extract_patch_from_fenced_diff() -> None:
    text = """Here is the patch:

```diff
diff --git a/src/a.css b/src/a.css
--- a/src/a.css
+++ b/src/a.css
@@ -1 +1 @@
-old
+new
```
"""
    patch = QueryService.extract_patch_from_text(text)
    assert patch is not None
    assert "diff --git" in patch
    assert "a.css" in patch


def test_extract_patch_from_raw_diff_git() -> None:
    text = "diff --git a/foo.py b/foo.py\n--- a/foo.py\n+++ b/foo.py\n"
    patch = QueryService.extract_patch_from_text(text)
    assert patch is not None
    assert patch.startswith("diff --git")


def test_extract_patch_from_triple_dash() -> None:
    text = "--- a/foo.py\n+++ b/foo.py\n@@\n"
    patch = QueryService.extract_patch_from_text(text)
    assert patch is not None
    assert patch.startswith("--- a/foo.py")


def test_extract_patch_returns_none_for_plain_text() -> None:
    assert QueryService.extract_patch_from_text("no patch here") is None
    assert QueryService.extract_patch_from_text("") is None
