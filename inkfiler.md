# inkfiler

InkFiler core values:

- ink-first (atrament.js)
- privacy focussed (self hosted)
- hierarchy and linkage

Main features:

- Hierarchical sidebar, like onenote or obsidian
- Main canvas is atrament.js powered stylus/wacom-tablet thing
- Standard palettes and stuff for drawing
- Add links to other canvases on an item
- Add anchors to items - link to a specific item?
- tags and searching
- textboxes
- embed images
- layers
- copy/paste between layers
- composition from multiple canvases (paste-by-reference?)
- encryption at rest
- sync with various services

Prototype:

- hierarchy
    - create nodes/child nodes
    - rename
    - order
    - tag
- canvas
    - each node has one
    - infinite scroll? or bounded?
    - draw with pressure sensitive hardware
    - different colours
    - undo/redo
- serialize
    - save it all to a sensibly structure db
    - load from db when clicking on node
- text
    - add text box to canvas for graphical annotations
    - add caption to canvas for accompanying text
    - search text in sidebar-filters the hierarchy

MVP:

Prototype +

- more drawing options
- more storage options
- encryption
- I'll think of more stuff and prioritise after using the prototype

Techstack:

- tauri
- ts react
- atrament.js
- idk what else is needed?
