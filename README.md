# Node Fix

Node Fix is a fast Node.js CLI that checks JavaScript projects, finds security problems, applies conservative fixes, and prepares selected files for Git.

It reports the actual problem instead of inventing a health score.

## Requirements

- Node.js 20 or newer
- npm

## Install

Run directly from a checkout:

```powershell
npm install
node src\cli.js
```

Install globally from the project directory:

```powershell
npm install -g @josephblitz/node-fix
```

## Commands

Diagnose the current project:

```powershell
node-fix
```

Diagnose another project:

```powershell
node-fix C:\path\to\project
```

Scan for exposed credentials:

```powershell
node-fix --security
```

Apply high-confidence security fixes:

```powershell
node-fix --security --fix
```

This can move a recognized credential to `.env`, replace the source value with `process.env.NAME`, protect `.env` in `.gitignore`, and rescan the project.

Apply the currently safe general project fix:

```powershell
node-fix --fix
```

This creates a conservative `.gitignore` when one is missing. It does not invent npm scripts or rewrite application logic.

Prepare specific files for Git:

```powershell
node-fix --git-ready src\cli.js package.json
```

Node Fix scans for security findings first and stages only the files named in the command. It never uses `git add -A`.

Commit and push explicitly:

```powershell
node-fix --git-ready src\cli.js package.json --push --message "Improve project checks"
```

`--push` requires `--git-ready` and a commit message. The project must already be inside a Git repository with a configured remote and usable Git credentials.

Prepare a new GitHub repository:

1. Create an empty repository on GitHub. Do not add a README or `.gitignore` there.
2. From the local project directory, run:

```powershell
node-fix --github-repo node-fix --username YOUR_GITHUB_USERNAME
```

This initializes Git when needed, creates a missing `README.md`, creates a missing `.gitignore`, adds the GitHub remote, and stages the project. Review the staged files before pushing.

When everything looks correct, push explicitly:

```powershell
node-fix --github-repo node-fix --username YOUR_GITHUB_USERNAME --push --message "Initial release"
```

The GitHub repository must already exist. Node Fix does not create remote repositories or handle GitHub passwords and tokens.

Show all available options:

```powershell
node-fix --help
```

The `--deps` option is reserved for the dependency scanner and is not implemented yet.

## Security model

Node Fix recognizes known credential formats such as Groq, OpenAI, GitHub, Google, Slack, JWT, and bearer tokens. It also detects suspicious hardcoded assignments such as API keys, tokens, secrets, and passwords.

Unknown credentials cannot be recognized reliably by one universal pattern. Ambiguous values should be reported for review rather than blindly rewritten. Automatic fixes are limited to high-confidence findings and make surgical source changes.

Never place a real credential in a test fixture or commit `.env`.

## Development

Run the test suite:

```powershell
npm test
```

Run the CLI during development:

```powershell
npm start
npm run dev
```

Create an npm tarball preview without publishing:

```powershell
npm pack --dry-run
```

## Roadmap

- Scan-fix-rescan verification for every safe fix
- More provider-specific credential detectors
- Dependency and vulnerability checks for `--deps`
- Lockfile consistency checks
- Git history secret detection
- Missing environment variable checks
- Node.js and TypeScript project checks
- More conservative general `--fix` repairs
- CI-friendly output and exit codes

## License

MIT
