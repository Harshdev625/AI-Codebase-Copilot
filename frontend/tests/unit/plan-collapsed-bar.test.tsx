import { render, screen } from "@testing-library/react";
import { PlanCollapsedBar } from "@/features/studio/components/plan-collapsed-bar";

const mockChangeSet: any = {
  plan_json: {
    summary: "Test plan summary",
  },
  plan_version: "1.0.0",
  status: "draft",
  plan_file_path: "/test/path/plan.json",
  steps: [
    { id: "1", title: "Step 1", description: "First step" },
    { id: "2", title: "Step 2", description: "Second step" },
  ],
};

describe("PlanCollapsedBar", () => {
  it("renders plan title", () => {
    render(<PlanCollapsedBar changeSet={mockChangeSet} />);
    expect(screen.getByText("Test plan summary")).toBeInTheDocument();
  });

  it("renders status badge", () => {
    render(<PlanCollapsedBar changeSet={mockChangeSet} />);
    expect(screen.getByText("draft")).toBeInTheDocument();
  });

  it("renders plan version", () => {
    render(<PlanCollapsedBar changeSet={mockChangeSet} />);
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
  });

  it("renders expand/collapse button", () => {
    const onExpand = jest.fn();
    render(<PlanCollapsedBar changeSet={mockChangeSet} onExpand={onExpand} />);
    expect(screen.getByText("Review")).toBeInTheDocument();
    expect(onExpand).not.toHaveBeenCalled();
  });

  it("renders tasks button when no plan_file_path", () => {
    const changeSetWithoutPath = { ...mockChangeSet, plan_file_path: undefined };
    render(<PlanCollapsedBar changeSet={changeSetWithoutPath} />);
    expect(screen.getByText("Tasks")).toBeInTheDocument();
  });

  it("renders file open button when plan_file_path exists", () => {
    const onOpenPlan = jest.fn();
    render(<PlanCollapsedBar changeSet={mockChangeSet} onOpenPlan={onOpenPlan} />);
    expect(screen.getByText("File")).toBeInTheDocument();
    expect(onOpenPlan).not.toHaveBeenCalled();
  });
});