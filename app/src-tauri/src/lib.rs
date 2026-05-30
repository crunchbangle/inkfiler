mod db;
mod models;

use db::Db;
use models::{LoadedNode, Node, Textbox};
use tauri::Manager;

/// Convert any rusqlite error into a string the frontend can surface.
fn e<T>(r: rusqlite::Result<T>) -> Result<T, String> {
    r.map_err(|err| err.to_string())
}

// ---- hierarchy -----------------------------------------------------------

#[tauri::command]
fn get_tree(db: tauri::State<Db>) -> Result<Vec<Node>, String> {
    e(db.get_tree())
}

#[tauri::command]
fn create_node(
    db: tauri::State<Db>,
    parent_id: Option<String>,
    title: Option<String>,
) -> Result<Node, String> {
    e(db.create_node(parent_id, title))
}

#[tauri::command]
fn rename_node(db: tauri::State<Db>, id: String, title: String) -> Result<(), String> {
    e(db.rename_node(&id, &title))
}

#[tauri::command]
fn move_node(
    db: tauri::State<Db>,
    id: String,
    new_parent_id: Option<String>,
    sort_order: f64,
) -> Result<(), String> {
    e(db.move_node(&id, new_parent_id, sort_order))
}

#[tauri::command]
fn delete_node(db: tauri::State<Db>, id: String) -> Result<(), String> {
    e(db.delete_node(&id))
}

// ---- canvas / loading ----------------------------------------------------

#[tauri::command]
fn load_node(db: tauri::State<Db>, id: String) -> Result<Option<LoadedNode>, String> {
    e(db.load_node(&id))
}

#[tauri::command]
fn save_canvas(
    db: tauri::State<Db>,
    node_id: String,
    strokes: serde_json::Value,
    bounds: Option<serde_json::Value>,
    raster: Option<String>,
) -> Result<(), String> {
    e(db.save_canvas(&node_id, &strokes, &bounds, &raster))
}

#[tauri::command]
fn save_caption(db: tauri::State<Db>, id: String, caption: String) -> Result<(), String> {
    e(db.save_caption(&id, &caption))
}

// ---- textboxes -----------------------------------------------------------

#[tauri::command]
fn upsert_textbox(db: tauri::State<Db>, textbox: Textbox) -> Result<(), String> {
    e(db.upsert_textbox(&textbox))
}

#[tauri::command]
fn delete_textbox(db: tauri::State<Db>, id: String) -> Result<(), String> {
    e(db.delete_textbox(&id))
}

// ---- tags / search -------------------------------------------------------

#[tauri::command]
fn set_node_tags(db: tauri::State<Db>, node_id: String, names: Vec<String>) -> Result<(), String> {
    e(db.set_node_tags(&node_id, &names))
}

#[tauri::command]
fn search(db: tauri::State<Db>, query: String) -> Result<Vec<String>, String> {
    e(db.search(&query))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Allow overriding the data directory. Used by E2E tests to stay off
            // the user's real notebook; also enables a portable/custom location.
            let dir = match std::env::var("INKFILER_DATA_DIR") {
                Ok(d) if !d.trim().is_empty() => std::path::PathBuf::from(d),
                _ => app.path().app_data_dir()?,
            };
            std::fs::create_dir_all(&dir)?;
            let db = Db::open(&dir.join("inkfiler.db"))
                .map_err(|err| format!("failed to open database: {err}"))?;
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_tree,
            create_node,
            rename_node,
            move_node,
            delete_node,
            load_node,
            save_canvas,
            save_caption,
            upsert_textbox,
            delete_textbox,
            set_node_tags,
            search,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
