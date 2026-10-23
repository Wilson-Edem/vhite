import {
  writeFile,
  readFile,
  appendFile,
} from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { rules } from "../../rules/index.js";

export const CONFIG_NAME = "vhite.config.json";

export function canAskQuestions() {
  return Boolean(
    process.stdin.isTTY &&
    process.stdout.isTTY &&
    !process.env.CI
  );
}

async function ensureConfigIgnored(root) {
  const gitignorePath = join(root, ".gitignore");
  const entry = CONFIG_NAME;

  let contents = "";

  try {
    contents = await readFile(gitignorePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const alreadyIgnored = contents
    .split(/\r?\n/)
    .some((line) => line.trim() === entry);

  if (alreadyIgnored) return;

  const prefix =
    contents.length > 0 && !contents.endsWith("\n")
      ? "\n"
      : "";

  await appendFile(
    gitignorePath,
    `${prefix}${entry}\n`,
    "utf8"
  );
}

export async function runFirstTimeSetup(root) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(
      `No ${CONFIG_NAME} found. Choose which rules to turn off.`
    );

    rules.forEach((rule, index) => {
      console.log(
        `  ${index + 1}. ${rule.name}: ${rule.description}`
      );
    });

    console.log("");

    const answer = (
      await rl.question(
        "Enter rule numbers separated by commas (for example 1,3), or press Enter to use all rules: "
      )
    ).trim();

    const disabled = new Set();

    if (answer !== "") {
      for (const part of answer.split(",")) {
        const entry = part.trim();
        if (entry === "") continue;

        const number = Number(entry);

        if (
          Number.isInteger(number) &&
          number >= 1 &&
          number <= rules.length
        ) {
          disabled.add(rules[number - 1].name);
        } else {
          console.log(
            `Ignored "${entry}": not a rule number`
          );
        }
      }
    }

    const config = {
      disabledRules: [...disabled],
    };

    await writeFile(
      join(root, CONFIG_NAME),
      JSON.stringify(config, null, 2) + "\n",
      "utf8"
    );

    await ensureConfigIgnored(root);

    console.log(`Saved ${CONFIG_NAME}`);
  } finally {
    rl.close();
  }
}