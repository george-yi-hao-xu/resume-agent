export type WorkflowStep<TState> = (
	state: TState,
) => TState | Promise<TState>;

export type WorkflowRunResult<TState> = {
	state: TState;
	stepCount: number;
	remainingStepCount: number;
};

export async function run_workflow<TState>(
	initialState: TState,
	steps: WorkflowStep<TState>[],
	options: {
		maxSteps?: number;
		shouldStop?: (state: TState) => boolean;
	} = {},
): Promise<WorkflowRunResult<TState>> {
	const queue = steps;
	let state = initialState;
	let stepCount = 0;
	const maxSteps = options.maxSteps ?? 30;

	while (
		queue.length > 0 &&
		stepCount < maxSteps &&
		!options.shouldStop?.(state)
	) {
		const step = queue.shift();
		if (!step) break;
		state = await step(state);
		stepCount++;
	}

	return {
		state,
		stepCount,
		remainingStepCount: queue.length,
	};
}
