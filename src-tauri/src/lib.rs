mod commands;
mod config;
mod skill;
mod sync;
mod tools;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::get_skills,
            commands::get_config,
            commands::save_config,
            commands::sync_from_git,
            commands::open_skills_dir,
            commands::read_skill_file,
            commands::save_custom_dir,
            commands::backup_skills,
            commands::preview_restore,
            commands::execute_restore,
            commands::open_skill_with_app,
            commands::reveal_path,
            commands::list_skill_files,
            commands::read_file_content,
            commands::save_window_state,
            commands::save_dark_mode,
            commands::save_active_tab,
            commands::compare_skills,
            commands::get_skill_diff,
            commands::list_repo_skill_files,
            commands::read_repo_file_content,
            commands::git_status,
            commands::git_pull,
            commands::get_repo_skills,
            commands::open_repo_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
