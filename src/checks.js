const fs = require("fs");
const path = require("path");


// ─────────────────────────────────────
// package.json
// ─────────────────────────────────────

function checkPackageJson(project) {

    if (!project.packageJson) {

        return {
            name: "package.json",
            status: "error",
            message: "package.json not found",
            fix: "run npm init"
        };

    }

    if (project.packageJson === "invalid") {

        return {
            name: "package.json",
            status: "error",
            message: "Invalid JSON",
            fix: "repair package.json syntax"
        };

    }

    return {
        name: "package.json",
        status: "ok",
        message: "package.json found"
    };
}


// ─────────────────────────────────────
// Project Name
// ─────────────────────────────────────

function checkProjectName(project) {

    const name =
        project.packageJson?.name;

    if (!name) {

        return {
            name: "Project Name",
            status: "warning",
            message: "Project name is missing",
            fix: "add a name to package.json"
        };

    }

    return {
        name: "Project Name",
        status: "ok",
        message: name
    };
}


// ─────────────────────────────────────
// Dependencies
// ─────────────────────────────────────

function checkNodeModules(project) {

    const nodeModules =
        path.join(
            project.path,
            "node_modules"
        );

    if (!fs.existsSync(nodeModules)) {

        return {
            name: "Dependencies",
            status: "warning",
            message: "node_modules not found",
            fix: "run npm install"
        };

    }

    return {
        name: "Dependencies",
        status: "ok",
        message: "node_modules found"
    };
}


// ─────────────────────────────────────
// .gitignore
// ─────────────────────────────────────

function checkGitignore(project) {

    const gitignore =
        path.join(
            project.path,
            ".gitignore"
        );

    if (!fs.existsSync(gitignore)) {

        return {
            name: ".gitignore",
            status: "warning",
            message: ".gitignore not found",
            fix: "create a .gitignore file"
        };

    }

    return {
        name: ".gitignore",
        status: "ok",
        message: ".gitignore found"
    };
}


// ─────────────────────────────────────
// NPM Scripts
// ─────────────────────────────────────

function checkScripts(project) {

    const scripts =
        project.packageJson?.scripts;

    if (!scripts) {

        return {
            name: "NPM Scripts",
            status: "warning",
            message: "No npm scripts configured",
            fix: "add appropriate npm scripts"
        };

    }

    const importantScripts = [
        "start",
        "dev",
        "build"
    ];

    const missing =
        importantScripts.filter(
            script => !scripts[script]
        );

    if (missing.length === 0) {

        return {
            name: "NPM Scripts",
            status: "ok",
            message: "All common scripts are present"
        };

    }

    return {
        name: "NPM Scripts",
        status: "warning",
        message:
            `Missing: ${missing.join(", ")}`,
        fix:
            `add ${missing.join(", ")} script${
                missing.length > 1
                    ? "s"
                    : ""
            }`
    };
}


// ─────────────────────────────────────
// Exports
// ─────────────────────────────────────

module.exports = {

    checkPackageJson,
    checkProjectName,
    checkNodeModules,
    checkGitignore,
    checkScripts

};