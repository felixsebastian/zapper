export type ServiceType = "bare_metal" | "docker";
export type ActionType = "start" | "stop";

export interface Action {
  type: ActionType;
  serviceType: ServiceType;
  name: string;
}

export interface ActionPlan {
  actions: Action[];
}
