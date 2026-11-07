# Offline Mermaid runtime

Mermaid.js 11.12.2 (https://mermaid.js.org/) — MIT License, © Mermaid contributors.
JavaScript ES modules and dependent chunks are bundled from the preinstalled
Gradio frontend distribution and adapted for direct local loading, without an
external CDN. Original Mermaid source: https://github.com/mermaid-js/mermaid.

Mermaid is used with `securityLevel: 'strict'`; diagrams are displayed as
images instead of injecting generated SVG into the live application DOM.
