import { render, screen } from "@testing-library/react";
import { PlanWorkflowStepper } from "@/features/studio/components/plan-workflow-stepper";

const ChangeSetStatus = {
  ACTIVE: "active" as const,
  DRAFT: "draft" as const,
  REVIEW: "review" as const,
  APPLIED: "applied" as const,
  CONFLICT: "conflict" as const,
};

describe("PlanWorkflowStepper", () => {
  it("renders without error when status is active", () => {
    const { container } = render(<PlanWorkflowStepper status={ChangeSetStatus.ACTIVE} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders without error when status is draft", () => {
    const { container } = render(<PlanWorkflowStepper status={ChangeSetStatus.DRAFT} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders phase numbers", () => {
    render(<PlanWorkflowStepper status={ChangeSetStatus.ACTIVE} />);

    // Phase numbers should be rendered as text
    const phaseNumbers = screen.getAllByText(/1|2|3|4/);
    expect(phaseNumbers.length).toBeGreaterThan(0);
  });

  it("renders phase step labels", () => {
    render(<PlanWorkflowStepper status={ChangeSetStatus.ACTIVE} />);

    // Phase step labels should be rendered
    const stepLabels = screen.getAllByText(/Plan|Approved|Applied|Conflict/);
    expect(stepLabels.length).toBeGreaterThan(0);
  });
});