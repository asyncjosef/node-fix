const fs = require("fs");
const path = require("path");


// ─────────────────────────────────────
// DIRECTORIES WE NEVER SCAN
// ─────────────────────────────────────

const IGNORED_DIRS = new Set([
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    ".cache",
    "out"
]);


// ─────────────────────────────────────
// FILES WE CAN SAFELY SCAN
// ─────────────────────────────────────

const FILE_EXTENSIONS = new Set([
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".mjs",
    ".cjs",
    ".json",
    ".yml",
    ".yaml"
]);


// ─────────────────────────────────────
// SECRET PATTERNS
// ─────────────────────────────────────

const SECRET_PATTERNS = [

    // Groq
    {
        type: "Groq API key",
        severity: "critical",
        envName: "GROQ_API_KEY",
        pattern: /\bgsk_[A-Za-z0-9_-]{20,}\b/g
    },

    // OpenAI
    {
        type: "OpenAI API key",
        severity: "critical",
        envName: "OPENAI_API_KEY",
        pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g
    },

    // GitHub classic tokens
    {
        type: "GitHub token",
        severity: "critical",
        envName: "GITHUB_TOKEN",
        pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g
    },

    // GitHub fine-grained tokens
    {
        type: "GitHub token",
        severity: "critical",
        envName: "GITHUB_TOKEN",
        pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g
    },

    // Google API keys
    {
        type: "Google API key",
        severity: "critical",
        envName: "GOOGLE_API_KEY",
        pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/g
    },

    // Slack tokens
    {
        type: "Slack token",
        severity: "critical",
        envName: "SLACK_TOKEN",
        pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/g
    },

    // JWT
    {
        type: "JWT token",
        severity: "high",
        envName: "JWT_SECRET",
        pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g
    },

    // Bearer token
    {
        type: "Bearer token",
        severity: "high",
        envName: "API_TOKEN",
        pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/gi
    }

];


// ─────────────────────────────────────
// GENERIC SECRET CONTEXT
// ─────────────────────────────────────

