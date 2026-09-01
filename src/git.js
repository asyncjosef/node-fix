const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");


function runGit(projectPath, args) {

    return execFileSync(
        "git",
        args,
        {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"]
        }
    ).trim();
}


function assertGitRepository(projectPath) {

    try {

        runGit(
            projectPath,
            ["rev-parse", "--show-toplevel"]
        );

    } catch {

        throw new Error(
            "This project is not inside a Git repository."
        );
    }
}


function isGitRepository(projectPath) {

    try {

        runGit(
            projectPath,
            ["rev-parse", "--show-toplevel"]
        );

        return true;

    } catch {

        return false;
    }
}


function ensureGitHubRemote(projectPath, username, repository) {

    if (
        !/^[A-Za-z0-9_.-]+$/.test(username) ||
        !/^[A-Za-z0-9_.-]+$/.test(repository)
    ) {

        throw new Error(
            "GitHub username and repository must contain only letters, numbers, dots, hyphens, or underscores."
        );
    }


    if (!isGitRepository(projectPath)) {

        runGit(
            projectPath,
            ["init"]
        );
    }


    const remoteUrl =
        `https://github.com/${username}/${repository}.git`;


    let existingRemote = "";

    try {

        existingRemote =
            runGit(
                projectPath,
                ["remote", "get-url", "origin"]
            );

    } catch {

        runGit(
            projectPath,
            ["remote", "add", "origin", remoteUrl]
        );
    }


    if (
        existingRemote &&
        existingRemote !== remoteUrl
    ) {

        throw new Error(
            `Git remote origin already points to ${existingRemote}.`
        );
    }


    return remoteUrl;
}


function prepareGitHub(
    projectPath,
    username,
    repository,
    shouldPush,
    message
) {

    const remoteUrl =
        ensureGitHubRemote(
            projectPath,
            username,
            repository
        );


    runGit(
        projectPath,
        ["add", "--all"]
    );


    const stagedCheck =
        runGit(
            projectPath,
            ["diff", "--cached", "--check"]
        );


    if (stagedCheck) {

        throw new Error(
            "The staged diff contains whitespace errors."
        );
    }


    const stagedFiles =
        runGit(
            projectPath,
            ["diff", "--cached", "--name-only"]
        );


    if (!stagedFiles) {

        throw new Error(
            "No changes are ready to publish."
        );
    }


    if (!shouldPush) {

        return {
            files: stagedFiles.split(/\r?\n/),
            remoteUrl,
            pushed: false
        };
    }


    if (!message || !message.trim()) {

        throw new Error(
            "A commit message is required when using --push."
        );
    }


    runGit(
        projectPath,
        ["commit", "-m", message.trim()]
    );

    runGit(
        projectPath,
        ["push", "-u", "origin", "HEAD"]
    );


    return {
        files: stagedFiles.split(/\r?\n/),
        remoteUrl,
        pushed: true
    };
}


function normalizeFiles(projectPath, files) {

    const normalized = files.map(file => {

        const absolutePath =
            path.resolve(
                projectPath,
                file
            );

        const relativePath =
            path.relative(
                projectPath,
                absolutePath
            );

        if (
            !relativePath ||
            relativePath.startsWith("..") ||
            path.isAbsolute(relativePath)
        ) {

            throw new Error(
                `File is outside the project: ${file}`
            );
        }

        if (!fs.existsSync(absolutePath)) {

            throw new Error(
                `File does not exist: ${file}`
            );
        }

        return relativePath;
    });

    return [...new Set(normalized)];
}


function prepareGit(projectPath, files, shouldPush, message) {

    assertGitRepository(projectPath);

    const selectedFiles =
        normalizeFiles(
            projectPath,
            files
        );

    if (selectedFiles.length === 0) {

        throw new Error(
            "Choose at least one file to prepare."
        );
    }

    runGit(
        projectPath,
        ["add", "--", ...selectedFiles]
    );

    const stagedCheck =
        runGit(
            projectPath,
            ["diff", "--cached", "--check"]
        );

    if (stagedCheck) {

        throw new Error(
            "The staged diff contains whitespace errors."
        );
    }

    const stagedFiles =
        runGit(
            projectPath,
            ["diff", "--cached", "--name-only"]
        );

    if (!stagedFiles) {

        throw new Error(
            "No changes were staged."
        );
    }

    if (!shouldPush) {

        return {
            files: stagedFiles.split(/\r?\n/),
            pushed: false
        };
    }

    if (!message || !message.trim()) {

        throw new Error(
            "A commit message is required when using --push."
        );
    }

    runGit(
        projectPath,
        ["commit", "-m", message.trim()]
    );

    runGit(
        projectPath,
        ["push"]
    ); 

    return {
        files: stagedFiles.split(/\r?\n/),
        pushed: true
    };
}


module.exports = {
    prepareGit,
    prepareGitHub
};
