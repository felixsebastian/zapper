export function formatEnvironments(environments: string[]): string {
  if (environments.length === 0) {
    return "No environments defined";
  }

  const sections: string[] = ["📋 Available environments"];

  for (const environment of environments) {
    sections.push(environment);
  }

  return sections.join("\n");
}

export function formatEnvironmentsAsJson(environments: string[]): string {
  return JSON.stringify(environments);
}
