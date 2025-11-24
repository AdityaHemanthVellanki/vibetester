Private Repository Support

Create a minimal GitHub Personal Access Token (PAT) with repo scope. Use HTTPS cloning.

Steps
- Create a PAT from GitHub settings with the least privileges required.
- Paste the PAT into the Retry modal when a clone fails due to authentication.

Security Notes
- Tokens are never stored. They are used in-memory for cloning and then discarded immediately.
- Analyzer container remains isolated with `--network none`.