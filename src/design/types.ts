export interface DesignSkill {
  name: string;
  path: string;
  mode: "prototype" | "deck";
  platform: "desktop" | "mobile";
  scenario: string;
  description: string;
  featured: boolean;
  fidelity: "low" | "medium" | "high";
  preview?: {
    type: string;
    url?: string;
  };
  speaker_notes?: boolean;
  animations?: boolean;
  example_prompt?: string;
}

export interface DesignSystemSummary {
  name: string;
  category: string;
  description: string;
  path: string;
}

export interface DesignSystem {
  name: string;
  category: string;
  description: string;
  content: string;
  path: string;
}

export interface AgentInfo {
  name: string;
  displayName: string;
  protocol: "stdio" | "acp" | "rpc";
  path: string | null;
  available: boolean;
}

export interface ComposeParams {
  skillName?: string;
  designSystemName?: string;
  discoveryMode?: boolean;
  critiqueMode?: boolean;
  fidelity?: "low" | "medium" | "high";
  speakerNotes?: boolean;
  animations?: boolean;
  projectDescription?: string;
}
