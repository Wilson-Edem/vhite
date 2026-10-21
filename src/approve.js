import { createInterface } from "node:readline/promises";
import { relative } from "node:path";

export async function chooseProposals(root, proposals) {
  if (proposals.length === 0) {
    return [];
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(`\n${proposals.length} safe fix(es) available:\n`);

    proposals.forEach((proposal, index) => {
      console.log(
        ` ${index + 1}. ${relative(root, proposal.file)} line ${proposal.line}: ${proposal.message}`
      );

      console.log(
        ` Proposed change: delete this line: ${proposal.lineText}`
      );
    });

    console.log("");

    const answer = (
      await rl.question(
        "Enter fix numbers to apply (for example 1,3), type all, or press Enter to skip: "
      )
    ).trim().toLowerCase();

    if (answer === "") {
      return [];
    }

    if (answer === "all") {
      return proposals;
    }

    const picked = new Set();

    for (const part of answer.split(",")) {
      const entry = part.trim();

      if (entry === "") {
        continue;
      }

      const number = Number(entry);

      if (
        Number.isInteger(number) &&
        number >= 1 &&
        number <= proposals.length
      ) {
        picked.add(number - 1);
      } else {
        console.log(`Ignored "${entry}": not a fix number`);
      }
    }

    return [...picked]
      .sort((a, b) => a - b)
      .map((index) => proposals[index]);
  } finally {
    rl.close();
  }
}
