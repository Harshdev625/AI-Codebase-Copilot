from fastapi import APIRouter

from app.models.api_models import ToolRequest, ToolResponse
from app.tools.file_tools import read_file
from app.tools.git_tools import git_status
from app.tools.safety import is_command_allowed
from app.tools.terminal_tools import run_command

router = APIRouter(tags=["tools"])


@router.post("/tools/execute", response_model=ToolResponse)
def execute_tool(req: ToolRequest) -> ToolResponse:
    if req.tool_name == "read_file":
        path = str(req.args.get("path", ""))
        output = read_file(path)
        return ToolResponse(success=True, output=output)

    if req.tool_name == "git_status":
        repo_path = str(req.args.get("repo_path", "."))
        output = git_status(repo_path)
        return ToolResponse(success=True, output=output)

    if req.tool_name == "run_command":
        command = str(req.args.get("command", ""))
        cwd = req.args.get("cwd")
        if not is_command_allowed(command):
            return ToolResponse(success=False, output="Blocked by safety policy")
        output = run_command(command=command, cwd=cwd)
        return ToolResponse(success=True, output=output)

    return ToolResponse(success=False, output="Unsupported tool")
