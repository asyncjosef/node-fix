
const fs = require("fs");
const path = require("path");


// ─────────────────────────────────────
// ENV FILE
// ─────────────────────────────────────

function ensureEnvFile(projectPath) {

    const envPath =
        path.join(
            projectPath,
            ".env"
        );

    if (!fs.existsSync(envPath)) {

        fs.writeFileSync(
            envPath,
            "",
            "utf8"
        );
    }

    return envPath;
}


// ─────────────────────────────────────
// PROTECT ENV FILE
// ─────────────────────────────────────

function ensureEnvIgnored(projectPath) {

    const gitignorePath =
        path.join(
            projectPath,
            ".gitignore"
        );


    let content =
        fs.existsSync(gitignorePath)
            ? fs.readFileSync(gitignorePath, "utf8")
            : "";


    const alreadyIgnored =
        content
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


    if (alreadyIgnored) {

        return {
            fixed: true,
            added: false,
            gitignorePath
        };
    }


    if (
        content.length > 0 &&
        !content.endsWith("\n")
    ) {

        content += "\n";
    }


    content += ".env\n";


    fs.writeFileSync(
        gitignorePath,
        content,
        "utf8"
    );


    return {
        fixed: true,
        added: true,
        gitignorePath
    };
}


function ensureGitignore(projectPath) {

    const gitignorePath =
        path.join(
            projectPath,
            ".gitignore"
        );


    if (fs.existsSync(gitignorePath)) {

        return {
            fixed: false,
            gitignorePath
        };
    }


    fs.writeFileSync(
        gitignorePath,
        ".env\nnode_modules/\ndist/\n",
        "utf8"
    );


    return {
        fixed: true,
        gitignorePath
    };
}


function ensureReadme(projectPath, packageJson) {

    const readmePath =
        path.join(
            projectPath,
            "README.md"
        );


    if (fs.existsSync(readmePath)) {

        return {
            fixed: false,
            readmePath
        };
    }


    const name =
        packageJson?.name || path.basename(projectPath);

    const description =
        packageJson?.description ||
        "A JavaScript project.";


    fs.writeFileSync(
        readmePath,
        `# ${name}\n\n${description}\n`,
        "utf8"
    );


    return {
        fixed: true,
        readmePath
    };
}


// ─────────────────────────────────────
// ADD VALUE TO .ENV
// ─────────────────────────────────────

function addToEnv(
    envPath,
    key,
    value
) {

    let content =
        fs.readFileSync(
            envPath,
            "utf8"
        );


    // Check whether the variable already exists.
    const escapedKey =
        key.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );


    const existing =
        new RegExp(
            `^\\s*${escapedKey}\\s*=`,
            "m"
        );


    if (existing.test(content)) {

        return {
            added: false,
            reason: "already-exists"
        };
    }


    // Keep the existing .env formatting intact.
    if (
        content.length > 0 &&
        !content.endsWith("\n")
    ) {

        content += "\n";
    }


    content +=
        `${key}=${value}\n`;


    fs.writeFileSync(
        envPath,
        content,
        "utf8"
    );


    return {
        added: true
    };
}


// ─────────────────────────────────────
// REPLACE EXACT SECRET
// ─────────────────────────────────────

function replaceSecret(
    filePath,
    secret,
    envName,
    line
) {

    let content =
        fs.readFileSync(
            filePath,
            "utf8"
        );


    const replacement =
        `process.env.${envName}`;


    // Find the specific line first.
    const lines =
        content.split("\n");


    const lineIndex =
        line - 1;


    if (
        lineIndex < 0 ||
        lineIndex >= lines.length
    ) {

        return {
            replaced: false,
            reason: "line-not-found"
        };
    }


    const originalLine =
        lines[lineIndex];


    // Make sure the secret is actually
    // present on the expected line.
    const secretIndex =
        originalLine.indexOf(secret);


    if (secretIndex === -1) {

        return {
            replaced: false,
            reason: "secret-not-found"
        };
    }


    const quote =
        originalLine[secretIndex - 1];

    const closesValue =
        originalLine[secretIndex + secret.length] === quote;

    const isSimpleAssignment =
        /^(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*["'`][^"'`\r\n]+["'`]\s*;?\s*$/.test(
            originalLine.trim()
        );


    if (
        closesValue &&
        (quote === "\"" || quote === "'" || quote === "`") &&
        isSimpleAssignment
    ) {

        lines[lineIndex] =
            originalLine.slice(
                0,
                secretIndex - 1
            ) +
            replacement +
            originalLine.slice(
                secretIndex + secret.length + 1
            );


        fs.writeFileSync(
            filePath,
            lines.join("\n"),
            "utf8"
        );


        return {
            replaced: true
        };
    }


    // Replace ONLY the occurrence on
    // the exact line reported by scanner.
    lines[lineIndex] =
        originalLine.slice(
            0,
            secretIndex
        ) +
        replacement +
        originalLine.slice(
            secretIndex + secret.length
        );


    const updatedContent =
        lines.join("\n");


    fs.writeFileSync(
        filePath,
        updatedContent,
        "utf8"
    );


    return {
        replaced: true
    };
}


// ─────────────────────────────────────
// FIX ONE SECRET
// ─────────────────────────────────────

function fixSecret(
    projectPath,
    finding
) {

    if (finding.kind === "env-protection") {

        return ensureEnvIgnored(projectPath);
    }

    // Only automatically fix high-confidence
    // secrets.
    if (
        finding.severity !== "critical" &&
        finding.severity !== "high"
    ) {

        return {
            fixed: false,
            reason: "low-confidence-secret"
        };
    }


    if (
        !finding.envName ||
        !finding.match ||
        !finding.file
    ) {

        return {
            fixed: false,
            reason: "incomplete-finding"
        };
    }


    const envPath =
        ensureEnvFile(
            projectPath
        );


    ensureEnvIgnored(
        projectPath
    );


    // Add the original secret to .env.
    const envResult =
        addToEnv(
            envPath,
            finding.envName,
            finding.match
        );


    // If the variable already exists in .env,
    // do NOT overwrite it automatically.
    if (
        !envResult.added &&
        envResult.reason === "already-exists"
    ) {

        return {
            fixed: false,
            reason: "env-variable-exists",
            envName: finding.envName,
            envPath
        };
    }


    // Replace the exact occurrence.
    const replaceResult =
        replaceSecret(
            finding.file,
            finding.match,
            finding.envName,
            finding.line
        );


    // If replacement failed, remove the
    // value we just added to .env so we
    // don't leave the project half-fixed.
    if (!replaceResult.replaced) {

        rollbackEnvEntry(
            envPath,
            finding.envName,
            finding.match
        );


        return {
            fixed: false,
            reason: replaceResult.reason,
            envName: finding.envName,
            envPath
        };
    }


    return {
        fixed: true,
        envName: finding.envName,
        envPath
    };
}


// ─────────────────────────────────────
// ROLLBACK
// ─────────────────────────────────────

function rollbackEnvEntry(
    envPath,
    key,
    value
) {

    let content =
        fs.readFileSync(
            envPath,
            "utf8"
        );


    const line =
        `${key}=${value}`;


    const lines =
        content.split("\n");


    const index =
        lines.indexOf(line);


    if (index !== -1) {

        lines.splice(
            index,
            1
        );

        fs.writeFileSync(
            envPath,
            lines.join("\n"),
            "utf8"
        );
    }
}


module.exports = {
    fixSecret,
    ensureEnvIgnored,
    ensureGitignore,
    ensureReadme
};