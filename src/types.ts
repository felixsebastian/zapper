export type ServiceType = "bare_metal" | "docker";
export type ActionType = "start" | "stop";

export interface Action {
  type: ActionType;
  serviceType: ServiceType;
  name: string;
  healthCheck: number;
}

export interface ExecutionWave {
  actions: Action[];
}

export interface ActionPlan {
  waves: ExecutionWave[];
}
