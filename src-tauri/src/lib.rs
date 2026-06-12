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
            commands::open_skills_dir,
            commands::open_central_dir,
            commands::open_agent_dir,
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
            commands::get_skills_distribution_status,
            commands::link_skill_to_agent,
            commands::unlink_skill_from_agent,
            commands::create_central_skill,
            commands::delete_central_skill,
            commands::link_all_skills_to_agent,
            commands::unlink_all_skills_from_agent,
            commands::run_interactive_command,
            commands::send_command_input,
            commands::kill_interactive_command,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                #[cfg(target_os = "windows")]
                {
                    if let Err(e) = commands::cleanup_copied_skills_on_exit() {
                        eprintln!("Failed to cleanup copied skills on exit: {}", e);
                    }
                }
            }
        });
}
