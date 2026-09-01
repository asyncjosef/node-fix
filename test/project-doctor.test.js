const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { scanSecrets } = require("../src/security");
const {
    fixSecret,
    ensureEnvIgnored,
    ensureGitignore
} = require("../src/fixer");


function makeProject() {

    return fs.mkdtempSync(
        path.join(
            os.tmpdir(),
            "project-doctor-"
        )
    );
}


test("moves a known key, protects .env, and verifies clean scan", () => {

    const projectPath = makeProject();
    const sourcePath = path.join(projectPath, "index.js");
    const fakeKey = [
        "gsk_",
        "abcdefghijklmnopqrstuvwxyz"
    ].join("");

    fs.writeFileSync(
        sourcePath,
        `const key = "${fakeKey}";\n`,
        "utf8"
    );

    const findings = scanSecrets(projectPath);

    assert.equal(findings.length, 1);
    assert.equal(findings[0].type, "Groq API key");

    const result = fixSecret(projectPath, findings[0]);

    assert.equal(result.fixed, true);
    assert.equal(
        fs.readFileSync(sourcePath, "utf8"),
        "const key = process.env.GROQ_API_KEY;\n"
    );
    assert.match(
        fs.readFileSync(path.join(projectPath, ".env"), "utf8"),
        new RegExp(`GROQ_API_KEY=${fakeKey}`)
    );
    assert.equal(
        fs.readFileSync(path.join(projectPath, ".gitignore"), "utf8"),
        ".env\n"
    );
    assert.equal(scanSecrets(projectPath).length, 0);
});


test("preserves existing gitignore content and avoids duplicate env rules", () => {

    const projectPath = makeProject();
    const gitignorePath = path.join(projectPath, ".gitignore");

    fs.writeFileSync(
        gitignorePath,
        "node_modules/\n.env\n",
        "utf8"
    );

    const result = ensureEnvIgnored(projectPath);

    assert.equal(result.added, false);
    assert.equal(
        fs.readFileSync(gitignorePath, "utf8"),
        "node_modules/\n.env\n"
    );
});


test("creates a conservative gitignore only when missing", () => {

    const projectPath = makeProject();
    const result = ensureGitignore(projectPath);

    assert.equal(result.fixed, true);
    assert.equal(
        fs.readFileSync(path.join(projectPath, ".gitignore"), "utf8"),
        ".env\nnode_modules/\ndist/\n"
    );
});
