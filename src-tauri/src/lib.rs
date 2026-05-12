mod commands;
mod config;
mod skill;
mod sync;
mod tools;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Restore window size/position from saved config before webview loads
            let cfg = config::load();
            if let Some(window) = app.get_webview_window("main") {
                let size: tauri::LogicalSize<f64> = tauri::LogicalSize::new(
                    cfg.window_width as f64,
                    cfg.window_height as f64,
                );
                let _ = window.set_size(size);
                if let (Some(x), Some(y)) = (cfg.window_x, cfg.window_y) {
                    let pos: tauri::LogicalPosition<f64> = tauri::LogicalPosition::new(x as f64, y as f64);
                    let _ = window.set_position(pos);
                }
            }
            Ok(())
        })
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
            commands::get_skill_diff_content,
            commands::list_repo_skill_files,
            commands::read_repo_file_content,
            commands::git_status,
            commands::git_pull,
            commands::git_commit,
            commands::git_push,
            commands::git_add,
            commands::git_merge_abort,
            commands::git_resolve_ours,
            commands::git_resolve_theirs,
            commands::get_repo_skills,
            commands::delete_repo_skill,
            commands::open_repo_dir,
            commands::update_repo_url,
            commands::delete_skill_from_agent,
            commands::sync_skill_to_repo,
            commands::sync_skill_to_agent,
            commands::restore_skill_from_repo,
            commands::get_repo_git_changes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
