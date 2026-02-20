# NoteLiner

NoteLiner is a single-user outliner style application, built using Electron and Svelte. It allows the user to create files in a hierarchical structure. Each file is written in Markdown, with basic syntax highlighting.

## Data Storage and Syncing

NoteLiner works with the concept of a "Project", which represents a  folder on the user's computer. Each Project contains the following:

1. A local Git repository that maps to a remote Git repository on GitHub.com or GitLab.com.
2. An index file named "noteliner.json", which uses a JSON structure to track all of the files the current directory, as well as the tags associated with each file. 
3. Zero (0) or more files, saved as "FILE_NAME.md" in the project directory.

Changes are committed locally on whenever a file is added, removed, or modified. Every commit is pushed to a remote Git repository on a configurable debounce timer. This enables cross-device sync via Git.

Each file may have a number of tags associated with it.

## User Interface

The user interface consists of:

1. A toolbar along the left side of the app with font-awesome button icons
2. A resizeable left sidebar panel that contains the list of files in the current project. Users can drag files around within the list to re-order them, or re-parent them.
3. A center panel that contains a text editor for editing the contents of the currently selected file.
4. A right panel which can be viewed or hidden, to show the formatted "content" of the current file being edited.
5. A bottom panel that contains a textarea which displays the list of sync commands that the app is running to sync the project files to the remote Git repository.

The toolbar has the following buttons, which use FontAwesome icons:

- Open Folder. When the user clicks this button, the app displays an "Open Folder" modal dialog, allowing the user to select a folder. When the user selects a folder and clicks the "OK" button in the "Open Folder" modal dialog, the app sets that folder as the active folder. If the folder already contains a Git repository and a noteliner.json file, the project is loaded into the application. The application then attempts to pull the latest version of the remoter Git repository. If the user selects a blank folder, the app prompts the user to enter the URL for a remote Git repository or create a new Git repository. If the user enters a remote Git repository, it is cloned to the folder that the user selected.
- New File. When the user clicks this button, a new file is created below the currently selected file in the file list. If there are no files selected, the new file is added to the end of the list of files. If there are no files in the project, the new file becomes the first file.
- Show Log: When the user clicks this button, if the Logging panel is not visible, it is shown. If the Logging panel is visible, it is hidden. The app saves the last vertical height of the Logging panel, and restores the panel to that height when it is shown.
- About. When the user clicks this button, they are shown an About modal dialog, with the Application name and version.

The first time the app opens, the Open screen is shown.

## Plan

Create an implementation plan as a starting point, save the implementation plan, including assumptions, scope, and major implementation steps to /docs/plan-implementation.md. List the major phases of the plan, and I will review and approve.
