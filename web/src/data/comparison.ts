export interface ComparisonRow {
  label: string;
  agent: string;
  official: string;
  agentGood: boolean;
}

export const comparisonData: ComparisonRow[] = [
  {
    label: "Processes",
    agent: "1",
    official: "44",
    agentGood: true,
  },
  {
    label: "Memory (RSS)",
    agent: "~0.8 MB",
    official: "225 MB",
    agentGood: true,
  },
  {
    label: "Binary Size",
    agent: "~2.3 MB",
    official: "~50+ MB combined",
    agentGood: true,
  },
  {
    label: "Threads",
    agent: "~10",
    official: "~130+",
    agentGood: true,
  },
  {
    label: "Telemetry",
    agent: "None",
    official: "Phones home to iot.zte.com.cn",
    agentGood: true,
  },
  {
    label: "App",
    agent: "Open-source iOS/Android",
    official: "Closed-source, Chinese-only",
    agentGood: true,
  },
];
