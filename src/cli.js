const { Command } = require("commander");
const path = require("path");

const {
    fixSecret,
    ensureGitignore,
    ensureReadme
} = require("./fixer");
const { scanProject } = require("./scanner");

const {
    checkPackageJson,
    checkProjectName,
    checkNodeModules,
    checkGitignore,
    checkScripts
} = require("./checks");

const { scanSecrets } = require("./security");
const { report } = require("./reporter");
const { prepareGit, prepareGitHub } = require("./git");


const program = new Command();


program
    .name("project-doctor")
    .description("Diagnose and safely fix JavaScript projects")
    .version("0.3.0");


program
    .argument(
        "[path]",
        "project directory to inspect",
        "."
    )
    .option(
        "--fix",
        "apply safe fixes"
    )
    .option(
        "--security",
        "scan for exposed secrets"
    )
    .option(
        "--deps",
        "scan dependencies"
    )
    .option(
        "--git-ready <files...>",
        "scan and stage specific files for Git"
    )
    .option(
        "--push",
        "commit and push files prepared with --git-ready"
    )
    .option(
        "--message <message>",
        "commit message used with --push"
    )
    .option(
        "--github-repo <repository>",
        "prepare this project for a GitHub repository"
    )
    .option(
        "--username <username>",
        "GitHub username used with --github-repo"
    );


program.action((projectPath, options) => {

    try {

        const project =
            scanProject(projectPath);


        if (
            (options.push || options.message) &&
            !options.gitReady &&
            !options.githubRepo
        ) {

            throw new Error(
                "Use --push and --message together with --git-ready <files...>."
            );
        }


        // ─────────────────────────────
        // GITHUB PUBLISHING
        // ─────────────────────────────

        if (options.githubRepo) {

            if (!options.username) {

                throw new Error(
                    "Create the GitHub repository first, then provide --username YOUR_USERNAME."
                );
            }


            const readmeResult =
                ensureReadme(
                    project.path,
                    project.packageJson
                );


            ensureGitignore(
                project.path
            );


            const securityFindings =
                scanSecrets(project.path);


            if (securityFindings.length > 0) {

                throw new Error(
                    "Resolve security issues before publishing to GitHub."
                );
            }


            const result =
                prepareGitHub(
                    project.path,
                    options.username,
                    options.githubRepo,
                    options.push,
                    options.message
                );


            console.log("");
            console.log("Project Doctor");
            console.log("");


            if (readmeResult.fixed) {
                console.log("OK Created README.md");
            }


            console.log(
                `OK Prepared ${result.files.length} file${
                    result.files.length === 1 ? "" : "s"
                } for GitHub.`
            );
            console.log(`  ${result.remoteUrl}`);


            if (result.pushed) {
                console.log("OK Committed and pushed changes.");
            } else {
                console.log(
                    "Review the staged files, then rerun with --push --message."
                );
            }


            console.log("");
            return;
        }


        // ─────────────────────────────
        // GIT PREPARATION
        // ─────────────────────────────

        if (options.gitReady) {

            const securityFindings =
                scanSecrets(project.path);


            if (securityFindings.length > 0) {

                throw new Error(
                    "Resolve security issues before preparing files for Git."
                );
            }


            const result =
                prepareGit(
                    project.path,
                    options.gitReady,
                    options.push,
                    options.message
                );


            console.log("");
            console.log("Project Doctor");
            console.log("");
            console.log(
                `OK Prepared ${result.files.length} file${
                    result.files.length === 1 ? "" : "s"
                } for Git.`
            );


            if (result.pushed) {
                console.log("OK Committed and pushed changes.");
            } else {
                console.log(
                    "Run with --push and --message to commit and push them."
                );
            }


            console.log("");
            return;
        }


        // ─────────────────────────────
        // SECURITY MODE
        // ─────────────────────────────

        if (options.security) {

            const findings =
                scanSecrets(project.path);


            console.log("");
            console.log("Project Doctor");
            console.log("");


            // No security issues found
            if (findings.length === 0) {

                console.log(
                    "OK No security issues found."
                );

                console.log("");

                return;
            }


            // ─────────────────────────
            // FIX MODE
            // ─────────────────────────

            if (options.fix) {

                console.log(
                        `Found ${findings.length} security issue${
                        findings.length === 1
                            ? ""
                            : "s"
                    }.`
                );

                console.log("");
                console.log(
                    "Applying safe fixes..."
                );
                console.log("");

                let fixed = 0;


                for (const finding of findings) {

                    try {

                        const result =
                            fixSecret(
                                project.path,
                                finding
                            );


                        if (result.fixed) {

                            const message =
                                finding.kind === "env-protection"
                                    ? "OK Protected .env with .gitignore"
                                    : `OK ${finding.type} -> ${result.envName}`;

                            console.log(
                                message
                            );

                            fixed++;

                        } else {

                            console.log(
                                `WARN Could not safely fix ${finding.type}`
                            );
                        }


                    } catch (error) {

                        console.log(
                            `ERROR Failed to fix ${finding.type}`
                        );

                        console.log(
                            `  ${error.message}`
                        );
                    }
                }


                console.log("");

                console.log(
                    `${fixed} fix${
                        fixed === 1
                            ? ""
                            : "es"
                    } applied.`
                );


                const remainingFindings =
                    scanSecrets(project.path);


                if (remainingFindings.length === 0) {

                    console.log(
                        "OK Verified no security issues remain."
                    );

                } else {

                    console.log(
                        `WARN ${remainingFindings.length} security issue${
                            remainingFindings.length === 1 ? "" : "s"
                        } still require attention.`
                    );
                }

                console.log("");

                return;
            }


            // ─────────────────────────
            // SECURITY REPORT
            // ─────────────────────────

            console.log(
                `ERROR ${findings.length} security issue${
                    findings.length === 1
                        ? ""
                        : "s"
                } found`
            );

            console.log("");


            for (const finding of findings) {

                const relativePath =
                    path.relative(
                        project.path,
                        finding.file
                    );


                const icon =
                    finding.severity === "critical" ||
                    finding.severity === "high"
                        ? "ERROR"
                        : "WARN";


                console.log(
                    `${icon} ${finding.type}`
                );

                console.log(
                    `  ${relativePath}:${finding.line}`
                );

                console.log(
                    `  Fix: ${finding.fix || "move secret to .env"}`
                );

                console.log("");
            }


            console.log(
                "Run `project-doctor --security --fix` to fix safe secrets."
            );

            console.log("");

            return;
        }


        // ─────────────────────────────
        // NORMAL PROJECT CHECK
        // ─────────────────────────────

        const results = [

            checkPackageJson(project),

            checkProjectName(project),

            checkNodeModules(project),

            checkGitignore(project),

            checkScripts(project)

        ];


        if (options.fix) {

            const result =
                ensureGitignore(
                    project.path
                );


            if (result.fixed) {

                console.log("");
                console.log(
                    "OK Created a safe .gitignore"
                );
            }
        }


        report(
            project,
            results,
            options
        );


    } catch (error) {

        console.error("");

        console.error(
            `ERROR ${error.message}`
        );

        console.error("");

        process.exit(1);
    }

});


program.parse();