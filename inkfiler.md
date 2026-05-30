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

## extra wants

At time of writing, the app is running with tree, captions, sticky notes, drawing...

- zoom + pan with overview panel (above annotations?)
- allow collapse each sidebar to have more canvas drawing space
- sticky notes is great, but I was expecting graphical text, so maybe theming/styling those boxes and font/size selection?
- io.firefinch is probably not the right namespace as this is a side-project... should be idk github.crunchbangle?
- layers - crud, strokes on current layer, show/hide
- layers2 - transform layers - maybe more than one in the same step


## ci

- run unit and e2e tests on pr creation... must test/pass before merge allowed
- github actions to build windows and linux binary artifacts for download after merging a pr, link downloads from readme

