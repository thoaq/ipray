export function styleFromVars(vars: Record<string, string>): string {
	return Object.entries(vars)
		.map(([k, v]) => `${k}:${v}`)
		.join(';');
}
