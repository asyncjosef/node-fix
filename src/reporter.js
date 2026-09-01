const chalk = require("chalk");

function report(project, results) {

    const problems =
        results.filter(
            result => result.status !== "ok"
        );

    console.log("");
    console.log(
        chalk.bold("Project Doctor")
    );
    console.log("");

    if (problems.length === 0) {

        console.log(
            chalk.green("OK No problems found.")
        );

        console.log("");

        return;
    }

    console.log(
        chalk.yellow(
            `${problems.length} issue${problems.length === 1 ? "" : "s"} found`
        )
    );

    console.log("");

    for (const result of problems) {

        const icon =
            result.status === "error"
                ? chalk.red("ERROR")
                : chalk.yellow("WARN");

        console.log(
            `${icon} ${chalk.bold(result.name)}`
        );

        console.log(
            `  ${result.message}`
        );

        if (result.fix) {

            console.log(
                `  ${chalk.gray("Fix:")} ${result.fix}`
            );
        }

        console.log("");
    }

    console.log(
        chalk.gray(
            "Run `project-doctor --fix` to apply safe fixes."
        )
    );

    console.log("");
}

module.exports = {
    report
};