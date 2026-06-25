import time
import logging
from pathlib import Path
from app.services.validation_providers import (
    PythonValidationProvider,
    TypeScriptValidationProvider
)

logger = logging.getLogger(__name__)

class ValidationEngine:
    def __init__(self) -> None:
        self.providers = {
            ".py": PythonValidationProvider(),
            ".ts": TypeScriptValidationProvider(),
            ".tsx": TypeScriptValidationProvider(),
            ".js": TypeScriptValidationProvider(),
            ".jsx": TypeScriptValidationProvider(),
        }

    def get_provider(self, file_path: str):
        suffix = Path(file_path).suffix.lower()
        return self.providers.get(suffix)

    def validate_patch(
        self,
        sandbox_path: Path,
        patch_id: str,
        modified_files: list[str]
    ) -> tuple[bool, str]:
        """
        Executes validation pipeline stages in sequence:
        1. PATCH APPLY (Assumed already completed by SandboxManager)
        2. AST VALIDATION
        3. FORMAT CHECK
        4. LINT
        5. TYPE CHECK
        6. TEST EXECUTION

        Enforces a hard limit timeout of 180 seconds across the entire pipeline.
        """
        start_time = time.perf_counter()
        hard_timeout = 180.0
        logs = []

        logs.append(f"Starting validation pipeline for patch {patch_id}")
        
        stages = [
            ("AST VALIDATION", "validate_ast"),
            ("FORMAT CHECK", "run_format_check"),
            ("LINT", "run_lint"),
            ("TYPE CHECK", "run_type_check"),
        ]

        # Stage 2-5: File-specific validation
        for stage_name, method_name in stages:
            for file_rel in modified_files:
                # Check hard timeout
                elapsed = time.perf_counter() - start_time
                if elapsed > hard_timeout:
                    return False, "\n".join(logs) + f"\n[ERROR] Pipeline exceeded hard timeout of {hard_timeout}s."

                provider = self.get_provider(file_rel)
                if not provider:
                    logger.debug(f"No validation provider found for file {file_rel}, skipping {stage_name}")
                    continue

                file_path = sandbox_path / file_rel
                if not file_path.exists():
                    continue

                logs.append(f"[{stage_name}] Checking file {file_rel}")
                success, output = getattr(provider, method_name)(sandbox_path, file_path)
                logs.append(output)

                if not success:
                    logs.append(f"[ERROR] Stage {stage_name} failed on {file_rel}.")
                    return False, "\n".join(logs)

        # Stage 6: Test execution
        elapsed = time.perf_counter() - start_time
        if elapsed > hard_timeout:
            return False, "\n".join(logs) + f"\n[ERROR] Pipeline exceeded hard timeout of {hard_timeout}s."

        logs.append("[TEST EXECUTION] Running test suite")
        # Gather all providers involved
        active_providers = set()
        for file_rel in modified_files:
            provider = self.get_provider(file_rel)
            if provider:
                active_providers.add(provider)

        affected_paths = [sandbox_path / f for f in modified_files]
        for provider in active_providers:
            success, output = provider.run_tests(sandbox_path, affected_paths)
            logs.append(output)
            if not success:
                logs.append("[ERROR] Test execution failed.")
                return False, "\n".join(logs)

        logs.append("[SUCCESS] Validation pipeline completed successfully.")
        return True, "\n".join(logs)
