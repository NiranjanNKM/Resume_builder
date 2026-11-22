# RoleFit

RoleFit is a privacy-first resume tailoring workspace designed for GitHub Pages. It accepts a pasted job description, or a public job/LinkedIn link with optional copied text, and creates a focused resume draft with keyword signals.

## Deploy

Push to `main`; the included GitHub Actions workflow deploys the site to GitHub Pages. If Pages is not enabled yet, open **Settings → Pages**, choose **GitHub Actions** as the source, and wait for the workflow to finish.

There is no backend. Profile data is stored in the browser's local storage. Direct LinkedIn extraction is intentionally not attempted because LinkedIn commonly blocks cross-origin page access; paste the job text or copied description instead.

The keyword score is a lightweight heuristic, not a guarantee of ATS performance. Review every generated line and keep only claims supported by your real experience.
