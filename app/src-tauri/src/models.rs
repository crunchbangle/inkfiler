use serde::{Deserialize, Serialize};

/// A node in the hierarchy. Each node owns exactly one canvas (1:1).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub sort_order: f64,
    /// Accompanying text shown alongside the canvas (searchable).
    pub caption: String,
    pub created_at: i64,
    pub updated_at: i64,
}

/// The drawing surface for a node. `strokes` is a JSON array of recorded
/// atrament strokes (vector); `bounds` is `{w,h}` JSON or null for unbounded.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Canvas {
    pub node_id: String,
    pub bounds: Option<serde_json::Value>,
    pub strokes: serde_json::Value,
    pub updated_at: i64,
}

/// A text annotation positioned over the canvas (world coordinates).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Textbox {
    pub id: String,
    pub node_id: String,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub content: String,
    pub updated_at: i64,
}

/// Everything the frontend needs to render a node when it is opened.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoadedNode {
    pub node: Node,
    pub canvas: Canvas,
    pub textboxes: Vec<Textbox>,
    pub tags: Vec<String>,
}
