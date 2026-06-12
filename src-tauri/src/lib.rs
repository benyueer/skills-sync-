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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
