"""App initialization - handle platform-specific compatibility."""

import multiprocessing
import platform


def _patch_multiprocessing_for_windows() -> None:
    """
    Patch multiprocessing on Windows to handle RQ compatibility.
    
    RQ tries to use 'fork' context by default (Unix-only).
    On Windows, we patch get_context to return 'spawn' for 'fork' requests.
    """
    if platform.system() == "Windows":
        original_get_context = multiprocessing.get_context
        
        def patched_get_context(method=None):
            # Replace 'fork' with 'spawn' on Windows
            if method == "fork":
                method = "spawn"
            return original_get_context(method)
        
        multiprocessing.get_context = patched_get_context


_patch_multiprocessing_for_windows()
