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
