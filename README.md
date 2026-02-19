# NoteLiner

NoteLiner is an outliner style application, build using Electron and Svelte. It allows the user to create files, written in Markdown.

The app is single-user. The app has a basic toolbar along the left side of the app with font-awesome button icons, a resizeable left sidebar that contains the list of files, a panel that contains a text editor for editing the contents of the file, and a right pane which can be viewed or hidden, to show the formatted "content" of the current file being edited.

## Data Storage and Syncing

backend with a JSON file-based data layer stored in a user-specified local directory that doubles as a Git repository. Changes are committed locally on every data mutation and pushed to a remote GitHub repository on a configurable debounce timer. This enables cross-device sync via Git.

# User Interface

The toolbar has buttons to add and delete files.

The toolbar has a button to toggle

Create an implementation plan as a starting point, save the implementation plan, including assumptions, scope, and major implementation steps to /docs/plan/plan-implementation.md. List the major phases of the plan, and I will review and approve.

