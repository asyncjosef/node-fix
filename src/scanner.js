const fs = require("fs");
const path = require("path");

function scanProject(projectPath) {
    const absolutePath = path.resolve(projectPath);

    const result = {
        path: absolutePath,
        files: [],
        directories: [],
        packageJson: null
    };

    if (!fs.existsSync(absolutePath)) {
        throw new Error(
            `Project path does not exist: ${absolutePath}`
        );
    }

    const packagePath =
        path.join(absolutePath, "package.json");

    if (fs.existsSync(packagePath)) {
        try {
            const packageContent =
                fs.readFileSync(
                    packagePath,
                    "utf8"
                );

            result.packageJson =
                JSON.parse(packageContent);

        } catch {
            result.packageJson = "invalid";
        }
    }

    return result;
}

module.exports = {
    scanProject
};