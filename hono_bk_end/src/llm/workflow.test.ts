import { run_workflow, type WorkflowStep } from "./workflow.js";

type TestState = {
	events: string[];
	done?: boolean;
	queueRef: WorkflowStep<TestState>[];
};

describe("run_workflow", () => {
	it("runs steps in order", async () => {
		const steps: WorkflowStep<TestState>[] = [
			(state) => ({ ...state, events: [...state.events, "a"] }),
			async (state) => ({ ...state, events: [...state.events, "b"] }),
		];
		const result = await run_workflow(
			{ events: [], queueRef: steps },
			steps,
		);

		expect(result.state.events).toEqual(["a", "b"]);
		expect(result.stepCount).toBe(2);
		expect(result.remainingStepCount).toBe(0);
	});

	it("allows a step to append follow-up steps to the active queue", async () => {
		const steps: WorkflowStep<TestState>[] = [
			(state) => {
				state.queueRef.push((next) => ({
					...next,
					events: [...next.events, "retry"],
				}));
				return { ...state, events: [...state.events, "parse"] };
			},
		];
		const result = await run_workflow(
			{ events: [], queueRef: steps },
			steps,
		);

		expect(result.state.events).toEqual(["parse", "retry"]);
		expect(result.stepCount).toBe(2);
	});

	it("stops before running the next step when shouldStop matches", async () => {
		const steps: WorkflowStep<TestState>[] = [
			(state) => ({ ...state, events: [...state.events, "a"], done: true }),
			(state) => ({ ...state, events: [...state.events, "b"] }),
		];
		const result = await run_workflow(
			{ events: [], queueRef: steps },
			steps,
			{ shouldStop: (state) => state.done === true },
		);

		expect(result.state.events).toEqual(["a"]);
		expect(result.stepCount).toBe(1);
		expect(result.remainingStepCount).toBe(1);
	});

	it("honors maxSteps", async () => {
		const steps: WorkflowStep<TestState>[] = [
			(state) => {
				state.queueRef.push((next) => ({
					...next,
					events: [...next.events, "again"],
				}));
				return { ...state, events: [...state.events, "start"] };
			},
		];
		const result = await run_workflow(
			{ events: [], queueRef: steps },
			steps,
			{ maxSteps: 1 },
		);

		expect(result.state.events).toEqual(["start"]);
		expect(result.stepCount).toBe(1);
		expect(result.remainingStepCount).toBe(1);
	});
});
