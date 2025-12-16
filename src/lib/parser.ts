export interface ParsedCommand {
    raw: string;
    commandName: string;
    args: string[];
    error?: string;
}

const ALIASES: Record<string, string> = {
    "?": "help",
    "dir": "ls",
    "goto": "cd",
    "read": "cat",
    "tldr": "summary",
};

export function parseCommand(input: string): ParsedCommand | null {
    if (!input || input.trim().length === 0) return null;

    const tokens: string[] = [];
    let currentToken = "";
    let insideQuote: string | null = null; // ' or "
    let escaping = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (escaping) {
            currentToken += char;
            escaping = false;
            continue;
        }

        if (char === "\\") {
            escaping = true;
            continue;
        }

        if (insideQuote) {
            if (char === insideQuote) {
                insideQuote = null; // Close quote
            } else {
                currentToken += char;
            }
            continue;
        }

        if (char === '"' || char === "'") {
            insideQuote = char;
            continue;
        }

        if (/\s/.test(char)) {
            if (currentToken.length > 0) {
                tokens.push(currentToken);
                currentToken = "";
            }
            continue;
        }

        // Normal char
        currentToken += char;
    }

    // Check valid state
    if (insideQuote !== null) {
        return {
            raw: input,
            commandName: "", // invalid
            args: [],
            error: "Unclosed quote found.",
        };
    }

    if (currentToken.length > 0) {
        tokens.push(currentToken);
    }

    if (tokens.length === 0) return null;

    const rawCmd = tokens[0].toLowerCase();
    const args = tokens.slice(1);
    const commandName = ALIASES[rawCmd] || rawCmd;

    return {
        raw: input,
        commandName,
        args,
    };
}
