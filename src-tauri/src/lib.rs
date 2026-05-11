mod commands;
mod config;
mod skill;
mod sync;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_skills,
            commands::get_config,
            commands::save_config,
            commands::sync_from_git,
            commands::open_skills_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
