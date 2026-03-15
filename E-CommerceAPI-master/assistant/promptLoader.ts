import fs from "fs";
import path from "path";

const PROMPT_FILES = [
  "role.md",
  "tone.md",
  "rules.md",
  "tools.md",
  "output.md",
  "context.md",
  "examples.md",
] as const;

const candidatePromptDirectories = [
  path.resolve(process.cwd(), "assistant/prompts"),
  path.resolve(process.cwd(), "E-CommerceAPI-master/assistant/prompts"),
  path.resolve(__dirname, "prompts"),
  path.resolve(__dirname, "../assistant/prompts"),
];

const promptDirectory = candidatePromptDirectories.find((candidatePath) => fs.existsSync(candidatePath)) ?? null;

const readPromptFile = (fileName: (typeof PROMPT_FILES)[number]) => {
  if (!promptDirectory) {
    return "";
  }

  const filePath = path.resolve(promptDirectory, fileName);

  if (!fs.existsSync(filePath)) {
    return "";
  }

  try {
    return fs.readFileSync(filePath, "utf8").trim();
  } catch {
    return "";
  }
};

const staticPromptSections = PROMPT_FILES.map((fileName) => ({
  fileName,
  content: readPromptFile(fileName),
})).filter((entry) => entry.content);

const buildRuntimeContext = (userContext?: { productId?: string; productName?: string; route?: string }) =>
  [
    userContext?.route ? `Current route: ${userContext.route}` : null,
    userContext?.productId ? `Current productId in context: ${userContext.productId}` : null,
    userContext?.productName ? `Current product in context: ${userContext.productName}` : null,
    userContext?.productId || userContext?.productName
      ? "If the user gives a short follow-up like a capacity, color, or availability question, treat it as referring to the current product in context unless they clearly switch products."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

export const getAssistantInstructions = (userContext?: { productId?: string; productName?: string; route?: string }) => {
  const runtimeContext = buildRuntimeContext(userContext);
  const sections = [
    ...staticPromptSections.map((entry) => entry.content),
    runtimeContext,
  ].filter(Boolean);

  return sections.length ? sections.join("\n\n") : undefined;
};