const GENERIC_SECRET_PATTERN =
    /\b(api[_-]?key|access[_-]?key|secret|token|password|auth[_-]?token)\b\s*[:=]\s*["'`]([^"'`\r\n]{8,})["'`]/gi;


// ─────────────────────────────────────
// PLACEHOLDER VALUES WE IGNORE
// ─────────────────────────────────────

const PLACEHOLDERS = new Set([
    "your_api_key",
    "your-api-key",
    "yourapikey",
    "api_key",
    "apikey",
    "secret",
    "your_secret",
    "your-secret",
    "password",
    "your_password",
    "your-password",
    "token",
    "your_token",
    "your-token",
    "xxx",
    "xxxxx",
    "changeme",
    "change_me",
    "example",
    "example_key",
    "test",
    "test_key"
]);


function isPlaceholder(value) {

    const normalized =
        value
            .trim()
            .toLowerCase();

    return PLACEHOLDERS.has(normalized);
}


// ─────────────────────────────────────
// COLLECT PROJECT FILES
// ─────────────────────────────────────

function collectFiles(directory, files = []) {

    let entries;

    try {

        entries =
            fs.readdirSync(
                directory,
                {
                    withFileTypes: true
                }
            );

    } catch {

        return files;
    }


    for (const entry of entries) {

        if (IGNORED_DIRS.has(entry.name)) {
            continue;
        }


        const fullPath =
            path.join(
                directory,
                entry.name
            );


        if (entry.isDirectory()) {

            collectFiles(
                fullPath,
                files
            );

            continue;
        }


        if (
            entry.name === ".env" ||
            entry.name.startsWith(".env.")
        ) {

            continue;
        }


        const extension =
            path.extname(
                entry.name
            ).toLowerCase();


        if (
            FILE_EXTENSIONS.has(extension)
        ) {

            files.push(fullPath);
        }
    }


    return files;
}


// ─────────────────────────────────────
// CHECK .ENV PROTECTION
// ─────────────────────────────────────

function isEnvIgnored(projectPath) {

    const gitignorePath =
        path.join(
            projectPath,
            ".gitignore"
        );


    if (!fs.existsSync(gitignorePath)) {
        return false;
    }


    const content =
        fs.readFileSync(
            gitignorePath,
            "utf8"
        );


    return content
        .split(/\r?\n/)
        .some(line => {

            const rule =
                line
                    .replace(/\s+#.*$/, "")
                    .trim();


            return (
                rule === ".env" ||
                rule === "/.env" ||
                rule === "**/.env" ||
                rule === ".env*" ||
                rule === "/.env*" ||
                rule === "*.env"
            );
        });
}


// ─────────────────────────────────────
// GET LINE NUMBER
// ─────────────────────────────────────

function getLineNumber(
    content,
    index
) {

    return (
        content
            .slice(0, index)
            .split("\n")
            .length
    );
}


// ─────────────────────────────────────
// CHECK IF VALUE IS ALREADY ENV-BASED
// ─────────────────────────────────────

function isEnvironmentReference(value) {

    return (
        value.includes("process.env.") ||
        value.includes("import.meta.env.") ||
        value.includes("env.")
    );
}


// ─────────────────────────────────────
// SCAN PROJECT FOR SECRETS
// ─────────────────────────────────────

function scanSecrets(projectPath) {

    const files =
        collectFiles(projectPath);

    const findings = [];

    const seen = new Set();


    const envPath =
        path.join(
            projectPath,
            ".env"
        );


    if (
        fs.existsSync(envPath) &&
        !isEnvIgnored(projectPath)
    ) {

        findings.push({

            type:
                ".env is not protected by .gitignore",

            severity:
                "medium",

            kind:
                "env-protection",

            file:
                path.join(
                    projectPath,
                    ".gitignore"
                ),

            line: 1,

            fix:
                "add .env to .gitignore"
        });
    }


    for (const file of files) {

        let content;

        try {

            content =
                fs.readFileSync(
                    file,
                    "utf8"
                );

        } catch {

            continue;
        }


        // ─────────────────────────────
        // KNOWN SECRET FORMATS
        // ─────────────────────────────

        for (const secret of SECRET_PATTERNS) {

            // Reset regex state
            secret.pattern.lastIndex = 0;


            const matches =
                content.matchAll(
                    secret.pattern
                );


            for (const match of matches) {

                const value =
                    match[0];


                if (isPlaceholder(value)) {
                    continue;
                }


                const key =
                    `${file}:${match.index}:${secret.type}`;


                if (seen.has(key)) {
                    continue;
                }


                seen.add(key);


                findings.push({

                    type: secret.type,

                    severity:
                        secret.severity,

                    envName:
                        secret.envName,

                    file,

                    line:
                        getLineNumber(
                            content,
                            match.index
                        ),

                    match: value

                });
            }
        }


        // ─────────────────────────────
        // GENERIC SECRET ASSIGNMENTS
        // ─────────────────────────────

        GENERIC_SECRET_PATTERN.lastIndex = 0;


        const genericMatches =
            content.matchAll(
                GENERIC_SECRET_PATTERN
            );


        for (
            const match of genericMatches
        ) {

            const variableName =
                match[1];

            const value =
                match[2];


            if (
                !value ||
                isPlaceholder(value) ||
                isEnvironmentReference(value)
            ) {

                continue;
            }


            // Ignore very short / obvious non-secrets
            if (value.length < 12) {
                continue;
            }


            const envName =
                variableName
                    .replace(
                        /([a-z])([A-Z])/g,
                        "$1_$2"
                    )
                    .replace(
                        /[-\s]+/g,
                        "_"
                    )
                    .toUpperCase();


            const key =
                `${file}:${match.index}:generic:${envName}`;


            if (seen.has(key)) {
                continue;
            }


            seen.add(key);


            findings.push({

                type:
                    `Hardcoded ${variableName}`,

                severity:
                    "high",

                envName,

                file,

                line:
                    getLineNumber(
                        content,
                        match.index
                    ),

                match:
                    match[2],

                variable:
                    variableName
            });
        }
    }


    return findings;
}


module.exports = {
    scanSecrets,
    isEnvIgnored
};
